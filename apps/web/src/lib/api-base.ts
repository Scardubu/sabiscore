const DEFAULT_API_ORIGIN = "http://localhost:8000";

function normalizeOrigin(raw?: string): string {
  const value = (raw ?? DEFAULT_API_ORIGIN).trim();
  if (!value) {
    return DEFAULT_API_ORIGIN;
  }
  return value.replace(/\/+$/, "");
}

function ensureVersionedBase(origin: string): string {
  return /\/api\/v\d+$/i.test(origin)
    ? origin
    : `${origin}/api/v1`;
}

export const API_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_API_URL);
export const API_V1_BASE = ensureVersionedBase(API_ORIGIN);

export function buildApiUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${API_V1_BASE}/${trimmed}`;
}