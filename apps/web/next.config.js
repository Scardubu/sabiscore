/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  // Standalone output for optimized deployment
  output: 'standalone',
  
  // Silence workspace root warning
  outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Enable experimental features for edge optimization
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
    // Reduce memory during build
    webpackMemoryOptimizations: true,
  },

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
    const polyfillPath = path.resolve(__dirname, './src/polyfills.ts');

    if (config.entry) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        const entryKeys = [
          'main-app',
          'app',
          'pages/_app',
          'main',
        ];

        entryKeys.forEach((entryKey) => {
          const entryValue = entries[entryKey];
          if (!entryValue) {
            return;
          }

          if (Array.isArray(entryValue)) {
            if (!entryValue.includes(polyfillPath)) {
              entries[entryKey] = [polyfillPath, ...entryValue];
            }
            return;
          }

          if (typeof entryValue === 'string') {
            if (entryValue !== polyfillPath) {
              entries[entryKey] = [polyfillPath, entryValue];
            }
            return;
          }

          if (typeof entryValue === 'object' && entryValue.import) {
            const originalImport = Array.isArray(entryValue.import) ? entryValue.import : [entryValue.import];
            if (!originalImport.includes(polyfillPath)) {
              entryValue.import = [polyfillPath, ...originalImport];
            }
          }
        });

        return entries;
      };
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

    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.BannerPlugin({
        banner: `if (typeof globalThis.self === "undefined") { globalThis.self = globalThis; }
if (typeof globalThis.window === "undefined") { globalThis.window = globalThis; }
if (typeof globalThis.document === "undefined") { globalThis.document = { addEventListener: function() {}, removeEventListener: function() {}, createElement: function() { return {}; }, querySelector: function() { return null; }, querySelectorAll: function() { return []; }, setAttribute: function() {}, getElementById: function() { return null; }, body: {}, head: {} }; }
`,
        raw: true,
        entryOnly: false,
        test: /\.m?js$/,
      })
    );
    
    return config;
  },
}

module.exports = nextConfig
