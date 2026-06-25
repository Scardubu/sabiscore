"use client";

import { useEffect, useRef } from "react";

interface UseScrollLockOptions {
  /** Optional callback returning the element that should be locked (defaults to document.body) */
  getElement?: () => HTMLElement | null;
}

/**
 * Disables body scrolling while overlays/modals are visible to prevent layout shift and background jitter.
 */
export function useScrollLock(active: boolean, options?: UseScrollLockOptions) {
  const previousOverflow = useRef<string | null>(null);
  const previousPaddingRight = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const target = options?.getElement?.() ?? document.body;
    if (!target) {
      return;
    }

    if (active) {
      previousOverflow.current = target.style.overflow;
      previousPaddingRight.current = target.style.paddingRight;

      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      target.style.overflow = "hidden";
      if (scrollBarWidth > 0) {
        target.style.paddingRight = `${scrollBarWidth}px`;
      }

      return () => {
        target.style.overflow = previousOverflow.current ?? "";
        target.style.paddingRight = previousPaddingRight.current ?? "";
      };
    }

    target.style.overflow = previousOverflow.current ?? "";
    target.style.paddingRight = previousPaddingRight.current ?? "";
  }, [active, options]);
}
