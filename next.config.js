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

  // Backward-compat redirects for /social/* → new paths
  async redirects() {
    return [
      // Specific paths first (order matters — more specific before catch-all)
      { source: '/social/timeline', destination: '/timeline', permanent: true },
      {
        source: '/social/timeline/',
        destination: '/timeline/',
        permanent: true,
      },
      {
        source: '/social/status/:statusId',
        destination: '/status/:statusId',
        permanent: true,
      },
      {
        source: '/social/status/:statusId/',
        destination: '/status/:statusId/',
        permanent: true,
      },
      // Catch-all for actor profiles
      {
        source: '/social/:actor',
        destination: '/profile/:actor',
        permanent: true,
      },
      {
        source: '/social/:actor/',
        destination: '/profile/:actor/',
        permanent: true,
      },
    ];
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
