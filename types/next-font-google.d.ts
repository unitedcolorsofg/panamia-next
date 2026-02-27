// Augment vinext's font-google shim to add fonts missing from the static list.
// The Vite transform plugin adds the JS exports at build time; this file
// provides the matching TypeScript declarations.
declare module 'next/font/google' {
  export { Nunito, Rubik } from 'vinext/shims/font-google';
}
