/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Experimental features for better performance
  experimental: {
    // Enable server components optimization
    serverComponentsExternalPackages: [],
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
    // Fail build on ESLint errors in production
    ignoreDuringBuilds: false,
  },
  
  // Image optimization
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
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
    // Audio worklet support
    config.module.rules.push({
      test: /\.worklet\.(js|ts)$/,
      use: {
        loader: 'worklet-loader',
        options: {
          name: 'static/worklets/[hash].worklet.js',
        },
      },
    });
    
    // Fallback for Node.js modules in browser
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
  
  // Output configuration
  output: 'standalone',
  
  // Performance optimizations
  swcMinify: true,
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = withBundleAnalyzer(nextConfig);