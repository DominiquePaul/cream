import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        // This will match all routes
        source: '/:path*',
        headers: [
          // Explicitly override the Permissions-Policy to remove browsing-topics
          {
            key: 'Permissions-Policy',
            value: ''
          },
          // Always set at least one header to avoid Next.js error
          {
            key: 'X-DreamStream-Mode',
            value: isDev ? 'development' : 'production'
          },
          // Only add security headers in production
          ...(isDev ? [] : [
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            },
            {
              key: 'X-Frame-Options',
              value: 'DENY'
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block'
            }
          ])
        ]
      },
    ];
  }
};

export default nextConfig;
