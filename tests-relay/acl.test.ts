import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RELAY_URL,
  connectAndAuth,
  publish,
  randomSecretKey,
  request,
} from './helpers.js';

// Test pubkeys come from the same .relay-test-keypairs.json that seeded the
// panamia-test group via scripts/seed-relay-test-data.ts. If those drift,
// re-run the seed before re-running this suite.
const here = dirname(fileURLToPath(import.meta.url));
const { keys } = JSON.parse(
  readFileSync(resolve(here, '..', '.relay-test-keypairs.json'), 'utf8')
) as { keys: Array<{ label: string; privateKey: string; publicKey: string }> };

const test1 = keys.find((k) => k.label === 'test-1');
if (!test1)
  throw new Error('test-1 keypair missing from .relay-test-keypairs.json');

const TEST_GROUP = 'panamia-test';

test(`baseline: relay reachable at ${RELAY_URL}`, async () => {
  const ws = await connectAndAuth(test1.privateKey);
  ws.close();
});

test('relay-wide gate: seeded member can publish kind 1', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await publish(ws, test1.privateKey, {
    kind: 1,
    tags: [],
    content: 'acl test plain ' + Date.now(),
  });
  ws.close();
  assert.equal(r.accepted, true, r.reason);
});

test('relay-wide gate: random pubkey rejected', async () => {
  const sk = randomSecretKey();
  const ws = await connectAndAuth(sk);
  const r = await publish(ws, sk, {
    kind: 1,
    tags: [],
    content: 'random ' + Date.now(),
  });
  ws.close();
  assert.equal(r.accepted, false);
  assert.match(r.reason, /not a panamia member/);
});

test('group write: kind 9 with valid h tag accepted', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await publish(ws, test1.privateKey, {
    kind: 9,
    tags: [['h', TEST_GROUP]],
    content: 'group msg ' + Date.now(),
  });
  ws.close();
  assert.equal(r.accepted, true, r.reason);
});

test('group write: kind 9 with no h tag rejected', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await publish(ws, test1.privateKey, {
    kind: 9,
    tags: [],
    content: 'no-h ' + Date.now(),
  });
  ws.close();
  assert.equal(r.accepted, false);
  assert.match(r.reason, /missing h tag/);
});

test('group write: kind 9 with foreign h tag rejected', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await publish(ws, test1.privateKey, {
    kind: 9,
    tags: [['h', 'other-group']],
    content: 'wrong-h ' + Date.now(),
  });
  ws.close();
  assert.equal(r.accepted, false);
  assert.match(r.reason, /not a member of this group/);
});

test('panamia-managed kind 9000 rejected for any author', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await publish(ws, test1.privateKey, {
    kind: 9000,
    tags: [],
    content: 'mod attempt',
  });
  ws.close();
  assert.equal(r.accepted, false);
  assert.match(r.reason, /panamia-managed/);
});

test('advisory kind 9021 accepted, marked forwarded', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await publish(ws, test1.privateKey, {
    kind: 9021,
    tags: [['h', TEST_GROUP]],
    content: '',
  });
  ws.close();
  assert.equal(r.accepted, true, r.reason);
  assert.match(r.reason, /advisory/);
});

test('REQ narrowing: member querying their group returns events', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  // Ensure at least one event exists for the group, so the query is meaningful
  // even on a freshly reset relay DB.
  await publish(ws, test1.privateKey, {
    kind: 9,
    tags: [['h', TEST_GROUP]],
    content: 'seed for read test ' + Date.now(),
  });
  const r = await request(ws, 'sub1', {
    kinds: [9],
    '#h': [TEST_GROUP],
    limit: 5,
  });
  ws.close();
  assert.equal(r.closed, false);
  assert.ok(r.events.length > 0, 'expected at least one event');
});

test('REQ narrowing: member querying foreign group → CLOSED restricted', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await request(ws, 'sub1', {
    kinds: [9],
    '#h': ['other-group'],
    limit: 5,
  });
  ws.close();
  assert.equal(r.closed, true);
  assert.match(r.reason ?? '', /restricted/);
});

test('REQ narrowing: random pubkey querying restricted kind → CLOSED', async () => {
  const sk = randomSecretKey();
  // AUTH may fail under the relay-wide gate first; some deploys allow AUTH
  // and gate at the EVENT/REQ layer instead. Tolerate both shapes.
  let ws;
  try {
    ws = await connectAndAuth(sk);
  } catch (err) {
    // AUTH-rejected randoms can't reach REQ at all; that's also a valid
    // restriction outcome for the matrix.
    assert.match(String(err), /AUTH rejected|not a panamia member/);
    return;
  }
  const r = await request(ws, 'sub1', { kinds: [9], limit: 5 });
  ws.close();
  assert.equal(r.closed, true);
  assert.match(r.reason ?? '', /restricted/);
});

test('NIP-29 metadata: REQ kind 39000 + #d=panamia-test returns signed event', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await request(ws, 'sub1', {
    kinds: [39000],
    '#d': [TEST_GROUP],
    limit: 1,
  });
  ws.close();
  assert.equal(r.closed, false);
  assert.ok(r.events.length > 0, 'expected a signed kind 39000 event');
  const ev = r.events[0];
  assert.equal(ev.kind, 39000);
  assert.ok(
    ev.tags.some((t) => t[0] === 'd' && t[1] === TEST_GROUP),
    'd tag matches group'
  );
  assert.ok(
    ev.tags.some((t) => t[0] === 'name'),
    'has name tag'
  );
});

test('NIP-29 metadata: member can read kind 39002 (member list)', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await request(ws, 'sub1', {
    kinds: [39002],
    '#d': [TEST_GROUP],
    limit: 1,
  });
  ws.close();
  assert.equal(r.closed, false);
  assert.ok(r.events.length > 0, 'expected a signed kind 39002 event');
  const ev = r.events[0];
  // d tag + at least one p tag (member roster). Both seeded pubkeys should
  // be present for the panamia-test group.
  const pTags = ev.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
  assert.ok(pTags.includes(test1.publicKey), 'member list contains test-1');
});

test('NIP-29 metadata: 39001 admin list contains relay pubkey only', async () => {
  const ws = await connectAndAuth(test1.privateKey);
  const r = await request(ws, 'sub1', {
    kinds: [39001],
    '#d': [TEST_GROUP],
    limit: 1,
  });
  ws.close();
  assert.equal(r.closed, false);
  assert.ok(r.events.length > 0);
  const ev = r.events[0];
  const adminTags = ev.tags.filter((t) => t[0] === 'p');
  assert.equal(adminTags.length, 1, 'exactly one admin');
  // Admin pubkey is the relay's own key; assert role label matches roadmap.
  assert.equal(adminTags[0][2], 'admin');
});
