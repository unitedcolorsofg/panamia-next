/**
 * The logger to use anywhere a request, a member or a database error is in
 * scope.
 *
 * Identical surface to `console`, so migrating a call site is a one-word
 * change, but every argument passes through `redact()` first. See
 * ./redact.ts for why that is done centrally rather than at each call site --
 * briefly, the worst leaks came from helpers that looked safe, not from
 * obviously careless logging.
 *
 * This is not a general-purpose logging framework and should not grow into
 * one. It exists so that "log this" and "leak this" stop being the same
 * action.
 *
 * `console` is still correct for build scripts, migrations and anything in
 * scripts/ that never sees member data.
 */

import { redact } from './redact';

type LogArgs = readonly unknown[];

const scrub = (args: LogArgs): unknown[] => args.map((arg) => redact(arg));

export const log = {
  debug(...args: LogArgs): void {
    console.debug(...scrub(args));
  },
  info(...args: LogArgs): void {
    console.log(...scrub(args));
  },
  warn(...args: LogArgs): void {
    console.warn(...scrub(args));
  },
  error(...args: LogArgs): void {
    console.error(...scrub(args));
  },
};

export { redact, redactString } from './redact';
