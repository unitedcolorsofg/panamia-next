/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,

  // Required for NextAuth v5 with Next.js 15 - fixes "Cannot find module 'next/server'" error
  // See: https://github.com/nextauthjs/next-auth/discussions/10058
  // See: https://github.com/nextauthjs/next-auth/issues/12280
  transpilePackages: ['next-auth'],

  // Next.js 16 uses Turbopack by default - empty config to acknowledge
  turbopack: {},

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

  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.module.rules.push({
      test: '/pana/[username]',
      loader: 'raw-loader',
    });

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
