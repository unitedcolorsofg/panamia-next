/**
 * Tests for the founder tier predicate.
 *
 * `isAdminEmail` decides who may grant admin to somebody else. It is the only
 * check standing between a signed-in staff account and the ability to mint
 * more admins, and unlike most authorization it has no database behind it to
 * cross-check against — it is a string comparison against a secret, so a
 * parsing mistake is the whole bug.
 *
 * The cases below are the ones that would fail silently in production: a
 * secret written with spaces after the commas, an address that differs only
 * in case, a deploy that forgot the variable. Each of those resolves to a
 * plain `false` at the call site with nothing in the logs to say why.
 *
 * No database or network: both units read `process.env` and nothing else.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { isAdminEmail, adminEmailList } from '@/lib/server/admin-emails';

const ORIGINAL = process.env.ADMIN_EMAILS;

beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe('isAdminEmail — the failure direction', () => {
  test('an unset secret makes nobody a founder', () => {
    // The important half of this assertion is that it is false rather than
    // throwing: a missing secret must lock admin down, not crash the gate
    // into an error path that some caller treats as "allow".
    assert.equal(isAdminEmail('someone@example.com'), false);
    assert.deepEqual(adminEmailList(), []);
  });

  test('an empty secret makes nobody a founder', () => {
    process.env.ADMIN_EMAILS = '';
    assert.equal(isAdminEmail('someone@example.com'), false);
    assert.deepEqual(adminEmailList(), []);
  });

  test('a secret of only separators yields no founders', () => {
    // ',,' would produce three empty strings without the filter, and an empty
    // string in the list would match any falsy address that slipped past the
    // guard clause.
    process.env.ADMIN_EMAILS = ' , , ';
    assert.deepEqual(adminEmailList(), []);
    assert.equal(isAdminEmail(''), false);
  });

  test('null and undefined addresses are not founders', () => {
    process.env.ADMIN_EMAILS = 'founder@example.com';
    assert.equal(isAdminEmail(null), false);
    assert.equal(isAdminEmail(undefined), false);
    assert.equal(isAdminEmail(''), false);
  });
});

describe('isAdminEmail — matching', () => {
  test('matches a single address', () => {
    process.env.ADMIN_EMAILS = 'founder@example.com';
    assert.equal(isAdminEmail('founder@example.com'), true);
    assert.equal(isAdminEmail('someone@example.com'), false);
  });

  test('matches regardless of case on either side', () => {
    // Addresses arrive from the session, which carries whatever the member
    // typed at sign-up. A founder who registered with a capital would
    // otherwise lose the grant power without any visible cause.
    process.env.ADMIN_EMAILS = 'Founder@Example.com';
    assert.equal(isAdminEmail('founder@example.com'), true);
    assert.equal(isAdminEmail('FOUNDER@EXAMPLE.COM'), true);
  });

  test('tolerates spaces around the separators', () => {
    // This is how a human writes a list into a secret prompt, and it is the
    // single most likely way for the real value to differ from the test.
    process.env.ADMIN_EMAILS =
      'one@example.com, two@example.com ,  three@example.com';
    assert.equal(isAdminEmail('two@example.com'), true);
    assert.equal(isAdminEmail('three@example.com'), true);
    assert.deepEqual(adminEmailList(), [
      'one@example.com',
      'two@example.com',
      'three@example.com',
    ]);
  });

  test('trims the address being checked', () => {
    process.env.ADMIN_EMAILS = 'founder@example.com';
    assert.equal(isAdminEmail('  founder@example.com  '), true);
  });

  test('does not match on a prefix or substring', () => {
    // `includes` on the array is an exact element match; this pins that it was
    // not written as a substring search on the raw secret, which would make
    // `founder@example.com.attacker.test` a founder.
    process.env.ADMIN_EMAILS = 'founder@example.com';
    assert.equal(isAdminEmail('founder@example.com.attacker.test'), false);
    assert.equal(isAdminEmail('notfounder@example.com'), false);
    assert.equal(isAdminEmail('founder@example.co'), false);
  });

  test('re-reads the environment on every call', () => {
    // Workers reuse an isolate across requests. If the list were parsed once
    // at module load, a secret rotation would not take effect until the
    // isolate recycled — so a revoked founder would keep the grant power for
    // an unbounded and invisible period.
    process.env.ADMIN_EMAILS = 'first@example.com';
    assert.equal(isAdminEmail('first@example.com'), true);

    process.env.ADMIN_EMAILS = 'second@example.com';
    assert.equal(isAdminEmail('first@example.com'), false);
    assert.equal(isAdminEmail('second@example.com'), true);
  });
});
