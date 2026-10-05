/**
 * Types for bare `import ... from 'next'` (Metadata, Viewport, and the legacy
 * Pages Router API types still referenced in a few files).
 *
 * Deliberately a side-effect import of vinext's own published declarations
 * rather than a tsconfig "paths" entry. vinext turns every paths entry into a
 * Vite alias, and Vite string aliases match by PREFIX — so a bare "next" entry
 * captured every next/* specifier that tsconfig did not map individually and
 * rewrote it to a path that does not exist on disk. That is what broke on the
 * vinext 1.0.0-beta.8 upgrade, whose router shim added a dynamic
 * import("next/error"): the build failed with UNLOADABLE_DEPENDENCY, and Vite's
 * dependency optimizer hit the same wall in `vinext dev`, where user
 * resolve.alias entries cannot override it.
 *
 * vinext's own shim map already resolves those specifiers correctly, including
 * react-server variants, so the mapping only had to get out of the way. This
 * import gives TypeScript the types without creating an alias. No real `next`
 * package is installed, so nothing competes with it.
 *
 * `vinext/types` resolves to vinext's next-shims-public declarations, which
 * pull in `@vinext/types/next`. That is what declares module "next" with
 * Metadata, Viewport and the upstream NextApiRequest/NextApiResponse.
 *
 * The specifier must stay non-relative. A relative one is TS2439 ("ambient
 * module declaration cannot reference module through relative module name"),
 * which `skipLibCheck` hides while silently contributing no types at all.
 */
import 'vinext/types';
