"use client";

import dynamic from "next/dynamic";

// These components are browser-only side effects (model warm-up, backend ping).
// Loaded client-side only to keep them out of the SSR/prerender bundle.
const ModelWarmup = dynamic(
  () => import("../components/model-warmup").then((m) => ({ default: m.ModelWarmup })),
  { ssr: false }
);
const BackendWarmup = dynamic(
  () => import("../components/backend-warmup").then((m) => ({ default: m.BackendWarmup })),
  { ssr: false }
);

export function ClientEffects() {
  return (
    <>
      <ModelWarmup />
      <BackendWarmup />
    </>
  );
}
