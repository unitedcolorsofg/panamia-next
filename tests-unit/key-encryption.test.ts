/**
 * Actor signing keys must not be readable from the database alone.
 *
 * These guard lib/federation/crypto/key-encryption.ts and the three places
 * that touch a private key: creation, signing, and the backfill.
 *
 * The property that matters is not "we called an encrypt function". It is
 * that a key which has been through storage still produces a signature a
 * remote server will accept, and that a key which has been tampered with
 * produces nothing at all. Both are asserted against real RSA keys and real
 * signatures rather than against fixtures, because a test that only checks
 * the ciphertext is not the plaintext would pass even if we were storing
 * something unusable.
 *
 * Run: yarn test:unit
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  encryptPrivateKey,
  decryptPrivateKey,
  isEncrypted,
  isLegacyPlaintext,
  __resetKeyCacheForTests,
} from '@/lib/federation/crypto/key-encryption';
import { generateActorKeyPair } from '@/lib/federation/crypto/keys';

const SECRET_A = crypto.randomBytes(32).toString('base64');
const SECRET_B = crypto.randomBytes(32).toString('base64');

const originalSecret = process.env.FEDERATION_KEY_SECRET;

function useSecret(secret: string | undefined) {
  if (secret === undefined) delete process.env.FEDERATION_KEY_SECRET;
  else process.env.FEDERATION_KEY_SECRET = secret;
  __resetKeyCacheForTests();
}

beforeEach(() => useSecret(SECRET_A));
afterEach(() => useSecret(originalSecret));

// A real key, generated once -- these are expensive and every test wants one.
const { publicKey: REAL_PUBLIC, privateKey: REAL_PRIVATE } =
  generateActorKeyPair();

describe('round trip', () => {
  test('a key survives storage unchanged', async () => {
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    assert.equal(await decryptPrivateKey(stored), REAL_PRIVATE);
  });

  test('a round-tripped key still produces a valid signature', async () => {
    // The point of the whole exercise. If this fails, actors silently stop
    // being able to federate -- which looks like a network problem, not a
    // crypto one, and would be miserable to diagnose in production.
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    const recovered = await decryptPrivateKey(stored);

    const message = '(request-target): post /inbox';
    const signature = crypto
      .createSign('sha256')
      .update(message)
      .sign({ key: recovered as string }, 'base64');

    const verified = crypto
      .createVerify('sha256')
      .update(message)
      .verify(REAL_PUBLIC, signature, 'base64');

    assert.equal(
      verified,
      true,
      'signature must verify against the public key'
    );
  });

  test('the stored value does not contain the key', async () => {
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    assert.ok(!stored.includes('BEGIN PRIVATE KEY'));
    assert.ok(!stored.includes(REAL_PRIVATE.slice(40, 120)));
  });

  test('encrypting twice gives different ciphertext', async () => {
    // A fixed IV would leak that two actors share a key, and would break the
    // security proof of GCM outright.
    const a = await encryptPrivateKey(REAL_PRIVATE);
    const b = await encryptPrivateKey(REAL_PRIVATE);
    assert.notEqual(a, b);
    assert.equal(await decryptPrivateKey(a), await decryptPrivateKey(b));
  });

  test('stored format is versioned', async () => {
    // The version prefix is what makes a future algorithm change possible
    // without having to guess at what each row contains.
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    const parts = stored.split('.');
    assert.equal(parts[0], 'v1');
    assert.equal(parts.length, 3);
  });
});

describe('tampering and wrong keys', () => {
  test('a modified ciphertext is rejected, not decrypted', async () => {
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    const [v, iv, data] = stored.split('.');

    // Flip a byte in the middle of the ciphertext.
    const bytes = Buffer.from(data, 'base64');
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    const tampered = `${v}.${iv}.${bytes.toString('base64')}`;

    await assert.rejects(
      () => decryptPrivateKey(tampered),
      /Could not decrypt/
    );
  });

  test('a modified IV is rejected', async () => {
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    const [v, iv, data] = stored.split('.');
    const bytes = Buffer.from(iv, 'base64');
    bytes[0] ^= 0xff;
    const tampered = `${v}.${bytes.toString('base64')}.${data}`;

    await assert.rejects(
      () => decryptPrivateKey(tampered),
      /Could not decrypt/
    );
  });

  test('a truncated ciphertext is rejected', async () => {
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    const [v, iv, data] = stored.split('.');
    const truncated = `${v}.${iv}.${data.slice(0, data.length - 8)}`;
    await assert.rejects(() => decryptPrivateKey(truncated));
  });

  test('the wrong secret cannot read a key', async () => {
    // This is the whole threat model: database without secret.
    const stored = await encryptPrivateKey(REAL_PRIVATE);
    useSecret(SECRET_B);
    await assert.rejects(() => decryptPrivateKey(stored), /Could not decrypt/);
  });

  test('a malformed stored value is refused rather than guessed at', async () => {
    await assert.rejects(
      () => decryptPrivateKey('v1.only-two-parts'),
      /Malformed/
    );
    await assert.rejects(
      () => decryptPrivateKey('not-a-key-at-all'),
      /neither PEM nor a recognised ciphertext/
    );
  });
});

describe('fail closed', () => {
  test('a missing secret throws instead of storing plaintext', async () => {
    // The dangerous failure would be silently writing an unencrypted key.
    useSecret(undefined);
    await assert.rejects(
      () => encryptPrivateKey(REAL_PRIVATE),
      /FEDERATION_KEY_SECRET is not set/
    );
  });

  test('the missing-secret error says how to generate one', async () => {
    useSecret(undefined);
    await assert.rejects(
      () => encryptPrivateKey(REAL_PRIVATE),
      (err: Error) => {
        assert.match(err.message, /randomBytes\(32\)/);
        return true;
      }
    );
  });

  test('a wrong-length secret is rejected', async () => {
    useSecret(crypto.randomBytes(16).toString('base64'));
    await assert.rejects(
      () => encryptPrivateKey(REAL_PRIVATE),
      /must decode to 32 bytes \(got 16\)/
    );
  });

  test('a non-base64 secret is rejected', async () => {
    useSecret('this is not base64 !!!!');
    await assert.rejects(() => encryptPrivateKey(REAL_PRIVATE));
  });
});

describe('rollout and idempotence', () => {
  test('legacy plaintext PEM still signs', async () => {
    // Encryption ships before the backfill finishes. If this failed, the
    // deploy itself would be the outage.
    assert.equal(await decryptPrivateKey(REAL_PRIVATE), REAL_PRIVATE);
  });

  test('re-encrypting is a no-op, so the backfill is safe to re-run', async () => {
    const once = await encryptPrivateKey(REAL_PRIVATE);
    const twice = await encryptPrivateKey(once);
    assert.equal(twice, once);
    assert.equal(await decryptPrivateKey(twice), REAL_PRIVATE);
  });

  test('null passes through both directions', async () => {
    // Remote actors have no private key and must not acquire one.
    assert.equal(await encryptPrivateKey(null), null);
    assert.equal(await decryptPrivateKey(null), null);
    assert.equal(await decryptPrivateKey(undefined), null);
    assert.equal(await decryptPrivateKey(''), null);
  });

  test('classification distinguishes the two storage formats', async () => {
    const stored = await encryptPrivateKey(REAL_PRIVATE);

    assert.equal(isEncrypted(stored), true);
    assert.equal(isLegacyPlaintext(stored), false);

    assert.equal(isLegacyPlaintext(REAL_PRIVATE), true);
    assert.equal(isEncrypted(REAL_PRIVATE), false);

    for (const empty of [null, undefined, '']) {
      assert.equal(isEncrypted(empty), false);
      assert.equal(isLegacyPlaintext(empty), false);
    }
  });
});

/**
 * Structural guards.
 *
 * The behavioural tests above prove the module works. These prove it is
 * actually used -- a correct encryptor that nobody calls protects nothing,
 * and that failure is invisible at runtime because everything still signs
 * fine with a plaintext key.
 *
 * Read from source rather than listing call sites by hand, so a new one
 * cannot be added without this noticing.
 */
describe('structural guards', () => {
  const root = process.cwd();
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  test('actor creation encrypts before insert', () => {
    const src = read('lib/federation/wrappers/actor.ts');
    assert.match(
      src,
      /encryptPrivateKey\(privateKey\)/,
      'createActorForProfile must encrypt the generated key'
    );
    assert.match(
      src,
      /privateKey:\s*encryptedPrivateKey/,
      'the insert must store the ciphertext, not the raw key'
    );
    assert.ok(
      !/privateKey,\s*$/m.test(src),
      'the raw key must not be shorthand-inserted'
    );
  });

  test('signing decrypts internally, so no caller handles plaintext', () => {
    const src = read('lib/federation/crypto/sign.ts');
    assert.match(src, /export async function signedHeaders/);
    assert.match(src, /await decryptPrivateKey\(currentActor\.privateKey\)/);
    assert.ok(
      !/privateKey:\s*currentActor\.privateKey/.test(src),
      'the stored value must never be passed to the signer directly'
    );
  });

  test('every signedHeaders call site awaits it', () => {
    // Missing an await would pass a Promise as headers: no signature, and a
    // remote server would reject the delivery for reasons that look unrelated.
    const files = [
      'lib/federation/inbox-handler.ts',
      'lib/server/delete-account.ts',
    ];

    let found = 0;
    for (const file of files) {
      for (const line of read(file).split('\n')) {
        if (!line.includes('signedHeaders(')) continue;
        if (line.includes('import')) continue;
        found += 1;
        assert.match(
          line,
          /await signedHeaders\(/,
          `${file}: signedHeaders must be awaited -- got: ${line.trim()}`
        );
      }
    }

    assert.ok(found >= 2, `expected to find call sites, found ${found}`);
  });

  test('the key column is still excluded from public actor output', () => {
    // Pre-existing protection. Encryption at rest does not replace it: a
    // ciphertext published in an API response is still a secret leaked to
    // anyone who later obtains the master key.
    const src = read('lib/schema/index.ts');
    assert.match(
      src,
      /export type PublicSocialActor = Omit<SocialActor, 'privateKey'>/
    );
    assert.match(
      src,
      /delete \(rest as \{ privateKey\?: string \| null \}\)\.privateKey/
    );
  });

  test('the master key is declared in the env registry', () => {
    const src = read('lib/env.config.ts');
    assert.match(src, /FEDERATION_KEY_SECRET:/);
    assert.match(
      src,
      /FEDERATION_KEY_SECRET:[\s\S]{0,1200}?location: 'SECRET'/,
      'must be registered as a SECRET, not a VAR -- VARs are committed to wrangler.jsonc'
    );
  });
});
