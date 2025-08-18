/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Server external packages (moved from experimental in Next.js 15)
  serverExternalPackages: [],
  
  // Experimental features for better performance
  experimental: {
    // Optimize font loading
    optimizeCss: true,
  },
  
  // TypeScript configuration
  typescript: {
    // Fail build on TypeScript errors in production
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    // Allow build to complete with ESLint warnings for now
    ignoreDuringBuilds: true,
  },
  
  // Image optimization
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Public environment variables (accessible in browser)
  env: {},

  // Private environment variables are automatically available via process.env
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // WebSocket configuration for development
  async rewrites() {
    return [
      {
        source: '/api/ws/:path*',
        destination: 'http://localhost:8080/ws/:path*',
      },
    ];
  },
  
  // Webpack configuration for audio processing
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Audio processing support (worklet loader not needed for current implementation)
    
    // Fallback for Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Exclude test files from production build
    if (!dev) {
      config.module.rules.push({
        test: /\.(test|spec)\.(js|jsx|ts|tsx)$/,
        loader: 'ignore-loader',
      });
      
      // Ignore __tests__ directory in production
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.?\/?__tests__/,
        })
      );
    }
    
    return config;
  },
  
  // Development configuration
  env: {
    PORT: '3000'
  },
  
  // Output configuration
  output: 'standalone',
  
  // Performance optimizations (swcMinify is enabled by default in Next.js 15)
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = withBundleAnalyzer(nextConfig);