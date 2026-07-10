// Read recent events for a NIP-29 group, regardless of kind, so we can see
// which kind the user's client publishes. Usage:
//   node --import tsx scripts/relay-list-recent.ts <nsec> <group> [limit]
import { connectAndAuth, request } from '../tests-relay/helpers';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Decode(s: string): { hrp: string; data: number[] } {
  const sep = s.lastIndexOf('1');
  const hrp = s.slice(0, sep).toLowerCase();
  const data: number[] = [];
  for (const ch of s.slice(sep + 1))
    data.push(CHARSET.indexOf(ch.toLowerCase()));
  return { hrp, data: data.slice(0, -6) };
}
function fromWords(words: number[]): Uint8Array {
  let acc = 0,
    bits = 0;
  const out: number[] = [];
  for (const v of words) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
function decodeNsec(b: string): string {
  const { data } = bech32Decode(b);
  return Array.from(fromWords(data))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

async function main() {
  const [, , nsec, group, limitArg] = process.argv;
  const limit = Number(limitArg ?? '20');
  const skHex = decodeNsec(nsec);
  const ws = await connectAndAuth(skHex);
  const result = await request(ws, 'list', {
    kinds: [9, 11, 12, 7, 10],
    '#h': [group],
    limit,
  });
  if (result.closed) {
    console.log(`CLOSED: ${result.reason}`);
  } else {
    const sorted = [...result.events].sort(
      (a, b) => b.created_at - a.created_at
    );
    for (const ev of sorted) {
      const ts = new Date(ev.created_at * 1000).toISOString();
      const author = ev.pubkey.slice(0, 8);
      console.log(
        `${ts}  kind=${ev.kind}  ${author}…  ${JSON.stringify(ev.content)}`
      );
    }
    console.log(`\n${result.events.length} events`);
  }
  ws.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
