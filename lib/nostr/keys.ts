// Browser-safe Nostr key generation + NIP-19 bech32 encoding.
//
// All operations are pure-client: secret keys are generated via
// schnorr.utils.randomSecretKey() (uses Web Crypto getRandomValues under the
// hood) and never leave the browser unless the user copies them. The page
// using this module is responsible for showing the secret exactly once and
// warning the user that we cannot recover it.
import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export interface Keypair {
  privateKeyHex: string;
  publicKeyHex: string;
  nsec: string;
  npub: string;
}

export function generateKeypair(): Keypair {
  const sk = schnorr.utils.randomSecretKey();
  const pk = schnorr.getPublicKey(sk);
  const privateKeyHex = bytesToHex(sk);
  const publicKeyHex = bytesToHex(pk);
  return {
    privateKeyHex,
    publicKeyHex,
    nsec: bech32Encode('nsec', sk),
    npub: bech32Encode('npub', pk),
  };
}

// =============================================================================
// Minimal bech32 encoder (NIP-19). Decoder intentionally omitted — we only
// emit, never parse, in this module.
// =============================================================================
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const ret: number[] = [];
  for (let p = 0; p < 6; p++) ret.push((mod >> (5 * (5 - p))) & 31);
  return ret;
}

function convertBits(
  data: Uint8Array,
  fromBits: number,
  toBits: number,
  pad: boolean
): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (const v of data) {
    acc = (acc << fromBits) | v;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  return ret;
}

export function bech32Encode(hrp: string, bytes: Uint8Array): string {
  const data = convertBits(bytes, 8, 5, true);
  const combined = data.concat(createChecksum(hrp, data));
  let ret = hrp + '1';
  for (const d of combined) ret += CHARSET.charAt(d);
  return ret;
}

// Convenience for tests/scripts that already have a hex secret.
export function npubFromHex(hex: string): string {
  return bech32Encode('npub', hexToBytes(hex));
}

// =============================================================================
// Minimal bech32 decoder (NIP-19) — added for BYO key enrollment, which lets a
// user prove control of an existing nsec by signing a proof IN THE BROWSER
// (the nsec is never transmitted). Verifies the checksum, then unpacks 5-bit
// groups back to bytes. Throws on any malformed input.
// =============================================================================
function bech32Decode(input: string): { hrp: string; bytes: Uint8Array } {
  const str = input.trim().toLowerCase();
  const sep = str.lastIndexOf('1');
  if (sep < 1 || sep + 7 > str.length) {
    throw new Error('malformed bech32 string');
  }
  const hrp = str.slice(0, sep);
  const dataPart = str.slice(sep + 1);
  const data: number[] = [];
  for (const ch of dataPart) {
    const v = CHARSET.indexOf(ch);
    if (v === -1) throw new Error('invalid bech32 character');
    data.push(v);
  }
  // Validate checksum: hrpExpand + data must polymod to 1.
  if (polymod(hrpExpand(hrp).concat(data)) !== 1) {
    throw new Error('bad bech32 checksum');
  }
  // Drop the 6-symbol checksum, then convert 5-bit groups → 8-bit bytes.
  const payload = data.slice(0, data.length - 6);
  const bytes = convertBitsFrom5(payload);
  return { hrp, bytes };
}

// 5-bit → 8-bit, rejecting non-zero padding (NIP-19 keys are exactly 32 bytes).
function convertBitsFrom5(data: number[]): Uint8Array {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  for (const v of data) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      ret.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff) !== 0) {
    throw new Error('invalid bech32 padding');
  }
  return new Uint8Array(ret);
}

// Decode an nsec (bech32) to a 64-char hex secret key. Throws if the string is
// not a valid nsec / not 32 bytes. Used client-side only — the resulting hex
// never leaves the browser; it signs a proof event whose signature is sent.
export function secretKeyHexFromNsec(nsec: string): string {
  const { hrp, bytes } = bech32Decode(nsec);
  if (hrp !== 'nsec') throw new Error('not an nsec key');
  if (bytes.length !== 32) throw new Error('nsec is not 32 bytes');
  return bytesToHex(bytes);
}

// Derive the x-only public key (hex) from a hex secret key.
export function publicKeyHexFromSecret(skHex: string): string {
  return bytesToHex(schnorr.getPublicKey(hexToBytes(skHex)));
}
