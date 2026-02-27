import { cloudflare } from '@cloudflare/vite-plugin';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
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
        return code + '\nexport const Rubik = createFontLoader("Rubik");\n';
      },
    },
  ],
});
