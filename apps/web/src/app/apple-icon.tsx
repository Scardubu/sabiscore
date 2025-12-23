import '@/lib/patch-path-url-join';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 120,
            fontWeight: 700,
            color: '#22C55E',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          S
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
