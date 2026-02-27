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
    },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
    {
      // vinext's font-google shim only has named exports for common fonts.
      // Append missing ones so Rollup's static analysis can resolve them.
      name: 'patch-font-google-missing-exports',
      transform(code: string, id: string) {
        if (!id.includes('vinext/dist/shims/font-google')) return;
        return (
          code +
          '\nexport const Rubik = createFontLoader("Rubik");\n' +
          'export const Nunito = createFontLoader("Nunito");\n'
        );
      },
    },
  ],
});
