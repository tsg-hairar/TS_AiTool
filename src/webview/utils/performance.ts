// ===================================================
// Performance Hooks — React hooks לביצועים
// ===================================================
// useDebounce, useThrottle, useMeasure, useIntersectionObserver
// ===================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { debounce, throttle } from '../../shared/utils/performance';

// -------------------------------------------------
// useDebounce — ערך מושהה (debounced value)
// -------------------------------------------------
// מחזיר את הערך רק אחרי שהפסיקו לעדכן אותו למשך delay
// שימוש: חיפוש, פילטרים, שמירה אוטומטית
// -------------------------------------------------
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// -------------------------------------------------
// useDebouncedCallback — פונקציה מושהית
// -------------------------------------------------
// מחזיר callback שמתבצע רק אחרי שהפסיקו לקרוא לו
// -------------------------------------------------
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debouncedFn = useMemo(
    () => debounce((...args: Parameters<T>) => callbackRef.current(...args), delay),
    [delay],
  );

  useEffect(() => {
    return () => debouncedFn.cancel();
  }, [debouncedFn]);

  return debouncedFn;
}

// -------------------------------------------------
// useThrottle — ערך מוגבל בקצב (throttled value)
// -------------------------------------------------
// מעדכן את הערך לכל היותר פעם אחת ב-delay מילישניות
// שימוש: scroll position, resize dimensions
// -------------------------------------------------
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const remaining = delay - (now - lastUpdated.current);

    if (remaining <= 0) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [value, delay]);

  return throttledValue;
}

// -------------------------------------------------
// useThrottledCallback — פונקציה מוגבלת בקצב
// -------------------------------------------------
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttledFn = useMemo(
    () => throttle((...args: Parameters<T>) => callbackRef.current(...args), delay),
    [delay],
  );

  useEffect(() => {
    return () => throttledFn.cancel();
  }, [throttledFn]);

  return throttledFn;
}

// -------------------------------------------------
// useMeasure — מדידת ממדי אלמנט עם ResizeObserver
// -------------------------------------------------
// מחזיר ref ו-bounds (width, height, top, left)
// מתעדכן אוטומטית כשהאלמנט משנה גודל
// -------------------------------------------------
export interface ElementBounds {
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

const EMPTY_BOUNDS: ElementBounds = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
};

export function useMeasure<T extends HTMLElement = HTMLElement>(): [
  React.RefCallback<T>,
  ElementBounds,
] {
  const [bounds, setBounds] = useState<ElementBounds>(EMPTY_BOUNDS);
  const elementRef = useRef<T | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    // ניקוי observer קודם
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      elementRef.current = node;

      // מדידה ראשונית
      const rect = node.getBoundingClientRect();
      setBounds({
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      });

      // האזנה לשינויי גודל
      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === node) {
            const r = node.getBoundingClientRect();
            setBounds({
              width: r.width,
              height: r.height,
              top: r.top,
              left: r.left,
              bottom: r.bottom,
              right: r.right,
            });
          }
        }
      });
      observerRef.current.observe(node);
    } else {
      elementRef.current = null;
      setBounds(EMPTY_BOUNDS);
    }
  }, []);

  // ניקוי בעת unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [ref, bounds];
}

// -------------------------------------------------
// useIntersectionObserver — מעקב נראות אלמנט
// -------------------------------------------------
// מחזיר האם האלמנט נראה ב-viewport
// שימוש: lazy loading, infinite scroll, analytics
// -------------------------------------------------
export interface UseIntersectionObserverOptions {
  /** מרחק מסביב ל-root לפני שנחשב נראה (px או %) */
  rootMargin?: string;
  /** אחוז החפיפה (0-1) שנדרש להפעלה */
  threshold?: number | number[];
  /** אלמנט root (ברירת מחדל: viewport) */
  root?: Element | null;
  /** האם לעצור אחרי הזיהוי הראשון */
  triggerOnce?: boolean;
  /** האם ה-observer פעיל */
  enabled?: boolean;
}

export interface UseIntersectionObserverResult {
  ref: React.RefCallback<Element>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverResult {
  const {
    rootMargin = '0px',
    threshold = 0,
    root = null,
    triggerOnce = false,
    enabled = true,
  } = options;

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const triggeredRef = useRef(false);

  const ref = useCallback(
    (node: Element | null) => {
      // ניקוי observer קודם
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      elementRef.current = node;

      if (!node || !enabled) return;
      if (triggerOnce && triggeredRef.current) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const latest = entries[entries.length - 1];
          setEntry(latest);
          setIsIntersecting(latest.isIntersecting);

          if (latest.isIntersecting && triggerOnce) {
            triggeredRef.current = true;
            observerRef.current?.disconnect();
          }
        },
        { rootMargin, threshold, root },
      );

      observerRef.current.observe(node);
    },
    [rootMargin, threshold, root, triggerOnce, enabled],
  );

  // ניקוי בעת unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { ref, isIntersecting, entry };
}

// -------------------------------------------------
// useAutoScroll — גלילה אוטומטית לתחתית
// -------------------------------------------------
// עוקב אחרי שינויים ברשימה וגולל לתחתית
// רק אם המשתמש כבר בתחתית (לא מפריע לגלילה ידנית)
// -------------------------------------------------
export interface UseAutoScrollOptions {
  /** מרחק מהתחתית (px) שנחשב "בתחתית" */
  bottomThreshold?: number;
  /** האם לגלול חלק (smooth) */
  smooth?: boolean;
}

export function useAutoScroll<T extends HTMLElement>(
  deps: unknown[],
  options: UseAutoScrollOptions = {},
): React.RefObject<T | null> {
  const { bottomThreshold = 80, smooth = true } = options;
  const containerRef = useRef<T | null>(null);
  const isAtBottomRef = useRef(true);

  // מעקב אחרי מיקום הגלילה
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < bottomThreshold;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [bottomThreshold]);

  // גלילה לתחתית כשהתלויות משתנות
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isAtBottomRef.current) return;

    // requestAnimationFrame כדי לוודא שה-DOM עודכן
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return containerRef;
}

// -------------------------------------------------
// useScrollPosition — מעקב אחרי מיקום גלילה
// -------------------------------------------------
export interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  isAtTop: boolean;
  isAtBottom: boolean;
  scrollPercentage: number;
}

export function useScrollPosition<T extends HTMLElement>(
  throttleMs = 50,
): [React.RefObject<T | null>, ScrollPosition] {
  const containerRef = useRef<T | null>(null);
  const [position, setPosition] = useState<ScrollPosition>({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    isAtTop: true,
    isAtBottom: true,
    scrollPercentage: 0,
  });

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;

    setPosition({
      scrollTop,
      scrollHeight,
      clientHeight,
      isAtTop: scrollTop < 10,
      isAtBottom: maxScroll - scrollTop < 80,
      scrollPercentage: maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 100,
    });
  }, []);

  const throttledUpdate = useMemo(
    () => throttle(updatePosition as (...args: unknown[]) => unknown, throttleMs),
    [updatePosition, throttleMs],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', () => throttledUpdate(), { passive: true });
    // מדידה ראשונית
    updatePosition();

    return () => {
      throttledUpdate.cancel();
    };
  }, [throttledUpdate, updatePosition]);

  return [containerRef, position];
}
