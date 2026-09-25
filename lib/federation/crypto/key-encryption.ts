/**
 * Encryption at rest for actor signing keys.
 *
 * Every local actor gets an RSA keypair. The public half is published in the
 * actor document; the private half is what proves a request genuinely came
 * from that member. Anyone holding it can sign activities as them -- post,
 * follow, reply, delete -- on any server that federates with us, and remote
 * servers have no way to tell the difference. That is the whole basis of
 * identity in ActivityPub.
 *
 * Until now those keys sat in `social_actors.private_key` as plaintext PEM.
 * `lib/federation/crypto/sign.ts` still carries the note explaining why:
 *
 *     removed passphrase: getConfig().secretPhase -- our keys are unencrypted PEM
 *
 * The upstream project this was ported from encrypted them. The port dropped
 * that, which turned "an attacker needs the database *and* a secret" into "an
 * attacker needs the database".
 *
 * WHAT THIS DOES AND DOES NOT PROTECT
 *
 * This defends against the realistic way a key leaks: something that yields
 * database contents but not worker secrets. A leaked backup, a snapshot
 * restored into a less-guarded environment, an over-broad read replica, a
 * compromised database account, SQL injection, or a support export. In all of
 * those the ciphertext is inert without FEDERATION_KEY_SECRET.
 *
 * It does not defend against a compromised worker. Anything that can run our
 * code can read the secret and decrypt. That is inherent -- the signing path
 * needs the plaintext key -- and pretending otherwise would be worse than
 * being clear about it. The goal is to remove the single most likely path,
 * not to claim there is none.
 *
 * WHY WEB CRYPTO RATHER THAN node:crypto
 *
 * The rest of this directory uses node:crypto, which works here because
 * `nodejs_compat` is enabled. But that flag provides a compatibility layer
 * whose coverage varies by API and compatibility date, and a cipher that
 * silently behaves differently in production than in local Node would be a
 * bad thing to discover by way of unreadable keys. crypto.subtle is native in
 * Workers and native in Node, so the same code takes the same path in both.
 *
 * AES-256-GCM specifically, because it authenticates: a tampered ciphertext
 * fails to decrypt rather than yielding garbage that gets handed to a signer.
 *
 * WHY THERE IS NO ASSOCIATED DATA
 *
 * Binding the ciphertext to the actor -- so a key cannot be moved between
 * rows -- was considered and rejected. The only stable identifier available
 * at the point of decryption is the actor URI, and URIs change: members
 * rename, and the actor route already has handling for historical
 * screennames. Binding to a mutable value would mean a rename silently
 * destroys the key. The failure mode of the mitigation is worse than the
 * threat it addresses.
 */

const VERSION = 'v1';
const PREFIX = `${VERSION}.`;
const IV_BYTES = 12; // 96 bits, the size AES-GCM is specified for
const KEY_BYTES = 32; // AES-256

/** PEM private keys always start with this. Used to recognise legacy rows. */
const PEM_MARKER = '-----BEGIN';

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Loads the master key from the environment.
 *
 * Deliberately throws rather than falling back to storing plaintext. A
 * missing secret is a deployment mistake, and the failure it causes --
 * enrollment returning an error -- is loud, immediate and reversible.
 * Quietly writing an unencrypted key instead would leave no trace and defeat
 * the entire point of this module.
 */
async function getMasterKey(): Promise<CryptoKey> {
  const secret = process.env.FEDERATION_KEY_SECRET;

  if (!secret) {
    throw new Error(
      'FEDERATION_KEY_SECRET is not set. Actor signing keys cannot be ' +
        'encrypted or decrypted without it. Generate one with: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  if (cachedKey && cachedSecret === secret) return cachedKey;

  let raw: Uint8Array;
  try {
    raw = fromBase64(secret);
  } catch {
    throw new Error(
      'FEDERATION_KEY_SECRET is not valid base64. Expected 32 random bytes, base64-encoded.'
    );
  }

  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `FEDERATION_KEY_SECRET must decode to ${KEY_BYTES} bytes (got ${raw.length}). ` +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  cachedKey = await crypto.subtle.importKey(
    'raw',
    raw as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  cachedSecret = secret;
  return cachedKey;
}

/** True if `stored` is a value this module produced. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}

/** True if `stored` is an unencrypted PEM key, i.e. a row predating this. */
export function isLegacyPlaintext(stored: string | null | undefined): boolean {
  return (
    typeof stored === 'string' && stored.trimStart().startsWith(PEM_MARKER)
  );
}

/**
 * Encrypts a PEM private key for storage.
 *
 * Passing null through unchanged is intentional: remote actors have no
 * private key, and `social_actors.private_key` is nullable for exactly that
 * reason. Re-encrypting an already-encrypted value is refused rather than
 * silently nested, so a double-run of the backfill cannot corrupt a row.
 */
export async function encryptPrivateKey(pem: null): Promise<null>;
export async function encryptPrivateKey(pem: string): Promise<string>;
export async function encryptPrivateKey(
  pem: string | null
): Promise<string | null>;
export async function encryptPrivateKey(
  pem: string | null
): Promise<string | null> {
  if (pem === null || pem === undefined) return null;
  if (isEncrypted(pem)) return pem;

  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(pem) as unknown as BufferSource
  );

  return `${PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Recovers a PEM private key for signing.
 *
 * Legacy plaintext is returned as-is. That is not an oversight: encryption
 * ships before the backfill finishes, and a deploy that could not sign for
 * rows it had not yet re-encrypted would be an outage. `isLegacyPlaintext`
 * exists so the backfill script and its test can tell how many such rows
 * remain, rather than this silently becoming permanent.
 */
export async function decryptPrivateKey(
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored) return null;
  if (isLegacyPlaintext(stored)) return stored;

  if (!isEncrypted(stored)) {
    throw new Error(
      'Stored private key is neither PEM nor a recognised ciphertext. ' +
        'Refusing to guess.'
    );
  }

  const parts = stored.slice(PREFIX.length).split('.');
  if (parts.length !== 2) {
    throw new Error(`Malformed encrypted private key (${VERSION}).`);
  }

  const [ivPart, dataPart] = parts;
  const key = await getMasterKey();

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) as unknown as BufferSource },
      key,
      fromBase64(dataPart) as unknown as BufferSource
    );
  } catch {
    // GCM authentication failure: wrong secret, or the row was tampered with.
    // Both are worth distinguishing from "no key", so throw rather than
    // returning null and letting the caller send an unsigned request.
    throw new Error(
      'Could not decrypt actor private key. FEDERATION_KEY_SECRET may be ' +
        'wrong, rotated, or the stored value may have been altered.'
    );
  }

  return new TextDecoder().decode(plaintext);
}

/** Test seam. Not for application use. */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
  cachedSecret = null;
}
