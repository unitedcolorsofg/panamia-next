#!/usr/bin/env npx tsx
/**
 * Encrypt actor signing keys that are still stored as plaintext PEM.
 *
 * `social_actors.private_key` used to hold unencrypted PEM. New actors are
 * encrypted at creation (lib/federation/wrappers/actor.ts), and the signing
 * path accepts both formats so the code could ship before this ran. This
 * closes the remaining gap: rows created before that change.
 *
 * Until this has been run with --apply, a database leak still exposes usable
 * signing keys for every pre-existing actor. Encryption in the code is not
 * the same thing as encryption in the table.
 *
 * Safe to run repeatedly. Already-encrypted rows are skipped, not re-wrapped;
 * encryptPrivateKey() refuses to nest ciphertext.
 *
 * Remote actors have private_key NULL and are ignored -- we never hold their
 * keys and never should.
 *
 * Usage:
 *   POSTGRES_URL=... FEDERATION_KEY_SECRET=... npx tsx scripts/encrypt-actor-keys.ts [--apply]
 *
 * Defaults to a dry run.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, isNotNull } from 'drizzle-orm';
import * as schema from '../lib/schema';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  isEncrypted,
  isLegacyPlaintext,
} from '../lib/federation/crypto/key-encryption';

const { socialActors } = schema;

async function main() {
  const apply = process.argv.includes('--apply');

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  if (!process.env.FEDERATION_KEY_SECRET) {
    console.error(
      'Error: FEDERATION_KEY_SECRET environment variable is required.\n' +
        'It must be the same secret the deployed worker uses, or the keys ' +
        'this script writes will be undecryptable in production.'
    );
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    const actors = await db
      .select({
        id: socialActors.id,
        uri: socialActors.uri,
        privateKey: socialActors.privateKey,
      })
      .from(socialActors)
      .where(isNotNull(socialActors.privateKey));

    const plaintext = actors.filter((a) => isLegacyPlaintext(a.privateKey));
    const encrypted = actors.filter((a) => isEncrypted(a.privateKey));
    const unknown = actors.filter(
      (a) => !isLegacyPlaintext(a.privateKey) && !isEncrypted(a.privateKey)
    );

    console.log(`Local actors with a private key: ${actors.length}`);
    console.log(`  already encrypted: ${encrypted.length}`);
    console.log(`  plaintext PEM:     ${plaintext.length}`);

    if (unknown.length > 0) {
      // Neither format. Do not guess -- encrypting an unrecognised value
      // would make it permanently unreadable.
      console.error(
        `  UNRECOGNISED:      ${unknown.length} (not touched, investigate)`
      );
      for (const actor of unknown) console.error(`    - ${actor.uri}`);
    }

    if (plaintext.length === 0) {
      console.log('\nNothing to do.');
      return;
    }

    if (!apply) {
      console.log('\nDry run. Would encrypt:');
      for (const actor of plaintext) console.log(`  - ${actor.uri}`);
      console.log('\nRe-run with --apply to write.');
      return;
    }

    let done = 0;
    for (const actor of plaintext) {
      const ciphertext = await encryptPrivateKey(actor.privateKey as string);

      // Verify before writing. A key we cannot read back is worse than one
      // stored in plaintext: the actor becomes permanently unable to sign.
      const roundTripped = await decryptPrivateKey(ciphertext);
      if (roundTripped !== actor.privateKey) {
        throw new Error(
          `Round-trip check failed for ${actor.uri}. Nothing further written.`
        );
      }

      await db
        .update(socialActors)
        .set({ privateKey: ciphertext })
        .where(eq(socialActors.id, actor.id));

      done += 1;
      console.log(`  encrypted ${actor.uri}`);
    }

    console.log(`\nEncrypted ${done} key(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
