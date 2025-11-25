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
          fontSize: 120,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#22C55E',
          borderRadius: 40,
          fontWeight: 'bold',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        S
      </div>
    ),
    {
      ...size,
    }
  );
}
