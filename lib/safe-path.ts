/**
 * Validates a caller-supplied "send me back here afterwards" path.
 *
 * Any redirect target that arrives in a query string is attacker-controlled by
 * definition: a link reading `/welcome?next=https://evil.example` costs nothing
 * to send and, if honoured, turns our own domain into the credible first hop of
 * a phishing chain. The only safe answer is to accept nothing but a path on
 * this site and fall back when anything else shows up.
 *
 * Three rejections, each for a form browsers treat as off-site despite the
 * leading slash:
 *   - `//evil.example` is protocol-relative and resolves to another origin.
 *   - `/\evil.example` is normalised to the same thing by every major browser.
 *   - control characters smuggle a scheme past a naive prefix check once the
 *     value is stripped downstream.
 */
export function safeInternalPath(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }

  return value;
}
