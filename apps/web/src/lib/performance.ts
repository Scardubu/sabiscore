/**
 * Performance Monitoring & Optimization Utilities
 * ================================================
 * 
 * Production-ready performance tracking and optimization helpers
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private enabled: boolean;

  constructor() {
    // Only enable in production or when explicitly requested
    this.enabled = typeof window !== 'undefined' && 
      (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_PERF_MONITORING === 'true');
  }

  /**
   * Start tracking a performance metric
   */
  start(name: string): void {
    if (!this.enabled) return;
    this.metrics.set(name, performance.now());
  }

  /**
   * End tracking and report the metric
   */
  end(name: string): number | null {
    if (!this.enabled) return null;
    
    const startTime = this.metrics.get(name);
    if (!startTime) return null;

    const duration = performance.now() - startTime;
    this.metrics.delete(name);

    // Log to console in development, send to analytics in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    } else {
      // TODO: Send to analytics service (PostHog, Google Analytics, etc.)
      this.reportMetric({ name, duration, timestamp: Date.now() });
    }

    return duration;
  }

  /**
   * Measure async operation
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      return await fn();
    } finally {
      this.end(name);
    }
  }

  /**
   * Report metric to analytics (override in production)
   */
  private reportMetric(metric: PerformanceMetric): void {
    // Placeholder for analytics integration
    // Example: analytics.track('performance_metric', metric);
  }

  /**
   * Get Web Vitals for monitoring
   */
  reportWebVitals(metric: any): void {
    if (!this.enabled) return;

    // Core Web Vitals
    if (['FCP', 'LCP', 'CLS', 'FID', 'TTFB'].includes(metric.name)) {
      console.log(`[Web Vital] ${metric.name}:`, metric.value);
      
      // TODO: Send to analytics
      // analytics.track('web_vital', {
      //   name: metric.name,
      //   value: metric.value,
      //   rating: metric.rating,
      // });
    }
  }
}

// Export singleton
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for tracking component render performance
 */
export function usePerformanceTracking(componentName: string) {
  if (typeof window === 'undefined') return;

  const trackingId = `render:${componentName}`;
  
  // Track mount time
  React.useEffect(() => {
    performanceMonitor.start(trackingId);
    return () => {
      performanceMonitor.end(trackingId);
    };
  }, [trackingId]);
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Request idle callback polyfill
 */
export const requestIdleCallback =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback) => setTimeout(cb, 1);

/**
 * Cancel idle callback polyfill
 */
export const cancelIdleCallback =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : (id: number) => clearTimeout(id);

/**
 * Lazy load component when it enters viewport
 */
export function lazyLoadOnIntersection<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  options: IntersectionObserverInit = {}
): T {
  let Component: T | null = null;

  const LazyComponent = React.lazy(async () => {
    if (!Component) {
      const module = await loader();
      Component = module.default;
    }
    return { default: Component };
  });

  return LazyComponent as T;
}

// Fix React import
import React from 'react';
