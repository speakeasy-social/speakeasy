import * as Toast from '#/view/com/util/Toast'

// Constants
const SLOW_REQUEST_THRESHOLD_MS = 8000
const TOAST_DEBOUNCE_MS = 10 * 60 * 1000 // 10 minutes

// Track last toast timestamps for debouncing
let lastWarningToastTime = 0
let lastErrorToastTime = 0

/**
 * Show a warning toast if a request is taking too long.
 * Debounced to show at most 1 warning per 10 minutes.
 */
export function showSlowRequestWarning(): void {
  const now = Date.now()
  if (now - lastWarningToastTime >= TOAST_DEBOUNCE_MS) {
    lastWarningToastTime = now
    Toast.show(
      'Speakeasy services are responding slowly. Some features may be delayed.',
      'clock',
    )
  }
}

/**
 * Show an error toast for service failures.
 * Debounced to show at most 1 error per 10 minutes.
 */
export function showServiceErrorToast(): void {
  const now = Date.now()
  if (now - lastErrorToastTime >= TOAST_DEBOUNCE_MS) {
    lastErrorToastTime = now
    Toast.show(
      'Speakeasy services are experiencing issues. Please try again later.',
      'exclamation-triangle',
    )
  }
}

/**
 * Check if an error is a network error or 5xx server error.
 */
export function isServiceError(error: unknown, response?: Response): boolean {
  // Check for 5xx status code
  if (response && response.status >= 500 && response.status < 600) {
    return true
  }

  // Check for network errors
  if (error instanceof TypeError) {
    // TypeError is thrown by fetch for network errors
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Common network error messages
    if (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('net::') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout')
    ) {
      return true
    }
  }

  return false
}

/**
 * Wraps a fetch call to monitor for slow requests and service errors.
 * Shows debounced toast notifications when issues are detected.
 *
 * @param fetchFn - The async function that performs the fetch
 * @returns The result of the fetch function
 */
export async function withHealthMonitoring<T>(fetchFn: () => Promise<T>): Promise<T> {
  let slowRequestTimeout: ReturnType<typeof setTimeout> | null = null

  // Set up timeout to show warning for slow requests
  slowRequestTimeout = setTimeout(() => {
    showSlowRequestWarning()
  }, SLOW_REQUEST_THRESHOLD_MS)

  try {
    const result = await fetchFn()
    return result
  } catch (error) {
    // Check if this is a service error (network or 5xx)
    if (isServiceError(error)) {
      showServiceErrorToast()
    }
    throw error
  } finally {
    // Clear the slow request timeout if it hasn't fired yet
    if (slowRequestTimeout) {
      clearTimeout(slowRequestTimeout)
    }
  }
}

/**
 * Check response for 5xx errors and show toast if needed.
 * Call this after getting a response but before checking response.ok
 */
export function checkResponseForServiceError(response: Response): void {
  if (response.status >= 500 && response.status < 600) {
    showServiceErrorToast()
  }
}

// For testing purposes - reset debounce timestamps
export function resetHealthMonitoringState(): void {
  lastWarningToastTime = 0
  lastErrorToastTime = 0
}
