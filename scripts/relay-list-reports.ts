// One-off: list NIP-56 abuse reports (kind 1984) on the relay.
// Tries an unauthenticated read first; if the relay demands NIP-42 AUTH,
// re-runs the query over an authenticated connection using a provided nsec.
//   node --import tsx scripts/relay-list-reports.ts [nsecHexOrBech32]
import WebSocket from 'ws';
import {
  RELAY_URL,
  type NostrEvent,
  connectAndAuth,
  request,
} from '../tests-relay/helpers';
import { npubFromHex } from '../lib/nostr/keys';

const WS_OPTIONS = {
  headers: { 'User-Agent': 'panamia-relay-tests/1.0 (+protocol smoke test)' },
};

function dump(events: NostrEvent[]) {
  const sorted = [...events].sort((a, b) => b.created_at - a.created_at);
  for (const ev of sorted) {
    const ts = new Date(ev.created_at * 1000).toISOString();
    const reporter = npubFromHex(ev.pubkey);
    const pTags = ev.tags.filter((t) => t[0] === 'p');
    const eTags = ev.tags.filter((t) => t[0] === 'e');
    const reportType = pTags[0]?.[2] ?? eTags[0]?.[2] ?? '(none)';
    console.log('─'.repeat(72));
    console.log(`id:        ${ev.id}`);
    console.log(`at:        ${ts}`);
    console.log(`reporter:  ${reporter}`);
    console.log(`type:      ${reportType}`);
    for (const t of pTags)
      console.log(`  reported pubkey: ${npubFromHex(t[1])}  ${t[2] ?? ''}`);
    for (const t of eTags)
      console.log(`  reported event:  ${t[1]}  ${t[2] ?? ''}`);
    console.log(`content:   ${JSON.stringify(ev.content)}`);
  }
  console.log('─'.repeat(72));
  console.log(`\n${events.length} report(s)`);
}

async function main() {
  const nsec = process.argv[2];
  const events: NostrEvent[] = [];
  let needAuth = false;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(RELAY_URL, WS_OPTIONS);
    const timer = setTimeout(() => {
      ws.close();
      resolve();
    }, 8_000);
    ws.on('open', () => {
      ws.send(
        JSON.stringify(['REQ', 'reports', { kinds: [1984], limit: 100 }])
      );
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT' && msg[1] === 'reports') events.push(msg[2]);
      else if (msg[0] === 'EOSE' && msg[1] === 'reports') {
        clearTimeout(timer);
        ws.close();
        resolve();
      } else if (msg[0] === 'CLOSED' && msg[1] === 'reports') {
        needAuth = /auth/i.test(msg[2] ?? '');
        console.log(`CLOSED: ${msg[2]}`);
        clearTimeout(timer);
        ws.close();
        resolve();
      } else if (msg[0] === 'AUTH') {
        needAuth = true;
        console.log(`Relay sent AUTH challenge (auth-required for reads)`);
      }
    });
  });

  if (events.length === 0 && needAuth && nsec) {
    const skHex = /^[0-9a-f]{64}$/i.test(nsec) ? nsec : decodeNsec(nsec);
    console.log('Retrying with NIP-42 AUTH…');
    const ws = await connectAndAuth(skHex);
    const result = await request(ws, 'reports', { kinds: [1984], limit: 100 });
    ws.close();
    if (result.closed) {
      console.log(`CLOSED: ${result.reason}`);
      return;
    }
    dump(result.events);
    return;
  }

  dump(events);
}

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function decodeNsec(s: string): string {
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
