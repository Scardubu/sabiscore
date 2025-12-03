"use client";

import { useState, useEffect, useCallback } from "react";
import { Cookie, Shield, AlertTriangle, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsentPreferences {
  necessary: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
  ageVerified: boolean;
  responsibleGambling: boolean;
  timestamp: string;
  version: string;
}

const CONSENT_STORAGE_KEY = "sabiscore_consent_v1";
const CONSENT_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Hook: useConsent
// ---------------------------------------------------------------------------

export function useConsent() {
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ConsentPreferences;
        // Check version - if outdated, require re-consent
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed);
        }
      } catch {
        // Invalid stored consent
      }
    }
    setIsLoading(false);
  }, []);

  const saveConsent = useCallback((prefs: Omit<ConsentPreferences, "timestamp" | "version">) => {
    const fullConsent: ConsentPreferences = {
      ...prefs,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(fullConsent));
    setConsent(fullConsent);
  }, []);

  const clearConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    setConsent(null);
  }, []);

  const hasConsented = consent !== null && consent.ageVerified && consent.responsibleGambling;

  return { consent, saveConsent, clearConsent, isLoading, hasConsented };
}

// ---------------------------------------------------------------------------
// ConsentBanner Component
// ---------------------------------------------------------------------------

interface ConsentBannerProps {
  onConsentGiven?: (consent: ConsentPreferences) => void;
}

export function ConsentBanner({ onConsentGiven }: ConsentBannerProps) {
  const { consent: _consent, saveConsent, isLoading, hasConsented } = useConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(true);
  const [preferences, setPreferences] = useState({
    analytics: true,
    marketing: false,
    personalization: true,
  });

  // Don't render if already consented or still loading
  if (isLoading || hasConsented) {
    return null;
  }

  // Age verification gate first
  if (showAgeGate) {
    return (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-desc"
      >
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl">
            {/* Header */}
            <div className="mb-6 flex items-center justify-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <h2 id="age-gate-title" className="text-xl font-bold text-white">Age Verification Required</h2>
            </div>

            {/* Content */}
            <div className="mb-6 space-y-4 text-center">
              <p id="age-gate-desc" className="text-slate-300">
                SabiScore provides sports predictions that may be used for betting purposes.
              </p>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="font-semibold text-amber-300">
                  You must be 18 years or older to use this service.
                </p>
                <p className="mt-2 text-sm text-amber-200/70">
                  By continuing, you confirm you are of legal gambling age in your jurisdiction.
                </p>
              </div>
            </div>

            {/* Responsible Gambling Acknowledgment */}
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
                <Shield className="h-4 w-4 text-emerald-400" />
                Responsible Gambling
              </h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• Only bet what you can afford to lose</li>
                <li>• Predictions are estimates, not guarantees</li>
                <li>• Set limits and take breaks</li>
              </ul>
              <div className="mt-3 flex gap-2 text-xs">
                <a
                  href="https://www.begambleaware.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  BeGambleAware.org
                </a>
                <span className="text-slate-600">|</span>
                <a
                  href="https://www.gamcare.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  GamCare
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowAgeGate(false)}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-emerald-500 hover:to-emerald-400"
              >
                I am 18+ and accept responsible gambling guidelines
              </button>
              <button
                onClick={() => window.location.href = "https://www.begambleaware.org"}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-6 py-3 font-semibold text-slate-300 transition hover:bg-slate-700"
              >
                I am under 18 / Exit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // GDPR Cookie Consent Banner
  const handleAcceptAll = () => {
    const fullConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
      ageVerified: true,
      responsibleGambling: true,
    };
    saveConsent(fullConsent);
    onConsentGiven?.(fullConsent as ConsentPreferences);
  };

  const handleAcceptSelected = () => {
    const selectedConsent = {
      necessary: true,
      ...preferences,
      ageVerified: true,
      responsibleGambling: true,
    };
    saveConsent(selectedConsent);
    onConsentGiven?.(selectedConsent as ConsentPreferences);
  };

  const handleRejectNonEssential = () => {
    const minimalConsent = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false,
      ageVerified: true,
      responsibleGambling: true,
    };
    saveConsent(minimalConsent);
    onConsentGiven?.(minimalConsent as ConsentPreferences);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Cookie className="h-6 w-6 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Cookie & Privacy Settings</h2>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-slate-400">
          We use cookies to enhance your experience, analyze site traffic, and personalize content.
          You can customize your preferences below or accept all cookies.
        </p>

        {/* Detailed preferences (toggle) */}
        {showDetails && (
          <div className="mb-4 space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            {/* Necessary - always on */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Essential Cookies</p>
                <p className="text-xs text-slate-500">Required for the site to function</p>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-slate-500">Always on</span>
              </div>
            </div>

            {/* Analytics */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Analytics</p>
                <p className="text-xs text-slate-500">Help us improve by tracking usage patterns</p>
              </div>
              {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
              <button
                onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                aria-label={`Toggle analytics cookies: currently ${preferences.analytics ? 'enabled' : 'disabled'}`}
                aria-checked={preferences.analytics ? "true" : "false"}
                role="switch"
                className={`relative h-6 w-11 rounded-full transition ${
                  preferences.analytics ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    preferences.analytics ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Marketing */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Marketing</p>
                <p className="text-xs text-slate-500">Allow personalized advertisements</p>
              </div>
              {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
              <button
                onClick={() => setPreferences(p => ({ ...p, marketing: !p.marketing }))}
                aria-label={`Toggle marketing cookies: currently ${preferences.marketing ? 'enabled' : 'disabled'}`}
                aria-checked={preferences.marketing ? "true" : "false"}
                role="switch"
                className={`relative h-6 w-11 rounded-full transition ${
                  preferences.marketing ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    preferences.marketing ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Personalization */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Personalization</p>
                <p className="text-xs text-slate-500">Remember your preferences and settings</p>
              </div>
              {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
              <button
                onClick={() => setPreferences(p => ({ ...p, personalization: !p.personalization }))}
                aria-label={`Toggle personalization cookies: currently ${preferences.personalization ? 'enabled' : 'disabled'}`}
                aria-checked={preferences.personalization ? "true" : "false"}
                role="switch"
                className={`relative h-6 w-11 rounded-full transition ${
                  preferences.personalization ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    preferences.personalization ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAcceptAll}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 font-semibold text-white shadow transition hover:from-emerald-500 hover:to-emerald-400"
          >
            Accept All
          </button>
          <button
            onClick={handleRejectNonEssential}
            className="rounded-lg border border-slate-600 bg-slate-800 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            Essential Only
          </button>
          {showDetails ? (
            <button
              onClick={handleAcceptSelected}
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-5 py-2.5 font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
            >
              Save Preferences
            </button>
          ) : (
            <button
              onClick={() => setShowDetails(true)}
              className="text-sm text-slate-400 underline hover:text-slate-300"
            >
              Customize
            </button>
          )}
          
          {/* Privacy Policy Link */}
          <a
            href="/privacy"
            className="ml-auto text-sm text-slate-500 hover:text-slate-400 hover:underline"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConsentProvider - Wrap app with this to conditionally block content
// ---------------------------------------------------------------------------

interface ConsentProviderProps {
  children: React.ReactNode;
  requireConsent?: boolean;
}

export function ConsentProvider({ children, requireConsent = true }: ConsentProviderProps) {
  const { hasConsented, isLoading } = useConsent();

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {children}
      {requireConsent && !hasConsented && <ConsentBanner />}
    </>
  );
}

export default ConsentBanner;
