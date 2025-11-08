/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Removed 'output: export' - enables full Next.js features (API routes, SSR, ISR)
  
  // Enable experimental features for edge optimization
  experimental: {
    // ppr: true, // Partial Prerendering - requires Next.js canary
    optimizePackageImports: ['lucide-react', 'chart.js', 'react-chartjs-2'],
  },

  // Image optimization - disable for static export
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
        ],
      },
    ]
  },

  // Rewrites for API proxy
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*`
          : 'http://localhost:8000/api/v1/:path*',
      },
    ]
  },

  // Build output
  output: 'standalone',
  // Set outputFileTracingRoot to the repository root so Next can correctly
  // resolve shared files in a monorepo and avoid the "inferred workspace root"
  // warning when multiple lockfiles are present.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),

  // Skip ESLint during production builds to avoid blocking builds from
  // non-critical lint warnings/errors. CI should still run `npm run lint` on PRs
  // and the team should address warnings. This prevents Next.js from failing
  // the build when ESLint rules are still being iterated.
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Turbopack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
