/**
 * Tests for log redaction (privacy audit finding #6).
 *
 * Two things are being defended here, and they pull in opposite directions:
 *
 *   1. Personal data must not reach a retained log.
 *   2. Logs must stay useful. A redactor that eats timestamps, row counts and
 *      identifiers protects nobody and gets removed by the first person
 *      debugging an incident at 2am.
 *
 * So the negative tests below -- "does NOT redact" -- matter as much as the
 * positive ones. They are what stops the phone matcher from being widened
 * into something that swallows every number in the logs.
 *
 * Run: yarn test:unit
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { redact, redactString } from '@/lib/log/redact';
import { log } from '@/lib/log';
import { describeDbError } from '@/lib/server/db-error';

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

describe('redactString: structured leaks', () => {
  // The exact string real Postgres produced during investigation. Captured
  // from a live unique violation rather than written from memory, because the
  // whole finding rests on this format being what Postgres actually emits.
  const PG_DETAIL = 'Key (email)=(jane.doe@example.com) already exists.';

  test('removes the value from a Postgres DETAIL line', () => {
    const out = redactString(PG_DETAIL);
    assert.ok(
      !out.includes('jane.doe@example.com'),
      `address survived redaction: ${out}`
    );
  });

  test('keeps the column name, which is the half that explains the failure', () => {
    const out = redactString(PG_DETAIL);
    assert.ok(out.includes('(email)'), `column name was lost: ${out}`);
    assert.ok(
      out.includes('already exists'),
      `surrounding message was lost: ${out}`
    );
  });

  test('handles a DETAIL line with a composite key', () => {
    const out = redactString(
      'Key (profile_id, tag)=(9f2c, drag-brunch) already exists.'
    );
    assert.ok(out.includes('(profile_id, tag)'), out);
    assert.ok(!out.includes('drag-brunch'), out);
  });

  test("drops everything after Drizzle's params:, which is the row", () => {
    // Shape taken from drizzle-orm/errors.js:12 --
    //   `Failed query: ${query}\nparams: ${params}`
    //
    // The values here are deliberately NOT an email or a phone number. Those
    // would be caught by the pattern matchers even with this rule removed,
    // which would make this test prove nothing. The point of the params rule
    // is that row data is arbitrary -- a legal name, a street, a bio -- and
    // no matcher will recognise it. Everything after `params:` is a value by
    // definition, so position is the only reliable signal.
    const drizzle =
      'Failed query: insert into "profiles" ("display_name","bio") values ($1,$2)\n' +
      'params: Jane Doe,lives above the bodega on Ponce de Leon';

    const out = redactString(drizzle);

    assert.ok(!out.includes('Jane Doe'), `row value survived: ${out}`);
    assert.ok(!out.includes('Ponce de Leon'), `row value survived: ${out}`);
    // The SQL itself is kept -- it names the table and columns without
    // carrying any values.
    assert.ok(out.includes('insert into "profiles"'), out);
    assert.ok(out.includes('display_name'), out);
  });

  test('drops email and phone params too, belt and braces', () => {
    const out = redactString(
      'Failed query: insert into "members" ("email","phone") values ($1,$2)\n' +
        'params: jane.doe@example.com,305-555-0142'
    );
    assert.ok(!out.includes('jane.doe@example.com'), out);
    assert.ok(!out.includes('305-555-0142'), out);
  });

  test('redacts a free-floating email anywhere in a message', () => {
    const out = redactString('could not send invite to sam+test@pana.social');
    assert.ok(!out.includes('sam+test@pana.social'), out);
    assert.ok(out.includes('could not send invite to'), out);
  });

  test('is idempotent, so double-redacting is safe', () => {
    const once = redactString(PG_DETAIL);
    assert.equal(redactString(once), once);
  });
});

describe('redactString: phone numbers', () => {
  const REDACTED_FORMS = [
    '305-555-0142',
    '(305) 555-0142',
    '305.555.0142',
    '+1 305-555-0142',
    '+13055550142',
  ];

  for (const phone of REDACTED_FORMS) {
    test(`redacts ${phone}`, () => {
      const out = redactString(`contact on file: ${phone}`);
      assert.ok(!out.includes(phone), `phone survived: ${out}`);
    });
  }

  // The reason the phone matcher is written conservatively. Each of these is
  // a real thing that appears in this project's logs, and each would be
  // destroyed by a naive \d{10} matcher.
  const MUST_SURVIVE: Array<[string, string]> = [
    ['unix ms timestamp', '1705334400000'],
    ['unix seconds timestamp', '1705334400'],
    ['ISO timestamp', '2024-01-15T10:30:45.123Z'],
    ['plain date', '2024-01-15'],
    ['byte count', '1048576'],
    ['duration in ms', '123.456'],
    ['numeric id', '9876543210'],
    ['IPv4-shaped version string', '192.168.1.1'],
    ['status and size pair', '200 4096'],
  ];

  for (const [label, value] of MUST_SURVIVE) {
    test(`does NOT redact ${label} (${value})`, () => {
      const out = redactString(`value=${value}`);
      assert.equal(
        out,
        `value=${value}`,
        `redactor damaged a non-PII value: ${out}`
      );
    });
  }
});

describe('redact: key-based redaction', () => {
  test('redacts values under sensitive keys whatever they contain', () => {
    const out = redact({
      email: 'jane@example.com',
      phone: '3055550142',
      password: 'hunter2',
      apiKey: 'sk_live_abc',
      authorization: 'Bearer abc.def',
      privateKey: '-----BEGIN PRIVATE KEY-----',
      ipAddress: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    }) as Record<string, unknown>;

    for (const [key, value] of Object.entries(out)) {
      assert.equal(value, '[redacted]', `${key} was not redacted`);
    }
  });

  test('redacts by key even when the matcher has to infer the shape', () => {
    // `emailAddress` is not a column in this schema. It is here to prove the
    // matcher generalises, so a future field name does not need a code change.
    const out = redact({ emailAddress: 'x', homeStreet: 'y' }) as Record<
      string,
      unknown
    >;
    assert.equal(out.emailAddress, '[redacted]');
    assert.equal(out.homeStreet, '[redacted]');
  });

  test('keeps keys that only look sensitive', () => {
    const out = redact({
      emailVerified: true,
      hasEmail: false,
      emailOptIn: true,
    }) as Record<string, unknown>;

    assert.equal(out.emailVerified, true);
    assert.equal(out.hasEmail, false);
    assert.equal(out.emailOptIn, true);
  });

  test('keeps the identifiers that make logs correlatable', () => {
    const out = redact({
      userId: 'usr_123',
      profileId: 'prf_456',
      statusId: 'sta_789',
      handle: 'janedoe',
      status: 500,
    }) as Record<string, unknown>;

    assert.equal(out.userId, 'usr_123');
    assert.equal(out.profileId, 'prf_456');
    assert.equal(out.statusId, 'sta_789');
    assert.equal(out.handle, 'janedoe');
    assert.equal(out.status, 500);
  });

  test('reaches into nested objects and arrays', () => {
    const out = redact({
      batch: [{ email: 'a@b.com' }, { email: 'c@d.com' }],
      meta: { contact: { phone: '305-555-0142' } },
    }) as {
      batch: Array<Record<string, unknown>>;
      meta: { contact: Record<string, unknown> };
    };

    assert.equal(out.batch[0].email, '[redacted]');
    assert.equal(out.batch[1].email, '[redacted]');
    assert.equal(out.meta.contact.phone, '[redacted]');
  });
});

describe('redact: errors', () => {
  test('keeps name, message and stack, which are why errors get logged', () => {
    const err = new Error('boom');
    const out = redact(err) as Record<string, unknown>;

    assert.equal(out.name, 'Error');
    assert.equal(out.message, 'boom');
    assert.ok(typeof out.stack === 'string' && out.stack.length > 0);
  });

  test('redacts through a cause chain', () => {
    // The real shape: Drizzle wraps, postgres.js is the cause. Both halves
    // carry personal data and neither is obvious from the call site.
    const pgError = Object.assign(new Error('duplicate key value'), {
      code: '23505',
      constraint_name: 'members_email_key',
      table_name: 'members',
      detail: 'Key (email)=(jane.doe@example.com) already exists.',
    });
    const wrapped = new Error(
      'Failed query: insert into "members"\nparams: jane.doe@example.com',
      { cause: pgError }
    );

    const out = JSON.stringify(redact(wrapped));

    assert.ok(!out.includes('jane.doe@example.com'), out);
    // Diagnostics survive.
    assert.ok(out.includes('23505'), out);
    assert.ok(out.includes('members_email_key'), out);
  });

  test('picks up non-enumerable-looking driver fields on the error', () => {
    const err = Object.assign(new Error('nope'), { code: '23503' });
    const out = redact(err) as Record<string, unknown>;
    assert.equal(out.code, '23503');
  });
});

describe('redact: safety properties', () => {
  test('does not mutate its input', () => {
    const input = {
      email: 'jane@example.com',
      nested: { phone: '305-555-0142' },
    };
    const before = JSON.stringify(input);

    redact(input);

    assert.equal(
      JSON.stringify(input),
      before,
      'redact() mutated the object it was given'
    );
  });

  test('survives circular references', () => {
    const a: Record<string, unknown> = { email: 'jane@example.com' };
    a.self = a;

    const out = redact(a) as Record<string, unknown>;

    assert.equal(out.email, '[redacted]');
    assert.equal(out.self, '[circular]');
  });

  test('stops at a depth limit rather than recursing forever', () => {
    let deep: Record<string, unknown> = { email: 'jane@example.com' };
    for (let i = 0; i < 20; i++) deep = { next: deep };

    const out = JSON.stringify(redact(deep));

    assert.ok(out.includes('[depth limit]'), out);
    assert.ok(!out.includes('jane@example.com'), out);
  });

  test('truncates very long strings', () => {
    const out = redactString('x'.repeat(10_000));
    assert.ok(out.length < 10_000);
    assert.ok(out.includes('[truncated]'));
  });

  test('passes through primitives unchanged', () => {
    assert.equal(redact(42), 42);
    assert.equal(redact(true), true);
    assert.equal(redact(null), null);
    assert.equal(redact(undefined), undefined);
  });
});

describe('describeDbError redacts at source', () => {
  // The point of redacting inside describeDbError rather than at its callers:
  // a caller spreads `...details` into a log object and has no reason to
  // suspect `detail` or `query` of carrying row values.
  const buildRealisticError = () => {
    const pgError = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "members_email_key"'
      ),
      {
        code: '23505',
        constraint_name: 'members_email_key',
        table_name: 'members',
        column_name: 'email',
        detail: 'Key (email)=(jane.doe@example.com) already exists.',
      }
    );
    return new Error(
      'Failed query: insert into "members" ("email") values ($1)\n' +
        'params: jane.doe@example.com',
      { cause: pgError }
    );
  };

  test('detail no longer carries the offending value', () => {
    const details = describeDbError(buildRealisticError());
    assert.ok(
      !JSON.stringify(details).includes('jane.doe@example.com'),
      `address survived describeDbError: ${JSON.stringify(details)}`
    );
  });

  test('still returns everything needed to diagnose the failure', () => {
    const details = describeDbError(buildRealisticError());

    assert.equal(details.code, '23505');
    assert.equal(details.constraint, 'members_email_key');
    assert.equal(details.table, 'members');
    assert.equal(details.column, 'email');
    assert.ok(details.detail?.includes('(email)'));
    assert.ok(details.message.includes('duplicate key value'));
  });

  test('isUniqueViolation still classifies correctly after redaction', async () => {
    const { isUniqueViolation } = await import('@/lib/server/db-error');
    assert.equal(isUniqueViolation(buildRealisticError()), true);
  });
});

describe('the log wrapper actually redacts', () => {
  // Without these, `lib/log/index.ts` could be gutted and every other test in
  // this file would still pass -- redact() would be fine and nothing would be
  // using it. Verified by mutation: replacing scrub() with a pass-through
  // went green until these existed.

  const capture = (
    level: 'debug' | 'info' | 'warn' | 'error',
    fn: () => void
  ): unknown[] => {
    const method = level === 'info' ? 'log' : level;
    const original = console[method];
    const seen: unknown[] = [];
    console[method] = (...args: unknown[]) => {
      seen.push(...args);
    };
    try {
      fn();
    } finally {
      console[method] = original;
    }
    return seen;
  };

  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    test(`log.${level} redacts its arguments`, () => {
      const seen = capture(level, () => {
        log[level]('context', {
          userId: 'usr_1',
          email: 'jane.doe@example.com',
        });
      });

      const serialised = JSON.stringify(seen);
      assert.ok(
        !serialised.includes('jane.doe@example.com'),
        `log.${level} leaked an address: ${serialised}`
      );
      // Non-personal context still arrives, or the logger is useless.
      assert.ok(serialised.includes('usr_1'), serialised);
      assert.ok(serialised.includes('context'), serialised);
    });
  }

  test('redacts a free-floating address passed as a bare string', () => {
    const seen = capture('error', () => {
      log.error('could not reach jane.doe@example.com');
    });
    assert.ok(!JSON.stringify(seen).includes('jane.doe@example.com'));
  });

  test('redacts an Error thrown from a failed query', () => {
    const seen = capture('error', () => {
      log.error(
        'insert failed',
        new Error(
          'Failed query: insert into "profiles"\nparams: Jane Doe,305-555-0142'
        )
      );
    });

    const serialised = JSON.stringify(seen);
    assert.ok(!serialised.includes('Jane Doe'), serialised);
    assert.ok(!serialised.includes('305-555-0142'), serialised);
  });

  test('does not mutate the object it was handed', () => {
    const payload = { email: 'jane.doe@example.com' };
    capture('error', () => log.error('x', payload));
    assert.equal(payload.email, 'jane.doe@example.com');
  });
});

describe('structural guards: fixed call sites stay fixed', () => {
  // These read the source rather than the behaviour. A regression here is a
  // person re-adding a log line, not a function returning the wrong value, so
  // source is the thing to assert against.

  test('auth.ts does not log the email when auto-claiming a profile', () => {
    const src = read('auth.ts');
    assert.ok(
      !src.includes("'Auto-claiming profile for user:', email"),
      'the raw-email auto-claim log was reintroduced'
    );
    assert.ok(
      /log\.info\('\[auth\] auto-claiming profile'/.test(src),
      'the auto-claim log no longer goes through the redacting logger'
    );
  });

  test('importProfiles does not log the phone number', () => {
    const src = read('app/api/profile/importProfiles/route.ts');
    assert.ok(
      !/console\.log\(\s*'phone_number'/.test(src),
      'the raw phone_number debug log was reintroduced'
    );
  });

  test('the become-a-pana form logs nothing directly to the console', () => {
    // This form handles a name, an email and social links before any of it is
    // published. Every logging call in it now goes through the redacting
    // logger, so a bare `console.` here is the regression to catch -- it is
    // how `Form values: { name, email }` got in originally.
    const src = read('app/form/become-a-pana/page.tsx');
    const bare = src.match(/console\.(log|error|warn|info|debug)\(/g) ?? [];
    assert.deepEqual(
      bare,
      [],
      `form logs directly to console instead of the redacting logger: ${bare.join(', ')}`
    );
    assert.ok(
      !src.includes("'Form values:'"),
      'the form-values debug log was reintroduced'
    );
  });

  test('the upload route does not log the original filename', () => {
    const src = read('app/api/profile/upload/route.ts');
    assert.ok(
      !src.includes("console.log('onFile', fieldname, value.name"),
      "the log of the member's original filename was reintroduced"
    );
  });

  test('describeDbError routes both risky fields through redaction', () => {
    const src = read('lib/server/db-error.ts');
    assert.ok(
      /detail:\s*redactOptional\(/.test(src),
      'detail is no longer redacted in describeDbError'
    );
    assert.ok(
      /query:\s*cause\s*\?\s*redactString\(/.test(src),
      'query is no longer redacted in describeDbError'
    );
  });
});
