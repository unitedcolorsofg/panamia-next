import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signEvent, verifyEvent } from '../lib/nostr/sign.js';
import {
  generateKeypair,
  secretKeyHexFromNsec,
  publicKeyHexFromSecret,
} from '../lib/nostr/keys.js';

// Unit tests for the server-side signature verification that backs BYO Nostr
// key enrollment (app/api/relay/enroll). Pure crypto — no relay needed.

test('verifyEvent accepts a correctly signed event', () => {
  const { privateKeyHex } = generateKeypair();
  const ev = signEvent(privateKeyHex, {
    kind: 27235,
    tags: [
      ['t', 'pana-key-enrollment'],
      ['pana_user', 'user_123'],
    ],
    content: '',
  });
  assert.equal(verifyEvent(ev), true);
});

test('verifyEvent rejects a tampered pubkey (squatting attempt)', () => {
  const victim = generateKeypair();
  const ev = signEvent(victim.privateKeyHex, {
    kind: 27235,
    tags: [['t', 'pana-key-enrollment']],
    content: '',
  });
  // Attacker claims a different pubkey but keeps the victim's signature.
  const forged = { ...ev, pubkey: generateKeypair().publicKeyHex };
  assert.equal(verifyEvent(forged), false);
});

test('verifyEvent rejects tampered content', () => {
  const { privateKeyHex } = generateKeypair();
  const ev = signEvent(privateKeyHex, {
    kind: 27235,
    tags: [['t', 'pana-key-enrollment']],
    content: 'original',
  });
  const tampered = { ...ev, content: 'changed' };
  assert.equal(verifyEvent(tampered), false);
});

test('verifyEvent rejects a bad signature', () => {
  const { privateKeyHex } = generateKeypair();
  const ev = signEvent(privateKeyHex, {
    kind: 27235,
    tags: [],
    content: '',
  });
  const bad = { ...ev, sig: 'f'.repeat(128) };
  assert.equal(verifyEvent(bad), false);
});

test('secretKeyHexFromNsec round-trips with generateKeypair', () => {
  const kp = generateKeypair();
  const skHex = secretKeyHexFromNsec(kp.nsec);
  assert.equal(skHex, kp.privateKeyHex);
  assert.equal(publicKeyHexFromSecret(skHex), kp.publicKeyHex);
});

test('secretKeyHexFromNsec rejects an npub and garbage', () => {
  const kp = generateKeypair();
  assert.throws(() => secretKeyHexFromNsec(kp.npub)); // not an nsec
  assert.throws(() => secretKeyHexFromNsec('nsec1notvalid'));
});

test('BYO proof: decode nsec, sign locally, server verifies', () => {
  // Simulates the browser path: user pastes nsec -> decode -> sign proof.
  const kp = generateKeypair();
  const skHex = secretKeyHexFromNsec(kp.nsec);
  const proof = signEvent(skHex, {
    kind: 27235,
    tags: [
      ['t', 'pana-key-enrollment'],
      ['pana_user', 'user_abc'],
    ],
    content: 'Link this Nostr key to my Pana profile',
  });
  assert.equal(verifyEvent(proof), true);
  assert.equal(proof.pubkey, kp.publicKeyHex);
});
