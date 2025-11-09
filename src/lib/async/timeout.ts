export function timeout(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within the specified time,
 * returns the fallback value instead.
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param fallbackValue - Value to return if the promise times out
 * @returns Promise that resolves to either the promise result or the fallback value
 */
export function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve =>
      setTimeout(() => resolve(fallbackValue), timeoutMs),
    ),
  ])
}
