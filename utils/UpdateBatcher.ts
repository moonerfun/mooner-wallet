/**
 * UpdateBatcher - Batches updates for smooth performance
 * Based on MTT's UpdateBatcher pattern
 *
 * This prevents the UI from freezing when receiving high-frequency WebSocket updates
 * by batching multiple updates into a single render cycle.
 */

import { storeLogger } from "./logger";

export class UpdateBatcher<T> {
  private queue: T[] = [];
  private scheduled = false;
  private flushCallback: (updates: T[]) => void;
  private isFlushing = false;
  private maxBatchSize: number;
  private throttleMs: number;
  private lastFlushTime = 0;
  private name: string;

  /**
   * Create a new UpdateBatcher
   * @param flushCallback - Function called with batched updates
   * @param maxBatchSize - Maximum updates to process per flush (default: 50)
   * @param throttleMs - Minimum time between flushes (default: 100ms for mobile)
   * @param name - Optional name for debugging
   */
  constructor(
    flushCallback: (updates: T[]) => void,
    maxBatchSize = 50,
    throttleMs = 100,
    name = "batcher",
  ) {
    this.flushCallback = flushCallback;
    this.maxBatchSize = maxBatchSize;
    this.throttleMs = throttleMs;
    this.name = name;
  }

  /**
   * Add an update to the queue
   */
  add(update: T): void {
    this.queue.push(update);
    this.scheduleFlush();
  }

  /**
   * Add multiple updates to the queue
   */
  addAll(updates: T[]): void {
    this.queue.push(...updates);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.scheduled || this.isFlushing) {
      return;
    }

    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;

    // Throttle flushes to prevent too many updates
    if (timeSinceLastFlush < this.throttleMs) {
      this.scheduled = true;
      const delay = this.throttleMs - timeSinceLastFlush;
      setTimeout(() => {
        this.scheduled = false;
        this.flush();
      }, delay);
      return;
    }

    this.scheduled = true;

    // Use setTimeout for reliability - requestAnimationFrame can be unreliable in RN
    setTimeout(() => {
      this.scheduled = false;
      this.flush();
    }, 16); // ~60fps
  }

  private flush(): void {
    if (this.queue.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    this.lastFlushTime = Date.now();

    try {
      // Take up to maxBatchSize items from the queue
      const updates = this.queue.splice(0, this.maxBatchSize);

      // Log flush for debugging (probability 0.1 = 10% of the time)
      storeLogger.sample(0.1, `${this.name} flush: ${updates.length} items`);

      this.flushCallback(updates);
    } finally {
      this.isFlushing = false;

      // If there are remaining items, schedule another flush
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Clear all pending updates
   */
  clear(): void {
    this.queue = [];
    this.scheduled = false;
    this.isFlushing = false;
  }

  /**
   * Get the current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Force flush all pending updates immediately
   */
  flushSync(): void {
    if (this.queue.length === 0) return;

    const updates = [...this.queue];
    this.queue = [];
    this.scheduled = false;
    this.flushCallback(updates);
  }
}

/**
 * Throttled update function - limits how often a function can be called
 */
export function createThrottledUpdater<T>(
  callback: (data: T) => void,
  throttleMs = 100,
): (data: T) => void {
  let lastUpdate = 0;
  let pendingData: T | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (data: T) => {
    const now = Date.now();
    pendingData = data;

    if (now - lastUpdate >= throttleMs) {
      lastUpdate = now;
      callback(data);
      pendingData = null;
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          if (pendingData !== null) {
            lastUpdate = Date.now();
            callback(pendingData);
            pendingData = null;
          }
          timeoutId = null;
        },
        throttleMs - (now - lastUpdate),
      );
    }
  };
}

/**
 * Debounced function - delays execution until after a pause in calls
 */
export function createDebouncedFn<T extends (...args: any[]) => void>(
  fn: T,
  delayMs = 200,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}
