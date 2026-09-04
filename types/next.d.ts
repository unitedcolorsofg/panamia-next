/**
 * Types for bare `import ... from 'next'` (Metadata, Viewport, and the legacy
 * Pages Router API types still referenced in a few files).
 *
 * Deliberately an ambient declaration rather than a tsconfig "paths" entry.
 * vinext turns every paths entry into a Vite alias, and Vite string aliases
 * match by PREFIX — so a "next" -> lib/shims/next-root mapping captured every
 * next/* specifier that tsconfig did not map individually and rewrote it to a
 * lib/shims/next-root/* path that does not exist on disk (next-root is a file).
 * That is what broke on the vinext 1.0.0-beta.8 upgrade, whose router shim
 * added a dynamic import("next/error"): the build failed with
 * UNLOADABLE_DEPENDENCY, and Vite's dependency optimizer hit the same wall in
 * `vinext dev` where user resolve.alias entries cannot override it.
 *
 * vinext's own shim map already resolves those specifiers correctly, including
 * react-server variants, so the mapping only had to get out of the way. An
 * ambient module declaration gives TypeScript the same types without creating
 * an alias. No real `next` package is installed, so nothing competes with it.
 */
declare module 'next' {
  export * from '../lib/shims/next-root';
}
