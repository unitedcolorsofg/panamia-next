// One-off: list NIP-23 long-form articles (kind 30023) on the relay,
// WITHOUT NIP-42 AUTH — reads should be public.
import WebSocket from 'ws';
import { RELAY_URL, type NostrEvent } from '../tests-relay/helpers';
import { npubFromHex } from '../lib/nostr/keys';

const WS_OPTIONS = {
  headers: { 'User-Agent': 'panamia-relay-tests/1.0 (+protocol smoke test)' },
};

async function main() {
  const ws = new WebSocket(RELAY_URL, WS_OPTIONS);
  const events: NostrEvent[] = [];
  let authRequired = false;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 8_000);
    ws.on('open', () => {
      ws.send(
        JSON.stringify(['REQ', 'articles', { kinds: [30023], limit: 50 }])
      );
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT' && msg[1] === 'articles') events.push(msg[2]);
      else if (msg[0] === 'EOSE' && msg[1] === 'articles') {
        clearTimeout(timer);
        resolve();
      } else if (msg[0] === 'CLOSED' && msg[1] === 'articles') {
        authRequired = /auth/i.test(msg[2] ?? '');
        console.log(`CLOSED: ${msg[2]}`);
        clearTimeout(timer);
        resolve();
      } else if (msg[0] === 'AUTH') {
        console.log(
          `Relay sent AUTH challenge (auth-required for reads): ${msg[1]}`
        );
      }
    });
  });

  const sorted = events.sort((a, b) => b.created_at - a.created_at);
  for (const ev of sorted) {
    const ts = new Date(ev.created_at * 1000).toISOString();
    const title =
      ev.tags.find((t: string[]) => t[0] === 'title')?.[1] ?? '(no title)';
    const d = ev.tags.find((t: string[]) => t[0] === 'd')?.[1] ?? '';
    // Show the author as a bech32 npub (matches how the app/clients display
    // keys) rather than a raw hex pubkey.
    const npub = npubFromHex(ev.pubkey);
    console.log(
      `${ts}  ${npub.slice(0, 16)}…  d=${d}  title=${JSON.stringify(title)}`
    );
  }
  console.log(
    `\n${events.length} articles${authRequired ? ' (read blocked pending AUTH)' : ''}`
  );
  ws.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
