/**
 * Zustand Store Utilities
 *
 * Provides optimized selectors and utilities for zustand stores.
 * Based on MTT patterns for performance optimization.
 */

// In Zustand v5, useShallow is exported from 'zustand/react/shallow'
import type { StoreApi, UseBoundStore } from "zustand";
import { useShallow as zustandUseShallow } from "zustand/react/shallow";

// Re-export zustand's useShallow for convenience
export { zustandUseShallow as useShallow };

/**
 * Create a stable actions selector
 * Actions (functions) never change, so we can select them once
 *
 * @example
 * const actions = useStore(selectActions('setTokens', 'setLoading', 'reset'));
 */
export function selectActions<
  T extends Record<string, unknown>,
  K extends keyof T,
>(...keys: K[]): (state: T) => Pick<T, K> {
  return (state: T) => {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      result[key] = state[key];
    }
    return result;
  };
}

/**
 * Create a memoized selector for specific state paths
 *
 * @example
 * const selectSection = createSelector(
 *   (state: PulseState) => state.sections.new,
 *   (section) => ({ tokens: section.tokens, loading: section.loading })
 * );
 */
export function createSelector<T, S, R>(
  inputSelector: (state: T) => S,
  resultFn: (input: S) => R,
): (state: T) => R {
  let lastInput: S | undefined;
  let lastResult: R | undefined;

  return (state: T): R => {
    const input = inputSelector(state);

    // Shallow compare input using zustand's shallow function
    if (lastInput !== undefined && shallowEqual(lastInput, input)) {
      return lastResult!;
    }

    lastInput = input;
    lastResult = resultFn(input);
    return lastResult;
  };
}

/**
 * Simple shallow equality check for objects
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      (a as Record<string, unknown>)[key] !==
      (b as Record<string, unknown>)[key]
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Stable reference for store actions
 * Prevents re-renders when only actions are needed
 *
 * @example
 * const { setTokens, setLoading } = useStoreActions(usePulseStore, ['setTokens', 'setLoading']);
 */
export function useStoreActions<
  T extends Record<string, unknown>,
  K extends keyof T,
>(useStore: UseBoundStore<StoreApi<T>>, actionKeys: K[]): Pick<T, K> {
  // Actions are stable, so we can use a simple selector with zustand's useShallow
  return useStore(
    zustandUseShallow((state: T) => {
      const result = {} as Pick<T, K>;
      for (const key of actionKeys) {
        result[key] = state[key];
      }
      return result;
    }),
  );
}

/**
 * Subscribe to a specific state slice with shallow comparison
 *
 * @example
 * const tokens = useSlice(usePulseStore, s => s.sections.new.tokens);
 */
export function useSlice<T, S>(
  useStore: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => S,
): S {
  return useStore(zustandUseShallow(selector));
}

/**
 * Type helper for creating typed selectors
 */
export type Selector<T, R> = (state: T) => R;

/**
 * Combine multiple selectors into one
 */
export function combineSelectors<
  T,
  R extends Record<string, unknown>,
>(selectors: { [K in keyof R]: Selector<T, R[K]> }): Selector<T, R> {
  return (state: T) => {
    const result = {} as R;
    for (const key in selectors) {
      result[key] = selectors[key](state);
    }
    return result;
  };
}

// =============================================================================
// Async State Utilities - Reduce boilerplate for loading/error states
// =============================================================================

/**
 * Standard async operation state
 * Use this interface for consistent loading/error patterns across stores
 */
export interface AsyncState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Extended async state with data
 */
export interface AsyncStateWithData<T> extends AsyncState {
  data: T;
}

/**
 * Initial async state values
 */
export const INITIAL_ASYNC_STATE: AsyncState = {
  isLoading: false,
  error: null,
};

/**
 * Create initial async state with data
 */
export function createInitialAsyncState<T>(data: T): AsyncStateWithData<T> {
  return {
    ...INITIAL_ASYNC_STATE,
    data,
  };
}

/**
 * Async state setters type - use with Zustand set function
 */
export interface AsyncStateSetters {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Create async state slice for Zustand stores
 * Reduces boilerplate for common loading/error patterns
 *
 * @example
 * // In store definition:
 * export const useMyStore = create<MyState>((set) => ({
 *   ...createAsyncStateSlice(set),
 *   // other state and actions
 * }));
 *
 * // Slice includes:
 * // - isLoading: boolean
 * // - error: string | null
 * // - setLoading: (loading: boolean) => void
 * // - setError: (error: string | null) => void
 * // - clearError: () => void
 */
export function createAsyncStateSlice<T extends AsyncState>(
  set: (partial: Partial<T>) => void,
): AsyncState & AsyncStateSetters {
  return {
    isLoading: false,
    error: null,
    setLoading: (loading: boolean) => set({ isLoading: loading } as Partial<T>),
    setError: (error: string | null) =>
      set({ error, isLoading: false } as Partial<T>),
    clearError: () => set({ error: null } as Partial<T>),
  };
}

/**
 * Create multiple named async state slices
 * Useful for stores that track multiple async operations
 *
 * @example
 * const slices = createNamedAsyncSlices(set, ['fetch', 'submit', 'delete']);
 * // Creates: isFetchLoading, fetchError, isSubmitLoading, submitError, etc.
 */
export function createNamedAsyncSlices<
  T extends Record<string, unknown>,
  N extends string,
>(
  set: (partial: Partial<T>) => void,
  names: N[],
): Record<`is${Capitalize<N>}Loading`, boolean> &
  Record<`${N}Error`, string | null> &
  Record<`set${Capitalize<N>}Loading`, (loading: boolean) => void> &
  Record<`set${Capitalize<N>}Error`, (error: string | null) => void> {
  const result = {} as Record<string, unknown>;

  for (const name of names) {
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    const loadingKey = `is${capitalizedName}Loading`;
    const errorKey = `${name}Error`;

    result[loadingKey] = false;
    result[errorKey] = null;
    result[`set${capitalizedName}Loading`] = (loading: boolean) =>
      set({ [loadingKey]: loading } as Partial<T>);
    result[`set${capitalizedName}Error`] = (error: string | null) =>
      set({ [errorKey]: error, [loadingKey]: false } as Partial<T>);
  }

  return result as Record<`is${Capitalize<N>}Loading`, boolean> &
    Record<`${N}Error`, string | null> &
    Record<`set${Capitalize<N>}Loading`, (loading: boolean) => void> &
    Record<`set${Capitalize<N>}Error`, (error: string | null) => void>;
}

/**
 * Helper to run an async operation with automatic loading/error state management
 *
 * @example
 * const fetchData = async () => {
 *   await runAsync(
 *     () => api.fetchData(),
 *     set,
 *     (data) => set({ items: data }),
 *   );
 * };
 */
export async function runAsync<T, S extends AsyncState>(
  asyncFn: () => Promise<T>,
  set: (partial: Partial<S>) => void,
  onSuccess?: (result: T) => void,
  onError?: (error: string) => void,
): Promise<T | null> {
  set({ isLoading: true, error: null } as Partial<S>);

  try {
    const result = await asyncFn();
    set({ isLoading: false } as Partial<S>);
    onSuccess?.(result);
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "An error occurred";
    set({ isLoading: false, error: errorMessage } as Partial<S>);
    onError?.(errorMessage);
    return null;
  }
}
