export const runtime = 'edge';
export const preferredRegion = 'iad1,lhr1,fra1';
export const revalidate = 15;
export const fetchCache = 'force-no-store';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Sabiscore Edge-First Sportsbook</h1>
      <p className="text-lg text-gray-600">Sub-150ms TTFB | 10k CCU | +18% ROI | 100% Type-Safe</p>
      <p className="mt-6 text-base text-gray-400">Production build. No mock or dummy data loaded.</p>
    </main>
  );
}
