"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isClient, safeJsonParse } from "./utils";

/**
 * Centralized feature flag registry for runtime remote config.
 * Values default to safe fallbacks and can be overridden via:
 *  - window.__SABISCORE_FLAGS__ (injected by backend/Edge middleware)
 *  - localStorage (persisted toggles for QA)
 */
export enum FeatureFlag {
  PREDICTION_INTERSTITIAL_V2 = "PREDICTION_INTERSTITIAL_V2",
  PREMIUM_VISUAL_HIERARCHY = "PREMIUM_VISUAL_HIERARCHY",
  ASSET_AUDIT_V2 = "ASSET_AUDIT_V2",
}

const LOCAL_STORAGE_KEY = "sabiscore.featureFlags";

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  [FeatureFlag.PREDICTION_INTERSTITIAL_V2]: true,
  [FeatureFlag.PREMIUM_VISUAL_HIERARCHY]: false,
  [FeatureFlag.ASSET_AUDIT_V2]: false,
};

type FeatureFlagState = Record<FeatureFlag, boolean>;

interface FeatureFlagContextValue {
  flags: FeatureFlagState;
  isReady: boolean;
  setFlag: (flag: FeatureFlag, value: boolean) => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

function mergeFlags(
  base: FeatureFlagState,
  overrides?: Partial<Record<string, boolean>> | null
): FeatureFlagState {
  if (!overrides) {
    return base;
  }

  return Object.keys(base).reduce<FeatureFlagState>((acc, key) => {
    const enumKey = key as FeatureFlag;
    const overrideValue = overrides[enumKey];
    acc[enumKey] = typeof overrideValue === "boolean" ? overrideValue : base[enumKey];
    return acc;
  }, { ...base });
}

export function FeatureFlagProvider({
  initialFlags,
  children,
}: {
  initialFlags?: Partial<Record<FeatureFlag, boolean>>;
  children: React.ReactNode;
}) {
  const [flags, setFlags] = useState<FeatureFlagState>(() => ({
    ...FEATURE_FLAG_DEFAULTS,
    ...(initialFlags ?? {}),
  }));
  const [isReady, setIsReady] = useState(() => !isClient());

  useEffect(() => {
    if (!isClient()) return;

    const syncedFlags = (() => {
      const globalFlags = (window as typeof window & { __SABISCORE_FLAGS__?: Record<string, boolean> })
        .__SABISCORE_FLAGS__;
      const stored = safeJsonParse<Record<string, boolean> | null>(
        window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? "null",
        null
      );

      return mergeFlags(
        mergeFlags(flags, globalFlags),
        stored
      );
    })();

    setFlags((prev) => ({ ...prev, ...syncedFlags }));
    setIsReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isClient()) return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(flags));
    } catch {
      // Ignore storage quota errors
    }
  }, [flags]);

  const value = useMemo<FeatureFlagContextValue>(() => ({
    flags,
    isReady,
    setFlag: (flag, value) =>
      setFlags((prev) => ({
        ...prev,
        [flag]: value,
      })),
  }), [flags, isReady]);

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(flag: FeatureFlag, fallback?: boolean): boolean {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    throw new Error("useFeatureFlag must be used within FeatureFlagProvider");
  }

  if (!ctx.isReady) {
    return fallback ?? FEATURE_FLAG_DEFAULTS[flag];
  }

  return ctx.flags[flag] ?? FEATURE_FLAG_DEFAULTS[flag];
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    throw new Error("useFeatureFlags must be used within FeatureFlagProvider");
  }
  return ctx;
}

export function FeatureFlagGate({
  flag,
  children,
  fallback,
}: {
  flag: FeatureFlag;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const enabled = useFeatureFlag(flag);
  return enabled ? <>{children}</> : <>{fallback ?? null}</>;
}
