/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,

  // Rewrites to handle ActivityPub requests without trailing slash.
  // trailingSlash: true causes 308 redirects that remote servers won't follow.
  // Note: /p/:screenname rewrite removed — proxy.ts handles content negotiation.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/p/:screenname/inbox',
          destination: '/p/:screenname/inbox/',
        },
        { source: '/inbox', destination: '/inbox/' },
      ],
    };
  },
};

export default nextConfig;
