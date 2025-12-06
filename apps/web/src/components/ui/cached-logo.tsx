"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { cn } from "@/lib/utils";

/**
 * CachedLogo Component
 * ====================
 * 
 * A performant team/league logo component with:
 * - Lazy loading for images below the fold
 * - Automatic fallback chain (primary → fallbacks → placeholder)
 * - In-memory caching to avoid redundant network requests
 * - Smooth loading transitions
 * - Error boundary for failed loads
 * 
 * @version 1.0.0
 */

// In-memory cache for successful image loads
const IMAGE_CACHE = new Map<string, boolean>();

export interface CachedLogoProps {
  /** Primary URL to attempt loading */
  url?: string;
  /** Fallback URLs to try in order if primary fails */
  fallbackUrls?: string[];
  /** Alt text for accessibility */
  alt: string;
  /** Size in pixels (width and height) */
  size?: number;
  /** Emoji or text placeholder when all URLs fail */
  placeholder: string;
  /** Team/league colors for gradient background */
  colors?: string;
  /** Additional className for styling */
  className?: string;
  /** Loading priority - eager for above-fold, lazy for below */
  priority?: boolean;
  /** Callback when image successfully loads */
  onLoad?: () => void;
  /** Callback when all sources fail */
  onError?: () => void;
}

/**
 * Generate a gradient background from team colors
 */
function getGradientFromColors(colors?: string): string {
  if (!colors) return "bg-slate-800";
  
  // Map emoji colors to Tailwind gradient stops
  const colorMap: Record<string, string> = {
    "🔴": "from-red-600",
    "🔵": "from-blue-600",
    "⚪": "from-slate-200",
    "⚫": "from-slate-900",
    "🟡": "from-yellow-500",
    "🟠": "from-orange-500",
    "💜": "from-purple-600",
    "💚": "from-green-600",
    "🍒": "from-red-700",
    "🍷": "from-purple-900",
  };
  
  const emojis = colors.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
  if (emojis.length >= 2) {
    const firstEmoji = emojis[0];
    const secondEmoji = emojis[1];
    if (firstEmoji && secondEmoji) {
      const from = colorMap[firstEmoji] || "from-slate-700";
      const to = colorMap[secondEmoji]?.replace("from-", "to-") || "to-slate-800";
      return `bg-gradient-to-br ${from} ${to}`;
    }
  }
  
  const firstEmoji = emojis[0];
  if (firstEmoji) {
    return colorMap[firstEmoji] || "bg-slate-800";
  }
  return "bg-slate-800";
}

/**
 * CachedLogo - Optimized team/league logo with fallback chain
 */
export const CachedLogo = memo(function CachedLogo({
  url,
  fallbackUrls = [],
  alt,
  size = 48,
  placeholder,
  colors,
  className,
  priority = false,
  onLoad,
  onError,
}: CachedLogoProps) {
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(url);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Reset state when url prop changes
  useEffect(() => {
    setCurrentUrl(url);
    setFallbackIndex(0);
    setHasError(false);
    setIsLoading(true);
  }, [url]);

  // Try next fallback URL on error
  const handleError = useCallback(() => {
    if (fallbackIndex < fallbackUrls.length) {
      // Try next fallback
      setCurrentUrl(fallbackUrls[fallbackIndex]);
      setFallbackIndex(prev => prev + 1);
    } else {
      // All fallbacks exhausted
      setHasError(true);
      setIsLoading(false);
      onError?.();
    }
  }, [fallbackIndex, fallbackUrls, onError]);

  const handleLoad = useCallback(() => {
    if (currentUrl) {
      IMAGE_CACHE.set(currentUrl, true);
      // Preload hint for next potential fallback
      if (priority && fallbackIndex === 0 && fallbackUrls.length > 0) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = fallbackUrls[0];
        document.head.appendChild(link);
      }
    }
    setIsLoading(false);
    onLoad?.();
  }, [currentUrl, onLoad, priority, fallbackIndex, fallbackUrls]);

  // Check cache on mount
  useEffect(() => {
    if (currentUrl && IMAGE_CACHE.has(currentUrl)) {
      setIsLoading(false);
    }
  }, [currentUrl]);

  // Size classes for common sizes (avoid inline styles)
  const sizeClasses: Record<number, string> = {
    12: "h-3 w-3",
    14: "h-3.5 w-3.5",
    16: "h-4 w-4",
    18: "h-[18px] w-[18px]",
    20: "h-5 w-5",
    24: "h-6 w-6",
    28: "h-7 w-7",
    32: "h-8 w-8",
    36: "h-9 w-9",
    40: "h-10 w-10",
    48: "h-12 w-12",
    56: "h-14 w-14",
    64: "h-16 w-16",
  };
  
  const fontSizeClasses: Record<number, string> = {
    12: "text-[0.5rem]",
    14: "text-[0.55rem]",
    16: "text-[0.625rem]",
    18: "text-[0.7rem]",
    20: "text-[0.625rem]",
    24: "text-xs",
    28: "text-xs",
    32: "text-sm",
    40: "text-base",
    48: "text-lg",
    56: "text-xl",
    64: "text-2xl",
  };
  
  // Get closest size class or use inline style as fallback
  const sizeClass = sizeClasses[size];
  const fontClass = fontSizeClasses[size] || fontSizeClasses[Math.min(...Object.keys(fontSizeClasses).map(Number).filter(k => k >= size))] || "text-base";
  
  // If no predefined class exists, we need to use inline styles
  const inlineStyle = sizeClass ? undefined : { width: size, height: size };
  
  const gradientBg = getGradientFromColors(colors);

  // Render placeholder when no URL or all sources failed
  if (!currentUrl || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full ring-1 ring-white/10 flex-shrink-0",
          gradientBg,
          sizeClass,
          className
        )}
        style={inlineStyle}
        role="img"
        aria-label={alt}
      >
        <span 
          className={cn("text-center leading-none", fontClass)}
        >
          {placeholder}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full ring-1 ring-white/10 flex-shrink-0",
        isLoading && gradientBg,
        sizeClass,
        className
      )}
      style={inlineStyle}
    >
      {/* Loading shimmer */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
      
      {/* Actual image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentUrl}
        alt={alt}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        fetchPriority={priority ? "high" : "low"}
        crossOrigin="anonymous"
        className={cn(
          "h-full w-full object-contain transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
});

/**
 * CountryFlag - Simple flag display using FlagCDN
 */
export interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code (e.g., 'GB', 'ES') */
  countryCode: string;
  /** Size in pixels */
  size?: number;
  /** Additional className */
  className?: string;
  /** Format: svg for sharp scaling, png for compatibility */
  format?: "svg" | "png";
}

export const CountryFlag = memo(function CountryFlag({
  countryCode,
  size = 24,
  className,
  format = "svg",
}: CountryFlagProps) {
  const url = format === "svg"
    ? `https://flagcdn.com/${countryCode.toLowerCase()}.svg`
    : `https://flagcdn.com/${size}x${Math.round(size * 0.75)}/${countryCode.toLowerCase()}.png`;

  return (
    <CachedLogo
      url={url}
      alt={`${countryCode} flag`}
      size={size}
      placeholder={`🏳️`}
      className={cn("rounded-sm", className)}
    />
  );
});

/**
 * TeamLogo - Convenience wrapper for team logos
 */
export interface TeamLogoProps {
  /** Team name for logo resolution */
  teamName: string;
  /** Pre-resolved logo URL */
  logoUrl?: string;
  /** Fallback URLs */
  fallbackUrls?: string[];
  /** Emoji placeholder */
  placeholder: string;
  /** Team colors for gradient fallback */
  colors?: string;
  /** Size in pixels */
  size?: number;
  /** Additional className */
  className?: string;
  /** Loading priority */
  priority?: boolean;
}

export const TeamLogo = memo(function TeamLogo({
  teamName,
  logoUrl,
  fallbackUrls,
  placeholder,
  colors,
  size = 40,
  className,
  priority = false,
}: TeamLogoProps) {
  return (
    <CachedLogo
      url={logoUrl}
      fallbackUrls={fallbackUrls}
      alt={`${teamName} logo`}
      size={size}
      placeholder={placeholder}
      colors={colors}
      className={className}
      priority={priority}
    />
  );
});

/**
 * LeagueLogo - Convenience wrapper for league logos
 */
export interface LeagueLogoProps {
  /** League name for logo resolution */
  leagueName: string;
  /** Pre-resolved logo URL */
  logoUrl?: string;
  /** Fallback URLs */
  fallbackUrls?: string[];
  /** Emoji placeholder */
  placeholder: string;
  /** Size in pixels */
  size?: number;
  /** Additional className */
  className?: string;
  /** Loading priority */
  priority?: boolean;
}

export const LeagueLogo = memo(function LeagueLogo({
  leagueName,
  logoUrl,
  fallbackUrls,
  placeholder,
  size = 32,
  className,
  priority = false,
}: LeagueLogoProps) {
  return (
    <CachedLogo
      url={logoUrl}
      fallbackUrls={fallbackUrls}
      alt={`${leagueName} logo`}
      size={size}
      placeholder={placeholder}
      className={cn("rounded-md", className)}
      priority={priority}
    />
  );
});

export default CachedLogo;
