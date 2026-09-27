'use client';

/**
 * `isNativeApp()` as a hook that is safe to branch on during render.
 *
 * The plain function cannot be called in a component body. It reads a global
 * the native runtime injects into the page, which the server has no way to
 * know about, so using it directly would render one thing on the server and
 * another during hydration — a mismatch React resolves by discarding the
 * server HTML.
 *
 * The naive fix is state plus an effect, but that trades the mismatch for a
 * flash: every mount renders the browser version first and corrects it a frame
 * later. On a cold launch that is hidden behind the splash screen, but on an
 * in-app navigation it is plainly visible.
 *
 * `useSyncExternalStore` is the tool that distinguishes the two cases, because
 * it takes a separate server snapshot:
 *
 *   - Hydrating: returns the server snapshot (false), matching the HTML, then
 *     re-renders with the real value once hydration is committed.
 *   - Mounting after a client-side navigation: returns the real value
 *     immediately, because there is no server HTML to agree with.
 *
 * So the flash only exists where it cannot be seen.
 */

import { useSyncExternalStore } from 'react';
import { isNativeApp } from './native';

/**
 * Nothing to subscribe to: the Capacitor bridge is injected before any page
 * script runs and cannot appear or disappear during the life of the WebView.
 * A store that never changes still needs a subscribe function, so this is the
 * required no-op — returning an unsubscribe that does nothing.
 */
const subscribe = () => () => {};

const getSnapshot = () => isNativeApp();

/**
 * Always false. Not a guess about the request: the server genuinely cannot
 * know, since the WebView sends exactly the request a browser sends. False is
 * the answer that makes the server HTML valid in both places, with the app
 * correcting itself immediately after hydration.
 */
const getServerSnapshot = () => false;

export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
