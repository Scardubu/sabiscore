/**
 * Error Handling Utilities for SabiScore
 * 
 * Comprehensive error handling with:
 * - Typed error classes
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Error tracking and reporting
 * - Fallback mechanisms
 */

// ============================================================================
// Error Types
// ============================================================================

export class SabiScoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SabiScoreError';
  }
}

export class NetworkError extends SabiScoreError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', undefined, true, context);
    this.name = 'NetworkError';
  }
}

export class APIError extends SabiScoreError {
  constructor(
    message: string,
    statusCode: number,
    code: string = 'API_ERROR',
    context?: Record<string, unknown>
  ) {
    // 5xx errors are retryable
    const retryable = statusCode >= 500 && statusCode < 600;
    super(message, code, statusCode, retryable, context);
    this.name = 'APIError';
  }
}

export class ValidationError extends SabiScoreError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, false, context);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends SabiScoreError {
  constructor(message: string = 'Request timed out', context?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', 408, true, context);
    this.name = 'TimeoutError';
  }
}

export class ModelError extends SabiScoreError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MODEL_ERROR', 500, true, context);
    this.name = 'ModelError';
  }
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const shouldRetry = options.shouldRetry 
        ? options.shouldRetry(error, attempt)
        : isRetryableError(error);
      
      if (!shouldRetry || attempt >= config.maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = config.initialDelayMs * Math.pow(config.backoffFactor, attempt);
      const jitter = Math.random() * 0.3 * baseDelay;
      const delay = Math.min(baseDelay + jitter, config.maxDelayMs);
      
      options.onRetry?.(error, attempt);
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// ============================================================================
// Circuit Breaker Pattern
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenRequests?: number;
}

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenRequests: 1,
};

export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  
  // Get or initialize circuit breaker state
  let state = circuitBreakers.get(key);
  if (!state) {
    state = { failures: 0, lastFailure: 0, state: 'closed' };
    circuitBreakers.set(key, state);
  }
  
  const now = Date.now();
  
  // Check if circuit should transition from open to half-open
  if (state.state === 'open' && now - state.lastFailure >= config.resetTimeoutMs) {
    state.state = 'half-open';
  }
  
  // If circuit is open, fail fast
  if (state.state === 'open') {
    throw new SabiScoreError(
      `Circuit breaker open for ${key}`,
      'CIRCUIT_BREAKER_OPEN',
      503,
      true
    );
  }
  
  try {
    const result = await fn();
    
    // Success - reset circuit breaker
    state.failures = 0;
    state.state = 'closed';
    
    return result;
  } catch (error) {
    state.failures++;
    state.lastFailure = now;
    
    // Check if we should open the circuit
    if (state.failures >= config.failureThreshold) {
      state.state = 'open';
    }
    
    throw error;
  }
}

// ============================================================================
// Fallback Pattern
// ============================================================================

export type FallbackFn<T> = () => Promise<T>;

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: FallbackFn<T>,
  options: {
    onPrimaryError?: (error: unknown) => void;
    onFallbackUsed?: () => void;
  } = {}
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    options.onPrimaryError?.(error);
    options.onFallbackUsed?.();
    return fallback();
  }
}

export async function withFallbackChain<T>(
  fns: Array<() => Promise<T>>,
  options: {
    onError?: (error: unknown, index: number) => void;
  } = {}
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < fns.length; i++) {
    try {
      return await fns[i]();
    } catch (error) {
      lastError = error;
      options.onError?.(error, i);
    }
  }
  
  throw lastError ?? new SabiScoreError('All fallbacks failed', 'FALLBACK_CHAIN_EXHAUSTED');
}

// ============================================================================
// Request Timeout
// ============================================================================

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs);
  });
  
  return Promise.race([fn(), timeoutPromise]);
}

// ============================================================================
// Error Classification
// ============================================================================

export function isRetryableError(error: unknown): boolean {
  if (error instanceof SabiScoreError) {
    return error.retryable;
  }
  
  if (error instanceof Error) {
    // Network errors are usually retryable
    if (error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')) {
      return true;
    }
  }
  
  return false;
}

export function isClientError(error: unknown): boolean {
  if (error instanceof SabiScoreError && error.statusCode) {
    return error.statusCode >= 400 && error.statusCode < 500;
  }
  return false;
}

export function isServerError(error: unknown): boolean {
  if (error instanceof SabiScoreError && error.statusCode) {
    return error.statusCode >= 500;
  }
  return false;
}

// ============================================================================
// Error Tracking
// ============================================================================

interface ErrorTrackingEvent {
  timestamp: number;
  error: string;
  code: string;
  context?: Record<string, unknown>;
}

const errorLog: ErrorTrackingEvent[] = [];
const MAX_ERROR_LOG_SIZE = 100;

export function trackError(error: unknown, context?: Record<string, unknown>): void {
  const event: ErrorTrackingEvent = {
    timestamp: Date.now(),
    error: error instanceof Error ? error.message : String(error),
    code: error instanceof SabiScoreError ? error.code : 'UNKNOWN',
    context,
  };
  
  errorLog.push(event);
  
  // Keep log bounded
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }
  
  // Log to console in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.error('[SabiScore Error]', event);
  }
}

export function getRecentErrors(limit: number = 10): ErrorTrackingEvent[] {
  return errorLog.slice(-limit);
}

export function clearErrorLog(): void {
  errorLog.length = 0;
}

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request took too long. Please try again.',
  VALIDATION_ERROR: 'Invalid input. Please check your data and try again.',
  MODEL_ERROR: 'Our prediction models are temporarily unavailable. Please try again later.',
  CIRCUIT_BREAKER_OPEN: 'Service temporarily unavailable. Please try again in a few moments.',
  API_ERROR: 'Something went wrong. Please try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof SabiScoreError) {
    return ERROR_MESSAGES[error.code] || error.message;
  }
  
  if (error instanceof Error) {
    // Try to match common error patterns
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES.TIMEOUT_ERROR;
    }
  }
  
  return ERROR_MESSAGES.UNKNOWN;
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Exports
// ============================================================================

export default {
  SabiScoreError,
  NetworkError,
  APIError,
  ValidationError,
  TimeoutError,
  ModelError,
  withRetry,
  withCircuitBreaker,
  withFallback,
  withFallbackChain,
  withTimeout,
  isRetryableError,
  isClientError,
  isServerError,
  trackError,
  getRecentErrors,
  clearErrorLog,
  getUserFriendlyMessage,
};
