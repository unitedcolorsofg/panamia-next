import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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

  experimental: {
    // Exclude @vercel/og from output file tracing — this app does not use next/og.
    // Without this, Next.js traces @vercel/og internals and opennextjs-cloudflare
    // bundles resvg.wasm + yoga.wasm + index.edge.js (~2.2 MiB) into the Worker.
    outputFileTracingExcludes: {
      '*': ['node_modules/next/dist/compiled/@vercel/og/**'],
    },
  },

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

    if (isServer) {
      // Stub out @vercel/og — this app does not use next/og.
      // Prevents resvg.wasm + yoga.wasm + index.edge.js (~2.2 MiB) from being
      // traced into .nft.json and subsequently bundled into the Cloudflare Worker.
      config.resolve.alias = {
        ...config.resolve.alias,
        'next/dist/compiled/@vercel/og': `${__dirname}/lib/stubs/vercel-og.js`,
      };
    }

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
