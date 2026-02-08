/**
 * Async State Utilities
 * Common patterns for async operations used across hooks and components
 */

import { useCallback, useRef, useState } from "react";

/**
 * State shape for async operations
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Initial state for async operations
 */
export function createInitialAsyncState<T>(
  initialData: T | null = null,
): AsyncState<T> {
  return {
    data: initialData,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook for managing async state with loading, error, and data
 * Includes built-in protection against concurrent fetches
 */
export function useAsyncState<T>(initialData: T | null = null) {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
  });
  const fetchingRef = useRef(false);

  const setLoading = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
  }, []);

  const setData = useCallback((data: T) => {
    setState({ data, isLoading: false, error: null });
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, isLoading: false, error }));
  }, []);

  const reset = useCallback(() => {
    setState({ data: initialData, isLoading: false, error: null });
  }, [initialData]);

  /**
   * Execute an async operation with automatic loading/error handling
   * Prevents concurrent executions
   */
  const execute = useCallback(
    async (operation: () => Promise<T>): Promise<T | null> => {
      if (fetchingRef.current) {
        console.log("[useAsyncState] Fetch already in progress, skipping");
        return null;
      }

      fetchingRef.current = true;
      setLoading();

      try {
        const result = await operation();
        setData(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return null;
      } finally {
        fetchingRef.current = false;
      }
    },
    [setLoading, setData, setError],
  );

  return {
    ...state,
    setLoading,
    setData,
    setError,
    reset,
    execute,
    isFetching: fetchingRef.current,
  };
}

/**
 * Hook for debounced fetch operations
 * Prevents rapid consecutive calls
 */
export function useDebouncedFetch<T>(delayMs: number = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fetch = useCallback(
    async (operation: () => Promise<T>): Promise<T | null> => {
      // Clear any pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      return new Promise((resolve) => {
        timerRef.current = setTimeout(async () => {
          if (fetchingRef.current) {
            resolve(null);
            return;
          }

          fetchingRef.current = true;
          setState((prev) => ({ ...prev, isLoading: true, error: null }));

          try {
            const result = await operation();
            setState({ data: result, isLoading: false, error: null });
            resolve(result);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown error";
            setState((prev) => ({ ...prev, isLoading: false, error: message }));
            resolve(null);
          } finally {
            fetchingRef.current = false;
          }
        }, delayMs);
      });
    },
    [delayMs],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    ...state,
    fetch,
    cancel,
  };
}
