import { cloudflare } from '@cloudflare/vite-plugin';
import fs from 'fs';
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

// Workaround for vinext 1.0.0-beta.5+: vinext turns the tsconfig "next" path mapping
// (-> lib/shims/next-root) into a Vite alias, and Vite string aliases match by PREFIX.
// So "next/headers.js" — which better-auth imports with an explicit .js extension —
// resolves to lib/shims/next-root/headers.js, which does not exist, and the build
// fails with UNLOADABLE_DEPENDENCY. The resolve.alias entries below used to win this
// race under vinext 0.2.x but no longer do, so intercept in a pre-plugin instead.
//
// The same prefix alias also swallows bare "next/<name>" specifiers that vinext's own
// shims use internally but tsconfig.json does not map — beta.8's router.js added a
// dynamic import("next/error") — so the extension is optional here.
//
// Only redirects when a matching vinext shim actually exists, so unrelated "next/*"
// specifiers (e.g. "next/font/google", "next/dist/shared/lib/constants") fall through
// to normal resolution untouched.
const fixNextExtensionImportsPlugin: Plugin = {
  name: 'fix-next-extension-imports',
  enforce: 'pre',
  resolveId(id) {
    if (typeof id !== 'string') return;
    // Match both the raw specifier and the form vite:alias has already rewritten
    // (next-root is a file, not a directory, so these paths never exist on disk).
    const match =
      /^next\/(.+)\.js$/.exec(id) ??
      /[\\/]lib[\\/]shims[\\/]next-root[\\/](.+?)(?:\.js)?$/.exec(id);
    if (!match) return;
    const shimDir = path.resolve('./node_modules/vinext/dist/shims');
    // Some shims ship a react-server variant (next/error, next/navigation, ...);
    // pick it in the RSC environment the way vinext's own export conditions would.
    const candidates =
      this.environment?.name === 'rsc'
        ? [`${match[1]}.react-server.js`, `${match[1]}.js`]
        : [`${match[1]}.js`];
    for (const candidate of candidates) {
      const shim = path.join(shimDir, candidate);
      if (fs.existsSync(shim)) return this.resolve(shim);
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

// Vite 8 + @vitejs/plugin-react v6 upgrade blocked:
//   - vinext dev server crashes with SyntaxError in worker runner (cloudflare/vinext#540, #585)
//   - Vite 8's Rolldown bundler breaks CJS deps in SSR dev (module is not defined)
//   - Revisit once vinext ships stable vite 8 dev support
export default defineConfig({
  build: {
    rollupOptions: {},
  },
  optimizeDeps: {
    // better-auth/next-js imports "next/headers.js" (explicit .js extension).
    // Vite's dependency pre-bundler runs its own resolution and never calls user
    // resolveId hooks, so fixNextExtensionImportsPlugin cannot rescue it there and
    // `vinext dev` dies during dep optimization. Excluding it from pre-bundling
    // routes the import through the normal plugin pipeline, where the fix applies.
    exclude: ['better-auth/next-js'],
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
      'next/router.js': path.resolve(
        './node_modules/vinext/dist/shims/router.js'
      ),
    },
  },
  plugins: [
    fixAtAliasPlugin,
    fixNextExtensionImportsPlugin,
    fixNoonDateLibPlugin,
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
