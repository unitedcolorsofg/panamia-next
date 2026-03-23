import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'path';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Shim for external/activities.next which imports Next.js internals.
      'next/dist/shared/lib/constants': path.resolve(
        './lib/shims/next-constants.js'
      ),
      // better-auth@1.5.6 imports 'next/headers.js' (explicit .js extension);
      // Vite's tsconfig-paths alias only covers 'next/headers', so add both.
      'next/headers.js': path.resolve(
        './node_modules/vinext/dist/shims/headers.js'
      ),
      // Explicit @/ alias so the CF Workers module runner gets a resolvable
      // absolute path instead of the // double-slash from vite-tsconfig-paths.
      '@': path.resolve('./'),
    },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
