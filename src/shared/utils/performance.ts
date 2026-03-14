// ===================================================
// Performance Utilities — כלי ביצועים
// ===================================================
// debounce, throttle, memoize, LRUCache
// ===================================================

// -------------------------------------------------
// debounce — השהיית הפעלה עד שהקריאות מפסיקות
// -------------------------------------------------
// משתמש: חיפוש (SearchBar), שמירת הגדרות
// -------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

// -------------------------------------------------
// throttle — הגבלת קצב הפעלה
// -------------------------------------------------
// משתמש: scroll handlers, resize events
// -------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  ms: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return throttled;
}

// -------------------------------------------------
// memoize — שמירת תוצאות חישוב
// -------------------------------------------------
// למאפיינים פשוטים עם ארגומנט יחיד (מחרוזת/מספר)
// -------------------------------------------------
export function memoize<A, R>(fn: (arg: A) => R, maxSize = 100): (arg: A) => R {
  const cache = new Map<A, R>();

  return (arg: A): R => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }

    const result = fn(arg);

    // הגבלת גודל — מוחקים את הערך הישן ביותר
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(arg, result);
    return result;
  };
}

// -------------------------------------------------
// LRUCache — מטמון LRU (Least Recently Used)
// -------------------------------------------------
// Generic — עובד עם כל סוג key/value
// תומך ב-TTL (זמן תפוגה)
// -------------------------------------------------
export interface LRUCacheOptions {
  /** מספר רשומות מקסימלי */
  maxSize: number;
  /** זמן תפוגה במילישניות (0 = ללא תפוגה) */
  ttlMs?: number;
}

interface CacheEntry<V> {
  value: V;
  createdAt: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(options: LRUCacheOptions) {
    this.maxSize = options.maxSize;
    this.ttlMs = options.ttlMs ?? 0;
  }

  /** קבלת ערך (מעדכן מיקום ל-"אחרון בשימוש") */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // בדיקת TTL
    if (this.ttlMs > 0 && Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // העברה לסוף (=אחרון בשימוש)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /** הוספת/עדכון ערך */
  set(key: K, value: V): void {
    // אם כבר קיים — מוחקים כדי לעדכן מיקום
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // אם הגענו למגבלה — מוחקים את הישן ביותר (ראשון ב-Map)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, createdAt: Date.now() });
  }

  /** בדיקה אם מפתח קיים (ולא פג תוקף) */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.ttlMs > 0 && Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /** מחיקת ערך */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /** ניקוי כל המטמון */
  clear(): void {
    this.cache.clear();
  }

  /** מספר רשומות */
  get size(): number {
    return this.cache.size;
  }

  /** ניקוי רשומות שפג תוקפן */
  prune(): number {
    if (this.ttlMs <= 0) return 0;

    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}

// -------------------------------------------------
// simpleHash — hash פשוט למחרוזות
// -------------------------------------------------
// NON-CRYPTOGRAPHIC hash function (djb2 variant).
// Used ONLY for generating LRU cache lookup keys
// (e.g., ClaudeService response cache).
//
// DO NOT use for security, integrity verification,
// or any scenario where collision resistance matters.
// For cryptographic needs, use Node.js `crypto` module.
// -------------------------------------------------
/**
 * Fast, non-cryptographic string hash (djb2 variant).
 * Returns a base-36 encoded 32-bit hash.
 *
 * **Security note:** This is NOT suitable for cryptographic
 * purposes. It is used solely for building LRU cache keys.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
