// Verify the relay accepts NIP-04 and NIP-17 DM events.
//
// We don't bother doing real ECDH/NIP-44 encryption — placeholders are
// fine because the relay only validates structure (signature, kind, tags),
// not ciphertext contents. The point is to prove which DM kinds make it
// through the auth + payment gates.
//
// Uses test-1 (sender, AUTH'd) and test-2 (recipient) from
// .relay-test-keypairs.json. Reads back from test-2's session to confirm
// storage and that the recipient can fetch their inbox.
import { readFileSync } from 'node:fs';
import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
  RELAY_URL,
  connectAndAuth,
  publish,
  request,
} from '../tests-relay/helpers';

interface KeyEntry {
  label: string;
  privateKey: string;
  publicKey: string;
}
interface Keyfile {
  keys: KeyEntry[];
}

function loadKeys(): { sender: KeyEntry; recipient: KeyEntry } {
  const raw = readFileSync('.relay-test-keypairs.json', 'utf8');
  const parsed = JSON.parse(raw) as Keyfile;
  const sender = parsed.keys.find((k) => k.label === 'test-1');
  const recipient = parsed.keys.find((k) => k.label === 'test-2');
  if (!sender || !recipient) {
    throw new Error('expected test-1 and test-2 entries in keyfile');
  }
  return { sender, recipient };
}

function randomThrowawayKey(): { skHex: string; pkHex: string } {
  const sk = schnorr.utils.randomSecretKey();
  const skHex = bytesToHex(sk);
  const pkHex = bytesToHex(schnorr.getPublicKey(hexToBytes(skHex)));
  return { skHex, pkHex };
}

async function main() {
  const { sender, recipient } = loadKeys();
  console.log(`relay:      ${RELAY_URL}`);
  console.log(`sender:     ${sender.publicKey}  (test-1, enrolled)`);
  console.log(`recipient:  ${recipient.publicKey}  (test-2, enrolled)\n`);

  // -----------------------------------------------------------------
  // NIP-04 (kind 4): legacy encrypted DM, signed by sender directly.
  // Sender pubkey + recipient p-tag are both visible to the relay.
  // -----------------------------------------------------------------
  console.log('[NIP-04] AUTH as sender ...');
  const senderWs = await connectAndAuth(sender.privateKey);
  console.log('[NIP-04] publish kind 4 -> recipient ...');
  const nip04Marker = `nip04-smoke-${Date.now()}`;
  const nip04Result = await publish(senderWs, sender.privateKey, {
    kind: 4,
    tags: [['p', recipient.publicKey]],
    content: `${nip04Marker}?iv=ivplaceholder`,
  });
  console.log(
    nip04Result.accepted
      ? `         OK accepted`
      : `         X rejected: "${nip04Result.reason}"`
  );
  senderWs.close();

  // -----------------------------------------------------------------
  // NIP-17 (kind 1059): gift-wrapped DM. Outer event is signed by a
  // throwaway key — relay must accept this even though the event pubkey
  // doesn't match the authenticated pubkey. nosflare carves this out at
  // durable-object.ts:852 (auth check), :879 (payment), :902 (allowlist).
  // -----------------------------------------------------------------
  console.log('\n[NIP-17] AUTH as sender ...');
  const wrapWs = await connectAndAuth(sender.privateKey);
  const throwaway = randomThrowawayKey();
  console.log(`[NIP-17] throwaway pubkey: ${throwaway.pkHex}`);
  console.log(
    '[NIP-17] publish kind 1059 -> recipient (signed by throwaway) ...'
  );
  const nip17Marker = `nip17-smoke-${Date.now()}`;
  const nip17Result = await publish(wrapWs, throwaway.skHex, {
    kind: 1059,
    tags: [['p', recipient.publicKey]],
    content: `${nip17Marker}-encrypted-placeholder`,
  });
  console.log(
    nip17Result.accepted
      ? `         OK accepted`
      : `         X rejected: "${nip17Result.reason}"`
  );
  wrapWs.close();

  // -----------------------------------------------------------------
  // Read back from the recipient's session so we know the event is
  // stored AND retrievable by the addressee.
  // -----------------------------------------------------------------
  console.log('\n[read]   AUTH as recipient and REQ both inboxes ...');
  const recipWs = await connectAndAuth(recipient.privateKey);

  const inbox04 = await request(recipWs, 'inbox-04', {
    kinds: [4],
    '#p': [recipient.publicKey],
    limit: 5,
  });
  const found04 = inbox04.events.find((e) => e.content.startsWith(nip04Marker));
  console.log(
    inbox04.closed
      ? `[NIP-04] read CLOSED: ${inbox04.reason}`
      : found04
        ? `[NIP-04] OK recipient sees the just-sent kind 4 (id ${found04.id.slice(0, 12)}...)`
        : `[NIP-04] X recipient REQ returned ${inbox04.events.length} kind 4 event(s) but not our marker`
  );

  const inbox17 = await request(recipWs, 'inbox-17', {
    kinds: [1059],
    '#p': [recipient.publicKey],
    limit: 5,
  });
  const found17 = inbox17.events.find((e) => e.content.startsWith(nip17Marker));
  console.log(
    inbox17.closed
      ? `[NIP-17] read CLOSED: ${inbox17.reason}`
      : found17
        ? `[NIP-17] OK recipient sees the gift-wrap (id ${found17.id.slice(0, 12)}..., signed by ${found17.pubkey.slice(0, 8)}...)`
        : `[NIP-17] X recipient REQ returned ${inbox17.events.length} kind 1059 event(s) but not our marker`
  );

  recipWs.close();
  console.log('\ndone.');
}

main().catch((err) => {
  console.error('dm test failed:', err);
  process.exit(1);
});
