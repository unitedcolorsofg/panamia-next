/**
 * Generates every app icon and splash screen size Android and iOS need, from
 * the two masters in `mobile/assets/`.
 *
 * This wraps `@capacitor/assets` rather than calling it directly from
 * package.json for two reasons, both of which are easy to get wrong by hand:
 *
 *   1. The native projects are not where the tool expects them. Capacitor
 *      normally puts them at `android/` and `ios/` in the repo root; this repo
 *      relocates them under `mobile/` so two large generated trees do not sit
 *      beside `app/` and `lib/`. The iOS path is especially unintuitive — the
 *      tool appends `App/Assets.xcassets`, so it must be pointed at
 *      `mobile/ios/App`, not `mobile/ios`.
 *
 *   2. It writes files this repo does not want. `@capacitor/assets` always
 *      generates a PWA set too, with no flag to turn it off, and drops it in
 *      the working directory as `icons/` plus a `public/manifest.webmanifest`.
 *      That manifest is actively harmful here: this site serves a *dynamic*
 *      manifest from `app/manifest.webmanifest/route.ts` that varies per
 *      panaverse surface, and a static file of the same name in `public/` is a
 *      real risk of shadowing it. The site's own icons are already committed
 *      under `public/logos/`, so the PWA output is pure collateral and is
 *      deleted below.
 *
 * Run this after replacing either master image. The generated files are
 * committed — they are part of the native projects, and regenerating them on
 * every build would mean an image pipeline in CI for assets that change maybe
 * twice a year.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Brand colours, matched to the artwork rather than chosen independently.
 *
 * The cream is the exact background of the logo files, so the splash image and
 * the colour behind it cannot disagree — a near-miss here shows up as a faint
 * rectangle around the splash on some devices. It is also the same value used
 * for the SplashScreen and StatusBar plugins in `capacitor.config.ts`; changing
 * one without the other reintroduces the seam.
 *
 * The navy is the darkest colour in the logo, used only where a dark-mode
 * variant is required.
 */
const CREAM = '#fff7ec';
const NAVY = '#001e33';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Leftovers from the PWA set described above. Paths are relative to the repo
 * root because that is where the tool writes them, regardless of --assetPath.
 */
const PWA_COLLATERAL = ['icons', 'public/manifest.webmanifest'];

function generate(): void {
  console.log('Generating native app icons and splash screens...\n');

  /**
   * Resolve the tool's own entry point and run it with this Node binary,
   * rather than shelling out to `npx capacitor-assets`.
   *
   * Spawning through a shell on Windows means executing a `.cmd` wrapper, which
   * Node now warns about because arguments are concatenated into a command line
   * instead of passed as an argv array. Resolving the JavaScript entry point
   * sidesteps the shell entirely, which is both quieter and identical on every
   * platform.
   */
  const cli = require.resolve('@capacitor/assets/bin/capacitor-assets');

  execFileSync(
    process.execPath,
    [
      cli,
      'generate',
      '--assetPath',
      'mobile/assets',
      '--androidProject',
      'mobile/android',
      // Not a typo: the tool appends `App/Assets.xcassets` to this path.
      '--iosProject',
      'mobile/ios/App',
      '--iconBackgroundColor',
      CREAM,
      '--iconBackgroundColorDark',
      NAVY,
      '--splashBackgroundColor',
      CREAM,
      '--splashBackgroundColorDark',
      NAVY,
    ],
    { cwd: ROOT, stdio: 'inherit' }
  );
}

function cleanUp(): void {
  for (const relativePath of PWA_COLLATERAL) {
    const target = resolve(ROOT, relativePath);

    if (!existsSync(target)) continue;

    rmSync(target, { recursive: true, force: true });
    console.log(`Removed unwanted PWA output: ${relativePath}`);
  }
}

try {
  generate();
  cleanUp();
  console.log(
    '\nDone. Run `yarn mobile:sync` to copy them into the native projects.'
  );
} catch (error) {
  // The tool prints its own diagnostics to stderr via stdio: 'inherit', so
  // repeating the stack here would bury them. Fail loudly instead, because a
  // half-generated icon set is the kind of thing that ships.
  console.error('\nAsset generation failed. See the output above.');
  process.exitCode = 1;

  // Still clean up: a failed run can leave the PWA collateral behind, and
  // `public/manifest.webmanifest` must never survive, successful run or not.
  cleanUp();

  if (process.env.DEBUG) console.error(error);
}
