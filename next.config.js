/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,

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
