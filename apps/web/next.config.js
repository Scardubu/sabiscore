/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  // Force all pages to be dynamic to avoid prerendering issues
  output: 'standalone',
  
  // Silence workspace root warning
  outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Enable experimental features for edge optimization
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
    // Reduce memory during build
    webpackMemoryOptimizations: true,
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

module.exports = nextConfig
