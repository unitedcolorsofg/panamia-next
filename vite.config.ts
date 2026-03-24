import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'path';
import vinext from 'vinext';
import { defineConfig, type Plugin } from 'vite';

// Workaround for vinext 0.0.32+ regression: toViteAliasReplacement() returns "/"
// for the project root, so "@/foo" → alias "@"→"/" → "/" + "/foo" = "//foo".
// Rollup treats "//foo" as an external protocol-relative URL and never bundles it,
// causing CF deploy error 10021 "No such module".
//
// Vite 6 per-environment configs are separate copies of the root config, so mutating
// config.resolve.alias in configResolved does not affect RSC environment resolution.
// Instead, this resolveId hook catches the already-mangled "//xxx" imports AFTER
// vite:pre-alias applies the broken alias, and re-resolves them to absolute paths.
// Remove once vinext fixes toViteAliasReplacement upstream.
let _projectRoot: string;
const fixAtAliasPlugin: Plugin = {
  name: 'fix-vinext-at-alias',
  enforce: 'pre',
  configResolved(config) {
    _projectRoot = config.root;
  },
  resolveId(id) {
    // Catch protocol-relative paths like "//auth", "//lib/db" produced by the broken
    // "@"→"/" alias, and resolve them to absolute filesystem paths for bundling.
    if (typeof id === 'string' && id.startsWith('//')) {
      return this.resolve(path.resolve(_projectRoot, id.slice(2)));
    }
  },
};

// Workaround for react-day-picker 9.x + date-fns 4.x + Rollup v4:
// noonDateLib.js does `import { getWeek as getWeekFn } from "date-fns"`.
// Rollup tree-shakes through `export * from "./getWeek.js"` in the date-fns index,
// then asks whether the sub-module exports `getWeekFn` (the local alias) instead of
// the original name `getWeek`, and throws MISSING_EXPORT as a hard error.
// Transform the file to strip the alias, using `getWeek` directly — same behavior.
// Remove once react-day-picker or Rollup fixes this.
const fixNoonDateLibPlugin: Plugin = {
  name: 'fix-noonDateLib-import',
  transform(code, id) {
    if (id.includes('react-day-picker') && id.endsWith('noonDateLib.js')) {
      // Strip all `originalName as originalNameFn` import aliases so Rollup doesn't
      // look for the Fn-suffixed name in the sub-module's named exports.
      const aliases: [RegExp, string][] = [
        [
          /\bdifferenceInCalendarDays as differenceInCalendarDaysFn\b/g,
          'differenceInCalendarDays',
        ],
        [
          /\bdifferenceInCalendarMonths as differenceInCalendarMonthsFn\b/g,
          'differenceInCalendarMonths',
        ],
        [/\bgetISOWeek as getISOWeekFn\b/g, 'getISOWeek'],
        [/\bgetWeek as getWeekFn\b/g, 'getWeek'],
      ];
      let result = code;
      for (const [pattern, replacement] of aliases) {
        // Remove the alias in the import declaration
        result = result.replace(pattern, replacement);
        // Rename all body usages of the Fn-suffixed local binding back to the original
        const fnName = replacement + 'Fn';
        result = result.replace(
          new RegExp(`\\b${fnName}\\b`, 'g'),
          replacement
        );
      }
      return { code: result, map: null };
    }
  },
};

export default defineConfig({
  build: {
    rollupOptions: {},
  },
  resolve: {
    alias: {
      // @opentelemetry/api is an optional instrumentation dep (e.g. in better-auth)
      // not available in CF Workers. Alias to an empty shim so the side-effect-only
      // import is satisfied without leaving an unresolvable external in the bundle
      // (which causes CF error 10021). rollupOptions.external doesn't work here —
      // it leaves the bare import in the output and CF Workers can't provide it.
      '@opentelemetry/api': path.resolve('./lib/shims/opentelemetry-api.js'),
      // Shim for external/activities.next which imports Next.js internals.
      'next/dist/shared/lib/constants': path.resolve(
        './lib/shims/next-constants.js'
      ),
      // better-auth@1.5.6 imports 'next/headers.js' (explicit .js extension);
      // Vite's tsconfig-paths alias only covers 'next/headers', so add both.
      'next/headers.js': path.resolve(
        './node_modules/vinext/dist/shims/headers.js'
      ),
    },
  },
  plugins: [
    fixAtAliasPlugin,
    fixNoonDateLibPlugin,
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
