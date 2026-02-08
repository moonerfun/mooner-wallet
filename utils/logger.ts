/**
 * Development-only logger utility
 * Prevents console spam in production builds
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('[MyComponent]', 'message');
 *   logger.warn('[MyHook]', 'warning');
 *   logger.error('[Store]', 'error', errorObject);
 */

type LogLevel = "log" | "warn" | "error" | "info" | "debug";

interface LoggerOptions {
  /** Enable logging (defaults to __DEV__) */
  enabled?: boolean;
  /** Prefix all messages with a tag */
  prefix?: string;
}

class Logger {
  private enabled: boolean;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.enabled = options.enabled ?? __DEV__;
    this.prefix = options.prefix ?? "";
  }

  private formatMessage(args: unknown[]): unknown[] {
    if (this.prefix) {
      return [this.prefix, ...args];
    }
    return args;
  }

  log(...args: unknown[]): void {
    if (this.enabled) {
      console.log(...this.formatMessage(args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.enabled) {
      console.warn(...this.formatMessage(args));
    }
  }

  error(...args: unknown[]): void {
    // Always log errors, even in production
    console.error(...this.formatMessage(args));
  }

  info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(...this.formatMessage(args));
    }
  }

  debug(...args: unknown[]): void {
    if (this.enabled) {
      console.debug(...this.formatMessage(args));
    }
  }

  /**
   * Create a scoped logger with a prefix
   */
  scope(prefix: string): Logger {
    return new Logger({
      enabled: this.enabled,
      prefix: this.prefix ? `${this.prefix}${prefix}` : prefix,
    });
  }

  /**
   * Log only occasionally (useful for high-frequency updates)
   * @param probability - Probability of logging (0-1), default 0.1 (10%)
   */
  sample(probability = 0.1, ...args: unknown[]): void {
    if (this.enabled && Math.random() < probability) {
      console.log(...this.formatMessage(args));
    }
  }

  /**
   * Time a function execution
   */
  time<T>(label: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      console.log(`${this.prefix}[${label}] took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(
        `${this.prefix}[${label}] failed after ${duration.toFixed(2)}ms`,
        error,
      );
      throw error;
    }
  }

  /**
   * Time an async function execution
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(`${this.prefix}[${label}] took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(
        `${this.prefix}[${label}] failed after ${duration.toFixed(2)}ms`,
        error,
      );
      throw error;
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Pre-configured scoped loggers for common modules
export const wsLogger = logger.scope("[WS] ");
export const storeLogger = logger.scope("[Store] ");
export const hookLogger = logger.scope("[Hook] ");

export { Logger };
