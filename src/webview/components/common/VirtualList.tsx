// ===================================================
// VirtualList — רשימה וירטואלית לביצועים גבוהים
// ===================================================
// מרנדר רק פריטים נראים ב-viewport + buffer
// תומך בגובה משתנה, גלילה חלקה, RTL, auto-scroll
// ===================================================

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';

// -------------------------------------------------
// Types
// -------------------------------------------------

export interface VirtualListProps<T> {
  /** רשימת הפריטים */
  items: T[];
  /** פונקציית רינדור לפריט בודד */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** מפתח ייחודי לכל פריט */
  getItemKey: (item: T, index: number) => string | number;
  /** גובה משוער (px) — ברירת מחדל לפריטים שטרם נמדדו */
  estimatedItemHeight?: number;
  /** כמות פריטים לשמור מעבר לאזור הנראה (מעל/מתחת) */
  overscanCount?: number;
  /** סף מינימלי — מתחת לכמות זו לא מפעילים וירטואליזציה */
  virtualizationThreshold?: number;
  /** className לקונטיינר הגלילה */
  className?: string;
  /** style לקונטיינר הגלילה */
  style?: React.CSSProperties;
  /** גלילה אוטומטית לתחתית כשמתווספים פריטים (רק אם המשתמש בתחתית) */
  autoScrollToBottom?: boolean;
  /** מרחק מהתחתית (px) שנחשב "בתחתית" */
  bottomThreshold?: number;
  /** קריאה כשמגיעים לראש הרשימה (לטעינת היסטוריה) */
  onReachTop?: () => void;
  /** מרחק מהראש (px) להפעלת onReachTop */
  topThreshold?: number;
  /** קריאה כשמגיעים לתחתית */
  onReachBottom?: () => void;
  /** תוכן קבוע שמופיע לפני הרשימה (לא חלק מהוירטואליזציה) */
  header?: React.ReactNode;
  /** תוכן קבוע שמופיע אחרי הרשימה */
  footer?: React.ReactNode;
  /** ARIA role לקונטיינר */
  role?: string;
  /** ARIA label */
  ariaLabel?: string;
  /** ARIA live region */
  ariaLive?: 'off' | 'polite' | 'assertive';
  /** dir attribute (RTL support) */
  dir?: string;
}

export interface VirtualListHandle {
  /** גלילה לפריט לפי אינדקס */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  /** גלילה לתחתית */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** גלילה לראש */
  scrollToTop: (behavior?: ScrollBehavior) => void;
  /** קבלת הקונטיינר */
  getContainer: () => HTMLDivElement | null;
  /** האם המשתמש בתחתית */
  isAtBottom: () => boolean;
}

// -------------------------------------------------
// Constants
// -------------------------------------------------

const DEFAULT_ESTIMATED_HEIGHT = 100;
const DEFAULT_OVERSCAN = 5;
const DEFAULT_THRESHOLD = 15;
const DEFAULT_BOTTOM_THRESHOLD = 80;
const DEFAULT_TOP_THRESHOLD = 50;
const SCROLL_THROTTLE_MS = 16; // ~60fps

// -------------------------------------------------
// VirtualList Component
// -------------------------------------------------

function VirtualListInner<T>(
  props: VirtualListProps<T>,
  ref: React.Ref<VirtualListHandle>,
) {
  const {
    items,
    renderItem,
    getItemKey,
    estimatedItemHeight = DEFAULT_ESTIMATED_HEIGHT,
    overscanCount = DEFAULT_OVERSCAN,
    virtualizationThreshold = DEFAULT_THRESHOLD,
    className = '',
    style,
    autoScrollToBottom = false,
    bottomThreshold = DEFAULT_BOTTOM_THRESHOLD,
    onReachTop,
    topThreshold = DEFAULT_TOP_THRESHOLD,
    onReachBottom,
    header,
    footer,
    role,
    ariaLabel,
    ariaLive,
    dir,
  } = props;

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());
  const itemElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isAtBottomRef = useRef(true);
  const prevItemCountRef = useRef(items.length);
  const scrollFrameRef = useRef<number | null>(null);
  const prevScrollHeightRef = useRef(0);
  const isLoadingTopRef = useRef(false);

  // State
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  const useVirtualization = items.length > virtualizationThreshold;

  // -------------------------------------------------
  // גובה כולל — חישוב הגובה של כל הפריטים
  // -------------------------------------------------
  const getTotalHeight = useCallback(() => {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += itemHeightsRef.current.get(i) ?? estimatedItemHeight;
    }
    return total;
  }, [items.length, estimatedItemHeight]);

  // -------------------------------------------------
  // חישוב offset (top) של פריט לפי אינדקס
  // -------------------------------------------------
  const getItemOffset = useCallback(
    (index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += itemHeightsRef.current.get(i) ?? estimatedItemHeight;
      }
      return offset;
    },
    [estimatedItemHeight],
  );

  // -------------------------------------------------
  // חישוב טווח הפריטים הנראים
  // -------------------------------------------------
  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container || !useVirtualization) {
      setVisibleRange({ start: 0, end: items.length - 1 });
      return;
    }

    const { scrollTop, clientHeight } = container;

    // מציאת פריט ראשון נראה — binary search לביצועים
    let accumulatedHeight = 0;
    let startIdx = 0;

    for (let i = 0; i < items.length; i++) {
      const h = itemHeightsRef.current.get(i) ?? estimatedItemHeight;
      if (accumulatedHeight + h > scrollTop) {
        startIdx = i;
        break;
      }
      accumulatedHeight += h;
      if (i === items.length - 1) {
        startIdx = i;
      }
    }

    // מציאת פריט אחרון נראה
    let endIdx = startIdx;
    let visibleHeight = accumulatedHeight + (itemHeightsRef.current.get(startIdx) ?? estimatedItemHeight) - scrollTop;
    for (let i = startIdx + 1; i < items.length; i++) {
      if (visibleHeight >= clientHeight) break;
      visibleHeight += itemHeightsRef.current.get(i) ?? estimatedItemHeight;
      endIdx = i;
    }

    // הוספת overscan buffer
    const newStart = Math.max(0, startIdx - overscanCount);
    const newEnd = Math.min(items.length - 1, endIdx + overscanCount);

    setVisibleRange((prev) => {
      if (prev.start === newStart && prev.end === newEnd) return prev;
      return { start: newStart, end: newEnd };
    });
  }, [items.length, estimatedItemHeight, overscanCount, useVirtualization]);

  // -------------------------------------------------
  // ResizeObserver — מדידת גובה דינמי של פריטים
  // -------------------------------------------------
  useEffect(() => {
    resizeObserverRef.current = new ResizeObserver((entries) => {
      let needsRecalc = false;

      for (const entry of entries) {
        const el = entry.target as HTMLDivElement;
        const indexStr = el.dataset.virtualIndex;
        if (indexStr === undefined) continue;

        const index = parseInt(indexStr, 10);
        const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? el.getBoundingClientRect().height;

        if (newHeight > 0) {
          const prevHeight = itemHeightsRef.current.get(index);
          if (prevHeight !== newHeight) {
            itemHeightsRef.current.set(index, newHeight);
            needsRecalc = true;
          }
        }
      }

      if (needsRecalc) {
        calculateVisibleRange();
      }
    });

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [calculateVisibleRange]);

  // -------------------------------------------------
  // ref callback למדידת פריטים
  // -------------------------------------------------
  const measureRef = useCallback(
    (el: HTMLDivElement | null, index: number) => {
      if (el) {
        itemElementsRef.current.set(index, el);
        el.dataset.virtualIndex = String(index);
        resizeObserverRef.current?.observe(el);

        // מדידה מיידית
        const height = el.getBoundingClientRect().height;
        if (height > 0) {
          itemHeightsRef.current.set(index, height);
        }
      } else {
        const prevEl = itemElementsRef.current.get(index);
        if (prevEl) {
          resizeObserverRef.current?.unobserve(prevEl);
          itemElementsRef.current.delete(index);
        }
      }
    },
    [],
  );

  // -------------------------------------------------
  // Scroll handler — throttled עם rAF
  // -------------------------------------------------
  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current) return;

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;

      const container = containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;

      // עדכון מצב "בתחתית"
      isAtBottomRef.current = maxScroll - scrollTop < bottomThreshold;

      // Callbacks לטעינה דינמית
      if (scrollTop < topThreshold && onReachTop && !isLoadingTopRef.current) {
        isLoadingTopRef.current = true;
        prevScrollHeightRef.current = scrollHeight;
        onReachTop();
        // Reset after short delay to prevent rapid re-triggering
        setTimeout(() => {
          isLoadingTopRef.current = false;
        }, 500);
      }

      if (onReachBottom && maxScroll - scrollTop < bottomThreshold) {
        onReachBottom();
      }

      // עדכון טווח נראה
      if (useVirtualization) {
        calculateVisibleRange();
      }
    });
  }, [bottomThreshold, topThreshold, onReachTop, onReachBottom, useVirtualization, calculateVisibleRange]);

  // ניקוי rAF
  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  // -------------------------------------------------
  // Auto-scroll כשמתווספים פריטים חדשים בתחתית
  // -------------------------------------------------
  useEffect(() => {
    const prevCount = prevItemCountRef.current;
    prevItemCountRef.current = items.length;

    if (!autoScrollToBottom) return;

    // פריטים חדשים נוספו בסוף
    if (items.length > prevCount && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        }
      });
    }
  }, [items.length, autoScrollToBottom]);

  // -------------------------------------------------
  // שמירת scroll position כשנטענים פריטים מלמעלה
  // -------------------------------------------------
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      const delta = newScrollHeight - prevScrollHeightRef.current;
      if (delta > 0) {
        containerRef.current.scrollTop += delta;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [items.length]);

  // -------------------------------------------------
  // חישוב טווח ראשוני / כשמשתנה מספר הפריטים
  // -------------------------------------------------
  useEffect(() => {
    calculateVisibleRange();
  }, [items.length, calculateVisibleRange]);

  // -------------------------------------------------
  // Imperative handle — מתודות חיצוניות
  // -------------------------------------------------
  useImperativeHandle(ref, () => ({
    scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
      const container = containerRef.current;
      if (!container) return;

      const offset = getItemOffset(index);
      container.scrollTo({ top: offset, behavior });
    },
    scrollToBottom(behavior: ScrollBehavior = 'smooth') {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior });
    },
    scrollToTop(behavior: ScrollBehavior = 'smooth') {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({ top: 0, behavior });
    },
    getContainer() {
      return containerRef.current;
    },
    isAtBottom() {
      return isAtBottomRef.current;
    },
  }), [getItemOffset]);

  // -------------------------------------------------
  // Spacer heights — גובה מעל/מתחת לפריטים הנראים
  // -------------------------------------------------
  const topSpacerHeight = useMemo(() => {
    if (!useVirtualization) return 0;
    let h = 0;
    for (let i = 0; i < visibleRange.start; i++) {
      h += itemHeightsRef.current.get(i) ?? estimatedItemHeight;
    }
    return h;
  }, [visibleRange.start, useVirtualization, estimatedItemHeight, items.length]);

  const bottomSpacerHeight = useMemo(() => {
    if (!useVirtualization) return 0;
    let h = 0;
    for (let i = visibleRange.end + 1; i < items.length; i++) {
      h += itemHeightsRef.current.get(i) ?? estimatedItemHeight;
    }
    return h;
  }, [visibleRange.end, items.length, useVirtualization, estimatedItemHeight]);

  // -------------------------------------------------
  // פריטים לרינדור
  // -------------------------------------------------
  const renderedItems = useMemo(() => {
    if (!useVirtualization) {
      return items.map((item, index) => ({
        item,
        index,
      }));
    }

    const result: { item: T; index: number }[] = [];
    const start = Math.max(0, visibleRange.start);
    const end = Math.min(items.length - 1, visibleRange.end);

    for (let i = start; i <= end; i++) {
      result.push({ item: items[i], index: i });
    }
    return result;
  }, [items, visibleRange, useVirtualization]);

  // -------------------------------------------------
  // Render
  // -------------------------------------------------
  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={style}
      role={role}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      dir={dir}
      onScroll={handleScroll}
    >
      {/* Header content (not virtualized) */}
      {header}

      {/* Top spacer */}
      {useVirtualization && topSpacerHeight > 0 && (
        <div style={{ height: topSpacerHeight }} aria-hidden="true" />
      )}

      {/* Rendered items */}
      {renderedItems.map(({ item, index }) => (
        <div
          key={getItemKey(item, index)}
          ref={(el) => measureRef(el, index)}
          data-virtual-index={index}
        >
          {renderItem(item, index)}
        </div>
      ))}

      {/* Bottom spacer */}
      {useVirtualization && bottomSpacerHeight > 0 && (
        <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
      )}

      {/* Footer content (not virtualized) */}
      {footer}
    </div>
  );
}

// forwardRef עם generics — workaround לתמיכה ב-TypeScript
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListHandle> },
) => React.ReactElement | null;

// -------------------------------------------------
// useVirtualList — hook alternative לשימוש ישיר
// -------------------------------------------------
// עבור מקרים שצריך שליטה מלאה על ה-markup
// -------------------------------------------------
export interface UseVirtualListOptions {
  itemCount: number;
  estimatedItemHeight?: number;
  overscanCount?: number;
  containerRef: React.RefObject<HTMLElement | null>;
}

export interface UseVirtualListResult {
  /** טווח הפריטים לרינדור */
  visibleRange: { start: number; end: number };
  /** גובה spacer עליון */
  topSpacerHeight: number;
  /** גובה spacer תחתון */
  bottomSpacerHeight: number;
  /** ref callback למדידת פריט */
  measureRef: (el: HTMLDivElement | null, index: number) => void;
  /** handler לגלילה — יש לחבר ל-onScroll */
  handleScroll: () => void;
  /** גובה כולל (לכל הפריטים) */
  totalHeight: number;
}

export function useVirtualList(options: UseVirtualListOptions): UseVirtualListResult {
  const {
    itemCount,
    estimatedItemHeight = DEFAULT_ESTIMATED_HEIGHT,
    overscanCount = DEFAULT_OVERSCAN,
    containerRef,
  } = options;

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(itemCount - 1, 20) });
  const heights = useRef<Map<number, number>>(new Map());
  const frameRef = useRef<number | null>(null);

  const calculateRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;

    let accum = 0;
    let startIdx = 0;
    for (let i = 0; i < itemCount; i++) {
      const h = heights.current.get(i) ?? estimatedItemHeight;
      if (accum + h > scrollTop) {
        startIdx = i;
        break;
      }
      accum += h;
      if (i === itemCount - 1) startIdx = i;
    }

    let endIdx = startIdx;
    let visible = accum + (heights.current.get(startIdx) ?? estimatedItemHeight) - scrollTop;
    for (let i = startIdx + 1; i < itemCount; i++) {
      if (visible >= clientHeight) break;
      visible += heights.current.get(i) ?? estimatedItemHeight;
      endIdx = i;
    }

    const newStart = Math.max(0, startIdx - overscanCount);
    const newEnd = Math.min(itemCount - 1, endIdx + overscanCount);

    setVisibleRange((prev) => {
      if (prev.start === newStart && prev.end === newEnd) return prev;
      return { start: newStart, end: newEnd };
    });
  }, [itemCount, estimatedItemHeight, overscanCount, containerRef]);

  const handleScroll = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      calculateRange();
    });
  }, [calculateRange]);

  const measureRef = useCallback((el: HTMLDivElement | null, index: number) => {
    if (el) {
      const h = el.getBoundingClientRect().height;
      if (h > 0) heights.current.set(index, h);
    }
  }, []);

  const topSpacerHeight = useMemo(() => {
    let h = 0;
    for (let i = 0; i < visibleRange.start; i++) {
      h += heights.current.get(i) ?? estimatedItemHeight;
    }
    return h;
  }, [visibleRange.start, estimatedItemHeight, itemCount]);

  const bottomSpacerHeight = useMemo(() => {
    let h = 0;
    for (let i = visibleRange.end + 1; i < itemCount; i++) {
      h += heights.current.get(i) ?? estimatedItemHeight;
    }
    return h;
  }, [visibleRange.end, itemCount, estimatedItemHeight]);

  const totalHeight = useMemo(() => {
    let h = 0;
    for (let i = 0; i < itemCount; i++) {
      h += heights.current.get(i) ?? estimatedItemHeight;
    }
    return h;
  }, [itemCount, estimatedItemHeight]);

  useEffect(() => {
    calculateRange();
  }, [itemCount, calculateRange]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    visibleRange,
    topSpacerHeight,
    bottomSpacerHeight,
    measureRef,
    handleScroll,
    totalHeight,
  };
}
