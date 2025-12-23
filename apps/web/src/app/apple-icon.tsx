import '@/lib/patch-path-url-join';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label="SabiScore app icon"
      >
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" rx="40" fill="url(#bg)" />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="120"
          fontWeight="700"
          fill="#22C55E"
        >
          S
        </text>
      </svg>
    ),
    {
      ...size,
    }
  );
}
