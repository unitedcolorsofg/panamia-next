// One-shot: AUTH and post a single kind 11 message into a NIP-29 group.
// Usage: yarn-style → node --import tsx scripts/relay-post-hello.ts <nsec> <group> <message>
import { connectAndAuth, publish } from '../tests-relay/helpers';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Decode(s: string): { hrp: string; data: number[] } {
  const sep = s.lastIndexOf('1');
  if (sep < 1) throw new Error('bech32: missing separator');
  const hrp = s.slice(0, sep).toLowerCase();
  const data: number[] = [];
  for (const ch of s.slice(sep + 1)) {
    const idx = CHARSET.indexOf(ch.toLowerCase());
    if (idx < 0) throw new Error(`bech32: bad char ${ch}`);
    data.push(idx);
  }
  return { hrp, data: data.slice(0, -6) };
}

function fromWords(words: number[]): Uint8Array {
  let acc = 0;
  let bits = 0;
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

function decodeNsec(bech: string): string {
  const { hrp, data } = bech32Decode(bech);
  if (hrp !== 'nsec') throw new Error(`expected nsec, got ${hrp}`);
  return Array.from(fromWords(data))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function main() {
  const [, , nsec, group, ...msgParts] = process.argv;
  if (!nsec || !group || msgParts.length === 0) {
    console.error(
      'usage: node --import tsx scripts/relay-post-hello.ts <nsec> <group> <message...>'
    );
    process.exit(1);
  }
  const message = msgParts.join(' ');
  const skHex = decodeNsec(nsec);
  const ws = await connectAndAuth(skHex);
  const result = await publish(ws, skHex, {
    kind: 9,
    tags: [['h', group]],
    content: message,
  });
  console.log(
    result.accepted
      ? `OK — posted to ${group}: "${message}"`
      : `REJECTED: ${result.reason}`
  );
  ws.close();
}

main().catch((err) => {
  console.error('post failed:', err);
  process.exit(1);
});
