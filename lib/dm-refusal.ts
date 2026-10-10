/**
 * The single refusal string for direct messages.
 *
 * It lives in its own module, with no imports, because both sides of the wire
 * need it and only one of them may have a database. dm-gate.ts returns it from
 * the server; the chat composer renders it in place of the input before a word
 * is typed. A client component cannot import dm-gate.ts -- that would pull
 * `lib/db` and the whole Drizzle schema into the browser bundle -- so without
 * this file the string would have to be typed out twice.
 *
 * Two copies is the failure mode worth avoiding, and not for tidiness. The
 * wording is a safety property: blocked, `nobody`, and `panas`-without-a-mutual
 * all produce this exact text so that a blocked sender cannot tell a block
 * apart from a closed inbox by contrast. A second copy is a second thing to
 * edit, and the edit that makes the client's copy friendlier is exactly the
 * one that breaks the property.
 *
 * @see lib/federation/wrappers/dm-gate.ts — the decisions behind it
 */
export const DIRECT_THREAD_REFUSED = 'Cannot send a message to this account';
