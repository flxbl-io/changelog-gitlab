/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
    async redirects() {
        return [
          {
            source: '/',
            destination: '/changelog',
            permanent: true,
          },
        ]
      },
      async headers() {
        return [
          {
            source: '/:path*',
            headers: [
              {
                key: 'Cache-Control',
                value: 'no-store, must-revalidate',
              },
            ],
          },
        ]
      }
};

export default nextConfig;
