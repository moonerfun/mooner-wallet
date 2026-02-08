/**
 * Error Handling Utilities
 * Type-safe error extraction for catch blocks
 */

/**
 * Extracts an error message from various error types
 * Use this instead of `(err as any).message` in catch blocks
 *
 * @example
 * try {
 *   await fetchData();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   setError(message);
 * }
 */
export function getErrorMessage(error: unknown): string {
  // Standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // String errors
  if (typeof error === "string") {
    return error;
  }

  // Objects with message property
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as Record<string, unknown>).message as string;
  }

  // Objects with error property
  if (
    error !== null &&
    typeof error === "object" &&
    "error" in error &&
    typeof (error as Record<string, unknown>).error === "string"
  ) {
    return (error as Record<string, unknown>).error as string;
  }

  // Fallback
  return "An unknown error occurred";
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(error: unknown, code: string | number): boolean {
  if (error !== null && typeof error === "object" && "code" in error) {
    return (error as Record<string, unknown>).code === code;
  }
  return false;
}

/**
 * Extract error code from various error types
 */
export function getErrorCode(error: unknown): string | number | undefined {
  if (error !== null && typeof error === "object" && "code" in error) {
    return (error as Record<string, unknown>).code as string | number;
  }
  return undefined;
}

/**
 * Check if error is a network/timeout error
 */
export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("connection") ||
    message.includes("econnrefused") ||
    hasErrorCode(error, "NETWORK_ERROR") ||
    hasErrorCode(error, "TIMEOUT")
  );
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const code = getErrorCode(error);
  return (
    code === 401 ||
    code === "401" ||
    code === "UNAUTHORIZED" ||
    hasErrorCode(error, "AUTH_ERROR")
  );
}

/**
 * Standard error response for API calls
 */
export interface ApiError {
  message: string;
  code?: string | number;
  details?: unknown;
}

/**
 * Convert any error to a standardized ApiError
 */
export function toApiError(error: unknown): ApiError {
  return {
    message: getErrorMessage(error),
    code: getErrorCode(error),
    details: error,
  };
}

/**
 * Wrap an async function with error handling
 * Returns a tuple of [result, error]
 *
 * @example
 * const [data, error] = await safeAsync(fetchData);
 * if (error) {
 *   console.error(error.message);
 *   return;
 * }
 * // data is typed correctly
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
): Promise<[T, null] | [null, ApiError]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, toApiError(error)];
  }
}
