/** @type {import('next').NextConfig} */
const path = require('path');

// Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  // Disable standalone output to avoid EBUSY file locking issues on Windows
  // output: 'standalone',
  
  // Silence workspace root warning
  // outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Allow dev origins for browser preview
  allowedDevOrigins: [
    'http://127.0.0.1:3000',
    'http://127.0.0.1:*',
    'http://localhost:*',
    // Handle Windows WSL/VM networking where dev server is exposed via LAN IP
    'http://192.168.96.40:*',
  ],
  
  // Enable experimental features for edge optimization
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-dropdown-menu', 
      '@radix-ui/react-select', 
      '@radix-ui/react-tooltip',
      'framer-motion',
      '@tensorflow/tfjs'
    ],
    // Reduce memory during build
    webpackMemoryOptimizations: true,
    // Enable server actions for better performance
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Turbopack configuration (mirrors webpack where needed)
  turbopack: {
    resolveAlias: {
      // Ensure TensorFlow.js resolves correctly
      '@tensorflow/tfjs': '@tensorflow/tfjs',
    },
  },

  // Disable styled-jsx to avoid SSR context issues
  compiler: {
    styledComponents: false,
    styledJsx: false,
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Explicitly exclude styled-jsx
  excludeDefaultMomentLocales: true,

  // Prevent heavy browser-only libraries from being bundled into the server output
  serverExternalPackages: ['chart.js', 'react-chartjs-2'],

  // Webpack optimization for production
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      // Optimize for production bundle size
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // TensorFlow.js in separate chunk
            tensorflow: {
              name: 'tensorflow',
              test: /[\\/]node_modules[\\/](@tensorflow)[\\/]/,
              priority: 40,
              reuseExistingChunk: true,
            },
            // Radix UI components
            radix: {
              name: 'radix-ui',
              test: /[\\/]node_modules[\\/](@radix-ui)[\\/]/,
              priority: 35,
              reuseExistingChunk: true,
            },
            // Chart.js
            charts: {
              name: 'charts',
              test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
              priority: 30,
              reuseExistingChunk: true,
            },
            // Framer Motion
            motion: {
              name: 'framer-motion',
              test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
              priority: 25,
              reuseExistingChunk: true,
            },
            // Common React chunks
            react: {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
            },
            // All other node_modules
            commons: {
              name: 'commons',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
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
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.football-data.org https://raw.githubusercontent.com;"
          },
        ],
      },
    ]
  },

  // Rewrites for API proxy
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBaseUrl}/api/v1/:path*`,
      },
    ]
  },

  // Skip ESLint during production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript errors during build
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Webpack optimization for memory-constrained environments
  webpack: (config, { isServer, webpack }) => {
    // Don't try to exclude styled-jsx - it's required by Next.js internally
    // Instead, ensure it's handled properly
    if (isServer) {
      // Ensure styled-jsx and React are properly externalized on server
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('styled-jsx');
      }
    }
    
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
