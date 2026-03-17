/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BACKEND_URL || 'http://localhost:8000'
      : 'http://localhost:8000';
    
    return [
      {
        source: '/api/preview/:path*',
        destination: `${backendUrl}/preview/:path*`,
      },
      {
        source: '/api/process/:path*',
        destination: `${backendUrl}/process/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
