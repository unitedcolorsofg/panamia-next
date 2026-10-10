import { redirect } from 'next/navigation';

/**
 * Where to send somebody who needs to sign in, remembering where they were.
 *
 * Nothing here is guarded by middleware — `proxy.ts` sets headers and does
 * ActivityPub negotiation, and that is all. Every protected page therefore
 * gates itself, and the gate was hand-written each time. Thirty-odd copies in,
 * the copies had drifted: most remembered the destination, several sent the
 * member to a bare `/signin` and forgot it, and the ones that did remember
 * split between encoding the path and interpolating it raw.
 *
 * Forgetting is the expensive half. A member following a link to book a
 * mentoring session signs in and lands on the directory, with nothing on
 * screen connecting that to what they clicked. The usual reading is that the
 * sign-in failed, so they try again, and it "fails" again the same way.
 *
 * ## Why the encoding is not optional
 *
 * `callbackUrl` is a query parameter whose value is itself a URL. Interpolated
 * raw, the first `?` or `&` in the destination ends the value and the rest
 * becomes sibling parameters of `/signin`:
 *
 *     /signin?callbackUrl=/m/schedule/book?mentor=jose
 *     -> callbackUrl = "/m/schedule/book",  mentor = "jose"
 *
 * The member arrives at a booking form with no mentor, which cannot submit.
 * Encoding keeps the destination one opaque value, so it survives the round
 * trip whole.
 *
 * Pass a path and let this build the URL, rather than building it by hand.
 */
export function signInPath(callbackUrl: string): string {
  return `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Server-side counterpart: throws through Next's redirect and never returns,
 * so a caller may treat anything after it as proof of a signed-in session.
 *
 * `callbackUrl` is required rather than optional on purpose. A gate that
 * forgets where the member was going is the bug this module exists to stop,
 * and an optional argument is a bug you can ship by leaving something out.
 */
export function redirectToSignIn(callbackUrl: string): never {
  redirect(signInPath(callbackUrl));
}
