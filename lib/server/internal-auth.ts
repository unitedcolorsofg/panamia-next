import { NextRequest, NextResponse } from 'next/server';

// Gate for app/api/internal/* — the endpoints panamia-nosflare calls over its
// Cloudflare Service Binding.
//
// Those routes were written on the assumption that a Service Binding is the
// only way to reach them ("Service Bindings bypass the public network, so no
// HTTP-level auth is enforced here"). That is wrong. A Service Binding is one
// route in, not the only one: the path stays publicly addressable, and on
// 2026-08-07 all of them answered plain curl from the open internet —
// including the full member roster of a non-discoverable group, and
// group-event, which mutates roster state and would accept a well-formed
// kind-9022 leave for any pubkey from anyone.
//
// How the distinction is made:
//
// Cloudflare's edge stamps `cf-connecting-ip` (and `cf-ray`) onto every
// request that arrives from the internet. A Service Binding call does not
// traverse the edge — the caller's Request object is handed to this Worker
// directly, carrying only the headers the caller set — so those headers are
// absent. Their PRESENCE is therefore proof of a public request, which is the
// direction that matters here: we reject on positive evidence of public
// origin rather than trying to prove a negative.
//
// The bearer-token path is a second way in for a caller that legitimately
// needs to reach these over HTTP. It reuses CROSSPOST_AUTH_TOKEN, the secret
// already shared with the relay for article crossposting, rather than
// introducing another one. Nothing sends it today; it exists so an HTTP caller
// has a supported option that is not "remove the gate".

const PUBLIC_EDGE_HEADERS = ['cf-connecting-ip', 'cf-ray'] as const;

export interface InternalAuthEnv {
  CROSSPOST_AUTH_TOKEN?: string;
}

let cachedToken: string | null = null;

// Primed from worker/index.ts alongside getDb()/getRelay(), since Workers
// secrets are per-request env rather than process.env.
export function setInternalAuthToken(env?: InternalAuthEnv): void {
  if (env?.CROSSPOST_AUTH_TOKEN) cachedToken = env.CROSSPOST_AUTH_TOKEN;
}

function presentedToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

// Constant-time-ish comparison. Not a defence against a serious timing attack
// on a Worker, but there is no reason to leak the prefix for free.
function tokenMatches(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < presented.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Returns a 404 response when the request must be refused, or null to proceed.
//
// 404 rather than 401/403 on purpose: an unauthenticated caller learns nothing
// about whether the path exists, and there is no credential for them to go and
// fetch. The relay never sees this — it does not arrive through the edge.
export function denyPublicRequest(request: NextRequest): NextResponse | null {
  const edgeHeader = PUBLIC_EDGE_HEADERS.find((h) => request.headers.has(h));

  if (!edgeHeader) return null;

  const token = presentedToken(request);
  const expected = cachedToken ?? process.env.CROSSPOST_AUTH_TOKEN;
  if (token && expected && tokenMatches(token, expected)) return null;

  console.warn('[internal] rejected public request', {
    path: new URL(request.url).pathname,
    via: edgeHeader,
    ip: request.headers.get('cf-connecting-ip') ?? 'unknown',
    presentedToken: token ? 'invalid' : 'none',
  });

  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
