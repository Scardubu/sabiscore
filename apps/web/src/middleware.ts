import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP with a script-src nonce.
 *
 * Next.js App Router emits inline bootstrap/RSC scripts. The nonce is forwarded
 * on the request so Next.js can attach it to those scripts, then returned in the
 * response CSP. Browser data access remains same-origin: Next.js API routes are
 * the only public gateway to the FastAPI backend and provider credentials.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://media.api-sports.io https://flagcdn.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|icon).*)",
  ],
};
