/**
 * Error Utilities
 * Safe helpers for error message handling to prevent React child errors
 */

import { parseApiError } from './api';

interface RollbarWindow extends Window {
  rollbar?: {
    error: (error: unknown, context?: Record<string, unknown>) => void;
  };
}

/**
 * Ensures the value is a primitive string suitable for rendering in React
 * Prevents "objects are not valid as a React child" errors
 */
export function safeMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (value === null || value === undefined) {
    return 'An error occurred';
  }
  
  // Handle Error objects
  if (value instanceof Error) {
    return value.message || 'An error occurred';
  }
  
  // Handle objects with message property
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return safeMessage((value as { message: unknown }).message);
  }
  
  // Fallback: stringify complex objects
  try {
    return JSON.stringify(value);
  } catch {
    return 'An error occurred';
  }
}

/**
 * Parse any error into a guaranteed string message
 * Combines parseApiError with safeMessage for complete safety
 */
export function safeErrorMessage(error: unknown): string {
  try {
    const parsed = parseApiError(error);
    return safeMessage(parsed.message);
  } catch {
    return 'An unexpected error occurred';
  }
}

/**
 * Format error for user display with optional fallback
 */
export function formatError(error: unknown, fallback = 'Something went wrong'): string {
  const msg = safeErrorMessage(error);
  return msg || fallback;
}

/**
 * Log error with structured context for monitoring
 */
export function logError(
  error: unknown,
  context?: {
    component?: string;
    action?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const errorInfo = {
    message: safeErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    ...context,
  };

  console.error('[SabiScore Error]', errorInfo);

  // Send to monitoring service if available
  if (typeof window !== 'undefined') {
    const rollbarWindow = window as RollbarWindow;
    if (rollbarWindow.rollbar) {
      rollbarWindow.rollbar.error(error, errorInfo);
    }
  }
}

/**
 * Create user-friendly error messages based on error type
 */
export function getUserFriendlyError(error: unknown): string {
  const msg = safeErrorMessage(error).toLowerCase();

  if (msg.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (msg.includes('network') || msg.includes('fetch failed')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (msg.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  if (msg.includes('not found') || msg.includes('404')) {
    return 'Requested resource not found.';
  }
  if (msg.includes('unauthorized') || msg.includes('401')) {
    return 'Authentication required. Please log in.';
  }
  if (msg.includes('forbidden') || msg.includes('403')) {
    return 'Access denied. You do not have permission.';
  }
  if (msg.includes('server') || msg.includes('500')) {
    return 'Server error. Our team has been notified.';
  }

  return safeErrorMessage(error);
}
