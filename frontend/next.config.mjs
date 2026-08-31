/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Conditionally apply standalone output (for Docker), omit on Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  images: {
    domains: ['localhost', 'edutrack-saas-media.s3.amazonaws.com'],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://edutrack-backend-api.vercel.app/:path*',
      },
    ];
  },

  env: {
    BACKEND_INTERNAL_URL:
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001',
  },
};

export default nextConfig;