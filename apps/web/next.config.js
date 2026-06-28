/** @type {import('next').NextConfig} */
const path = require('path');

// Bundle analyzer is loaded only when requested so normal dev startup does not
// require the optional analyzer package to be linked locally.
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({
        enabled: true,
        openAnalyzer: true,
      })
    : (config) => config;

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCsp() {
  const backendUrl = process.env.SABISCORE_BACKEND_URL || 'http://localhost:8000';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://media.api-sports.io https://flagcdn.com",
    "font-src 'self' data:",
    `connect-src 'self' ${backendUrl}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  output: process.env.NEXT_STANDALONE === 'true' ? 'standalone' : undefined,
  
  // Silence workspace root warning
  // outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Allow dev origins for browser preview
  allowedDevOrigins: [
    'http://127.0.0.1:3000',
    'http://127.0.0.1:*',
    'http://localhost:*',
    ...csv(process.env.ALLOWED_DEV_ORIGINS),
  ],
  
  // Enable experimental features for edge optimization
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-dropdown-menu', 
      '@radix-ui/react-select', 
      '@radix-ui/react-tooltip',
      'framer-motion'
    ],
    // Reduce memory during build
    webpackMemoryOptimizations: true,
    // Enable server actions for better performance
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  excludeDefaultMomentLocales: true,

  // Image optimization - disable for static export
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
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
          // X-XSS-Protection removed: deprecated and disabled by all modern browsers.
          // CSP below is the active XSS defense.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: buildCsp()
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // Cache JS/CSS chunks
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },

  // Rewrites for API proxy
  async rewrites() {
    const apiBaseUrl = process.env.SABISCORE_BACKEND_URL || 'http://localhost:8000';
    
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBaseUrl}/api/v1/:path*`,
      },
    ]
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // TypeScript errors during build
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Webpack optimization for memory-constrained environments
  webpack: (config, { isServer, webpack }) => {

    // Reduce memory usage
    // NOTE: Custom optimization disabled to avoid runtime chunk issues during build.
    // Using Next.js defaults for stability.
    // config.optimization = {
    //   ...config.optimization,
    //   moduleIds: 'deterministic',
    //   runtimeChunk: 'single',
    //   splitChunks: {
    //     chunks: 'all',
    //     cacheGroups: {
    //       default: false,
    //       vendors: false,
    //       // Vendor chunk for react/next
    //       framework: {
    //         name: 'framework',
    //         chunks: 'all',
    //         test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
    //         priority: 40,
    //         enforce: true,
    //       },
    //       // Radix UI components
    //       radix: {
    //         name: 'radix',
    //         test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
    //         priority: 30,
    //         reuseExistingChunk: true,
    //       },
    //       // Chart libraries
    //       charts: {
    //         name: 'charts',
    //         test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
    //         priority: 20,
    //         reuseExistingChunk: true,
    //       },
    //       // Other node_modules
    //       lib: {
    //         test: /[\\/]node_modules[\\/]/,
    //         name: 'lib',
    //         priority: 10,
    //         minChunks: 1,
    //         reuseExistingChunk: true,
    //       },
    //     },
    //   },
    // };
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
}

module.exports = withBundleAnalyzer(nextConfig)
