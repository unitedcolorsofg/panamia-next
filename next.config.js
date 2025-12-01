/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,

  // Required for NextAuth v5 with Next.js 15 - fixes "Cannot find module 'next/server'" error
  // See: https://github.com/nextauthjs/next-auth/discussions/10058
  // See: https://github.com/nextauthjs/next-auth/issues/12280
  transpilePackages: ['next-auth'],

  // Skip ESLint during builds (Next.js 15 ESLint plugin has compatibility issues)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Required for Mongoose 8.x compatibility (moved from experimental in Next.js 15)
  serverExternalPackages: ['mongoose'],

  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.module.rules.push({
      test: '/pana/[username]',
      loader: 'raw-loader',
    });

    // Important: return the modified config
    return config;
  },
};

module.exports = nextConfig;
