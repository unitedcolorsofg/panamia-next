// One-off: fetch kind-0 profiles (anon-readable) for a set of npubs/hex keys,
// to characterize accounts referenced by abuse reports.
//   node --import tsx scripts/relay-profiles.ts <npubOrHex> [<npubOrHex> ...]
import WebSocket from 'ws';
import { RELAY_URL, type NostrEvent } from '../tests-relay/helpers';
import { npubFromHex } from '../lib/nostr/keys';

const WS_OPTIONS = {
  headers: { 'User-Agent': 'panamia-relay-tests/1.0 (+report triage)' },
};

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function npubToHex(s: string): string {
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
  const sep = s.lastIndexOf('1');
  const words: number[] = [];
  for (const ch of s.slice(sep + 1))
    words.push(CHARSET.indexOf(ch.toLowerCase()));
  const data = words.slice(0, -6);
  let acc = 0,
    bits = 0;
  const out: number[] = [];
  for (const v of data) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return out.map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const inputs = process.argv.slice(2);
  const authors = inputs.map(npubToHex);
  const byAuthor = new Map<string, NostrEvent>();

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(RELAY_URL, WS_OPTIONS);
    const timer = setTimeout(() => {
      ws.close();
      resolve();
    }, 8_000);
    ws.on('open', () =>
      ws.send(JSON.stringify(['REQ', 'profiles', { kinds: [0], authors }]))
    );
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT' && msg[1] === 'profiles') {
        const ev = msg[2] as NostrEvent;
        const prev = byAuthor.get(ev.pubkey);
        if (!prev || ev.created_at > prev.created_at)
          byAuthor.set(ev.pubkey, ev);
      } else if (
        (msg[0] === 'EOSE' || msg[0] === 'CLOSED') &&
        msg[1] === 'profiles'
      ) {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
  });

  for (const hex of authors) {
    const npub = npubFromHex(hex);
    const ev = byAuthor.get(hex);
    if (!ev) {
      console.log(`${npub.slice(0, 20)}…  (no kind-0 profile on relay)`);
      continue;
    }
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(ev.content);
    } catch {
      /* leave empty */
    }
    const fields = [
      'name',
      'display_name',
      'nip05',
      'about',
      'website',
      'lud16',
      'bot',
    ];
    const shown = fields
      .filter((f) => meta[f] != null && meta[f] !== '')
      .map((f) => `${f}=${JSON.stringify(meta[f])}`)
      .join('  ');
    console.log(`${npub.slice(0, 20)}…  ${shown || '(empty profile)'}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
