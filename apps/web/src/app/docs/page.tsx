import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 mb-8"
          >
            ← Back to Home
          </Link>
          <h1 className="text-5xl font-bold mb-4">
            Documentation
          </h1>
          <p className="text-xl text-slate-400">
            Learn how to use Sabiscore to maximize your betting edge
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Getting Started */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">
              Getting Started
            </h2>
            <ul className="space-y-3 text-slate-300">
              <li>• Create an account to access predictions</li>
              <li>• Review match predictions and value bets</li>
              <li>• Set up bankroll management</li>
              <li>• Track your betting performance</li>
            </ul>
          </div>

          {/* Key Metrics */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">
              Key Metrics
            </h2>
            <ul className="space-y-3 text-slate-300">
              <li>• <strong>Edge %</strong>: Your advantage over bookmaker odds</li>
              <li>• <strong>Confidence</strong>: Model certainty (0-100%)</li>
              <li>• <strong>Kelly</strong>: Recommended stake size</li>
              <li>• <strong>CLV</strong>: Closing Line Value tracking</li>
            </ul>
          </div>

          {/* Model Performance */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">
              Model Performance
            </h2>
            <ul className="space-y-3 text-slate-300">
              <li>• <strong>73.7%</strong> overall prediction accuracy</li>
              <li>• <strong>84.9%</strong> accuracy on high-confidence picks</li>
              <li>• <strong>+18.4%</strong> ROI on value bets</li>
              <li>• <strong>+₦60</strong> average closing line value vs Pinnacle</li>
            </ul>
          </div>

          {/* Technical Stack */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">
              Technical Stack
            </h2>
            <ul className="space-y-3 text-slate-300">
              <li>• <strong>Models</strong>: Ensemble (RF, XGB, LightGBM)</li>
              <li>• <strong>Features</strong>: 220+ engineered features</li>
              <li>• <strong>Data</strong>: 180k+ historical matches</li>
              <li>• <strong>Update</strong>: Live calibration every 180s</li>
            </ul>
          </div>

          {/* API Access */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 md:col-span-2">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">
              API Documentation
            </h2>
            <div className="space-y-4 text-slate-300">
              <p>
                Sabiscore provides a REST API for programmatic access to predictions:
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm">
                <div className="mb-2 text-green-400"># Get upcoming matches</div>
                <div>GET /api/v1/matches/upcoming</div>
                <div className="mt-4 mb-2 text-green-400"># Get match prediction</div>
                <div>GET /api/v1/matches/:id/prediction</div>
                <div className="mt-4 mb-2 text-green-400"># Get value bets</div>
                <div>GET /api/v1/bets/value</div>
              </div>
              <p className="text-sm text-slate-400">
                <strong>Note:</strong> Backend API deployment in progress. Full documentation coming soon.
              </p>
            </div>
          </div>

          {/* Support */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 md:col-span-2">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">
              Support & Resources
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold mb-2 text-slate-200">Community</h3>
                <p className="text-sm text-slate-400">
                  Join our Discord for tips, strategies, and support from fellow bettors.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-slate-200">Updates</h3>
                <p className="text-sm text-slate-400">
                  Follow us on Twitter for model updates, performance reports, and feature releases.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-slate-200">Contact</h3>
                <p className="text-sm text-slate-400">
                  Email support@sabiscore.com for technical issues or partnership inquiries.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/match"
            className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
          >
            Start Using Sabiscore
          </Link>
        </div>
      </div>
    </div>
  );
}
