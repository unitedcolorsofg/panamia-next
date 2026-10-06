#!/usr/bin/env npx tsx
/**
 * Move the production database to a Supabase project in another region.
 *
 * Supabase cannot change a project's region in place, so a move means a new
 * project plus a data migration. This script does not move the data itself --
 * pg_dump and pg_restore do that, and they do it better than anything we would
 * write. What it does is the part that is easy to get wrong and silent when it
 * fails: capturing exactly what the source looks like beforehand, preparing the
 * target so a restore can succeed, and proving afterwards that the two match.
 *
 * Usage:
 *   SOURCE_POSTGRES_URL=... npx tsx scripts/migrate-supabase-region.ts preflight
 *   TARGET_POSTGRES_URL=... npx tsx scripts/migrate-supabase-region.ts prepare --apply
 *   TARGET_POSTGRES_URL=... npx tsx scripts/migrate-supabase-region.ts verify
 *
 * SOURCE_POSTGRES_URL and TARGET_POSTGRES_URL are deliberately not POSTGRES_URL.
 * A migration is the one time two databases are open at once, and the whole
 * failure mode worth engineering against is operating on the wrong one. Reusing
 * the variable the app and every other script already reads would make that
 * mistake a typo away, so this script will not read it.
 *
 * `prepare` is the only subcommand that writes, and it refuses without --apply.
 *
 * ---------------------------------------------------------------------------
 * Why the extension schema is checked so insistently
 *
 * Migration 0040 does not create pana_unaccent with a literal body. It looks up
 * which schema holds the unaccent dictionary, then builds the function through
 * format() + EXECUTE, so the resolved schema is baked into the stored source:
 *
 *     SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1)
 *
 * pg_dump reproduces that text verbatim. The schema is not re-resolved on
 * restore. If the target installs unaccent somewhere else -- public, say,
 * because CREATE EXTENSION without WITH SCHEMA follows search_path -- then the
 * restored function references a schema that has no dictionary in it.
 *
 * That failure is nastier than it sounds, because profiles.search_vector is
 * GENERATED ALWAYS ... STORED off this function and carries an index. The
 * restore fails midway through the schema, or worse succeeds against a
 * same-named dictionary in a different schema and quietly changes how search
 * folds accents. Hence: record the schemas on the source, recreate them exactly
 * on the target, and diff the function body at the end.
 * ---------------------------------------------------------------------------
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import postgres from 'postgres';

// Only these two carry application data. Supabase's own auth/storage/realtime
// schemas already exist on the target and must not be dumped over.
const APP_SCHEMAS = ['public', 'drizzle'] as const;

// Required by migrations 0040/0041/0045. Checked rather than assumed: a new
// Supabase project does not necessarily preinstall the same set.
const REQUIRED_EXTENSIONS = ['unaccent', 'pg_trgm'] as const;

const DEFAULT_MANIFEST = '.migration-manifest.json';

type Manifest = {
  capturedAt: string;
  serverVersionNum: number;
  databaseBytes: number;
  extensions: { name: string; schema: string; version: string }[];
  tables: { schema: string; name: string; rows: number }[];
  generatedColumns: { schema: string; table: string; column: string }[];
  policies: number;
  panaUnaccentSource: string | null;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function connect(which: 'SOURCE' | 'TARGET') {
  const url = process.env[`${which}_POSTGRES_URL`];
  if (!url) {
    console.error(`Error: ${which}_POSTGRES_URL is required.`);
    console.error(
      'Use the session pooler host if your network is IPv4-only -- ' +
        'db.<ref>.supabase.co has been IPv6-only since early 2024.'
    );
    process.exit(1);
  }
  // prepare: false because Supabase's pooler in transaction mode rejects the
  // extended protocol's prepared statements. lib/db.ts carries the same flag
  // for the same reason.
  return postgres(url, { prepare: false, max: 1, onnotice: () => {} });
}

async function capture(sql: postgres.Sql): Promise<Manifest> {
  const [{ num }] = await sql<{ num: string }[]>`
    SELECT current_setting('server_version_num') AS num
  `;
  const [{ bytes }] = await sql<{ bytes: string }[]>`
    SELECT pg_database_size(current_database())::text AS bytes
  `;

  const extensions = await sql<
    { name: string; schema: string; version: string }[]
  >`
    SELECT e.extname AS name, n.nspname AS schema, e.extversion AS version
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    ORDER BY e.extname
  `;

  const tableList = await sql<{ schema: string; name: string }[]>`
    SELECT schemaname AS schema, tablename AS name
    FROM pg_tables
    WHERE schemaname = ANY(${APP_SCHEMAS as unknown as string[]}::text[])
    ORDER BY schemaname, tablename
  `;

  // Exact counts, one statement per table. pg_stat_user_tables.n_live_tup is
  // an estimate maintained by autovacuum and drifts; a migration that silently
  // drops rows is exactly what this file exists to catch, so pay the scan.
  const tables: Manifest['tables'] = [];
  for (const t of tableList) {
    const [{ c }] = await sql<{ c: string }[]>`
      SELECT count(*)::text AS c FROM ${sql(t.schema)}.${sql(t.name)}
    `;
    tables.push({ schema: t.schema, name: t.name, rows: Number(c) });
  }

  // pg_dump omits generated columns from the data stream and lets the target
  // recompute them. Recording which exist means verify can confirm they came
  // back populated rather than silently NULL. The schema is carried alongside
  // so verify can qualify the table rather than trusting search_path, which
  // differs between a pooled connection and a direct one.
  const generatedColumns = await sql<
    { schema: string; table: string; column: string }[]
  >`
    SELECT n.nspname AS schema, c.relname AS table, a.attname AS column
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.attgenerated <> ''
      AND NOT a.attisdropped
      AND a.attnum > 0
      AND n.nspname = ANY(${APP_SCHEMAS as unknown as string[]}::text[])
    ORDER BY n.nspname, c.relname, a.attname
  `;

  const [{ policies }] = await sql<{ policies: string }[]>`
    SELECT count(*)::text AS policies FROM pg_policies
    WHERE schemaname = ANY(${APP_SCHEMAS as unknown as string[]}::text[])
  `;

  const fn = await sql<{ src: string }[]>`
    SELECT prosrc AS src FROM pg_proc WHERE proname = 'pana_unaccent' LIMIT 1
  `;

  return {
    capturedAt: new Date().toISOString(),
    serverVersionNum: Number(num),
    databaseBytes: Number(bytes),
    extensions,
    tables,
    generatedColumns,
    policies: Number(policies),
    panaUnaccentSource: fn[0]?.src ?? null,
  };
}

function manifestPath(): string {
  return arg('manifest') ?? DEFAULT_MANIFEST;
}

async function preflight() {
  const sql = connect('SOURCE');
  try {
    const m = await capture(sql);
    const path = manifestPath();
    writeFileSync(path, JSON.stringify(m, null, 2));

    const totalRows = m.tables.reduce((a, t) => a + t.rows, 0);
    const mb = m.databaseBytes / 1024 / 1024;

    console.log(`\nSource captured -> ${path}`);
    console.log(`  Postgres        ${m.serverVersionNum}`);
    console.log(
      `  Size            ${mb.toFixed(1)} MB${mb > 400 ? '  <-- near the 500 MB Free cap' : ''}`
    );
    console.log(
      `  Tables          ${m.tables.length} (${totalRows.toLocaleString()} rows)`
    );
    console.log(`  RLS policies    ${m.policies}`);
    console.log(`  Generated cols  ${m.generatedColumns.length}`);

    console.log('\nExtensions required by migrations:');
    const missing: string[] = [];
    for (const name of REQUIRED_EXTENSIONS) {
      const found = m.extensions.find((e) => e.name === name);
      if (found)
        console.log(
          `  ${name.padEnd(10)} schema=${found.schema}  v${found.version}`
        );
      else {
        console.log(`  ${name.padEnd(10)} MISSING on source`);
        missing.push(name);
      }
    }
    if (missing.length) {
      console.log(
        '\n  A missing extension here means the source is not in the state'
      );
      console.log('  the migrations describe. Resolve that before migrating.');
    }

    if (!m.panaUnaccentSource) {
      console.log(
        '\n  Note: pana_unaccent not found. Expected if 0040 has not run.'
      );
    } else {
      const schemas = [
        ...new Set(
          [...m.panaUnaccentSource.matchAll(/(\w+)\.unaccent/g)].map(
            (x) => x[1]
          )
        ),
      ];
      console.log(
        `\n  pana_unaccent body references: ${schemas.join(', ') || '(none)'}`
      );
      console.log(
        '  The target must install unaccent into that schema, or the'
      );
      console.log(
        '  restored function points at a dictionary that is not there.'
      );
    }

    console.log(
      '\nNext: dump the source. Run pg_dump from WSL or Docker so the'
    );
    console.log(
      'client major version is >= the server; older clients refuse.\n'
    );
    const stamp = new Date().toISOString().slice(0, 10);
    console.log(`  pg_dump "$SOURCE_POSTGRES_URL" \\`);
    console.log(`    ${APP_SCHEMAS.map((s) => `--schema=${s}`).join(' ')} \\`);
    console.log(`    --no-owner --no-privileges --quote-all-identifiers \\`);
    console.log(`    -Fc -f panamia-prod-${stamp}.dump\n`);
    console.log(
      'Keep that file. On the Free plan it is the only backup there is.\n'
    );
  } finally {
    await sql.end();
  }
}

async function prepare() {
  const path = manifestPath();
  if (!existsSync(path)) {
    console.error(
      `Error: ${path} not found. Run preflight against the source first.`
    );
    process.exit(1);
  }
  const m: Manifest = JSON.parse(readFileSync(path, 'utf8'));
  const apply = process.argv.includes('--apply');

  const wanted = REQUIRED_EXTENSIONS.map((name) => {
    const e = m.extensions.find((x) => x.name === name);
    if (!e) {
      console.error(
        `Error: ${name} absent from the manifest; cannot mirror it.`
      );
      process.exit(1);
    }
    return e!;
  });

  const sql = connect('TARGET');
  try {
    const [{ num }] = await sql<{ num: string }[]>`
      SELECT current_setting('server_version_num') AS num
    `;
    if (Number(num) < m.serverVersionNum) {
      console.error(
        `Error: target Postgres ${num} is older than source ${m.serverVersionNum}. ` +
          'A dump cannot be restored into an older server.'
      );
      process.exit(1);
    }

    const existing = await sql<{ name: string; schema: string }[]>`
      SELECT e.extname AS name, n.nspname AS schema
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    `;

    console.log(
      `\n${apply ? 'Applying' : 'Dry run -- would apply'} on target:\n`
    );
    for (const e of wanted) {
      const have = existing.find((x) => x.name === e.name);
      if (have && have.schema === e.schema) {
        console.log(`  ${e.name}: already in ${e.schema} -- nothing to do`);
        continue;
      }
      if (have && have.schema !== e.schema) {
        // CREATE EXTENSION IF NOT EXISTS will not relocate an existing install,
        // so this cannot be fixed by re-running; it needs a deliberate move.
        console.log(
          `  ${e.name}: in ${have.schema}, source has ${e.schema} -- MISMATCH`
        );
        console.log(
          `      ALTER EXTENSION "${e.name}" SET SCHEMA "${e.schema}";`
        );
        if (apply) {
          await sql.unsafe(
            `ALTER EXTENSION "${e.name}" SET SCHEMA "${e.schema}"`
          );
          console.log('      done');
        }
        continue;
      }
      console.log(
        `  ${e.name}: absent -- CREATE EXTENSION ... WITH SCHEMA "${e.schema}"`
      );
      if (apply) {
        await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${e.schema}"`);
        await sql.unsafe(
          `CREATE EXTENSION IF NOT EXISTS "${e.name}" WITH SCHEMA "${e.schema}"`
        );
        console.log('      done');
      }
    }

    if (!apply) console.log('\nRe-run with --apply to execute.\n');
    else {
      console.log('\nTarget ready. Restore with:\n');
      console.log('  pg_restore --no-owner --no-privileges \\');
      console.log('    -d "$TARGET_POSTGRES_URL" panamia-prod-<date>.dump\n');
    }
  } finally {
    await sql.end();
  }
}

async function verify() {
  const path = manifestPath();
  if (!existsSync(path)) {
    console.error(
      `Error: ${path} not found. Run preflight against the source first.`
    );
    process.exit(1);
  }
  const src: Manifest = JSON.parse(readFileSync(path, 'utf8'));

  const sql = connect('TARGET');
  let failures = 0;
  try {
    const dst = await capture(sql);

    console.log('\nsource -> target\n');

    const srcRows = src.tables.reduce((a, t) => a + t.rows, 0);
    const dstRows = dst.tables.reduce((a, t) => a + t.rows, 0);
    console.log(`  tables   ${src.tables.length} -> ${dst.tables.length}`);
    console.log(
      `  rows     ${srcRows.toLocaleString()} -> ${dstRows.toLocaleString()}`
    );
    console.log(`  policies ${src.policies} -> ${dst.policies}`);

    const byKey = (t: { schema: string; name: string }) =>
      `${t.schema}.${t.name}`;
    const dstMap = new Map(dst.tables.map((t) => [byKey(t), t.rows]));

    const diffs: string[] = [];
    for (const t of src.tables) {
      const got = dstMap.get(byKey(t));
      if (got === undefined)
        diffs.push(`  MISSING  ${byKey(t)} (${t.rows} rows on source)`);
      else if (got !== t.rows)
        diffs.push(`  ROWS     ${byKey(t)}: ${t.rows} -> ${got}`);
    }
    const extra = dst.tables.filter(
      (t) => !src.tables.some((s) => byKey(s) === byKey(t))
    );
    for (const t of extra)
      diffs.push(`  EXTRA    ${byKey(t)} (${t.rows} rows, not on source)`);

    if (diffs.length) {
      console.log('\nTable differences:');
      diffs.forEach((d) => console.log(d));
      failures += diffs.length;
    } else {
      console.log('\n  Every table matched on exact row count.');
    }

    console.log('\nExtensions:');
    for (const name of REQUIRED_EXTENSIONS) {
      const s = src.extensions.find((e) => e.name === name);
      const d = dst.extensions.find((e) => e.name === name);
      if (!d) {
        console.log(`  ${name}: MISSING on target`);
        failures++;
      } else if (s && s.schema !== d.schema) {
        console.log(`  ${name}: schema ${s.schema} -> ${d.schema}  MISMATCH`);
        failures++;
      } else {
        console.log(`  ${name}: ${d.schema} ok`);
      }
    }

    // The crux. If this body differs, search silently folds accents
    // differently -- or not at all -- and nothing else here would notice.
    if (src.panaUnaccentSource) {
      if (!dst.panaUnaccentSource) {
        console.log('\n  pana_unaccent: MISSING on target');
        failures++;
      } else if (
        src.panaUnaccentSource.trim() !== dst.panaUnaccentSource.trim()
      ) {
        console.log('\n  pana_unaccent: body DIFFERS');
        console.log(`    source: ${src.panaUnaccentSource.trim()}`);
        console.log(`    target: ${dst.panaUnaccentSource.trim()}`);
        failures++;
      } else {
        console.log('\n  pana_unaccent: body identical');
      }
    }

    // Generated columns are recomputed by the target, never copied. A column
    // that came back entirely NULL means the expression did not evaluate.
    if (dst.generatedColumns.length) {
      console.log('\nGenerated columns:');
      for (const g of dst.generatedColumns) {
        const [{ nulls, total }] = await sql<
          { nulls: string; total: string }[]
        >`
          SELECT count(*) FILTER (WHERE ${sql(g.column)} IS NULL)::text AS nulls,
                 count(*)::text AS total
          FROM ${sql(g.schema)}.${sql(g.table)}
        `;
        const bad = Number(total) > 0 && Number(nulls) === Number(total);
        console.log(
          `  ${g.schema}.${g.table}.${g.column}: ${nulls}/${total} null${bad ? '  <-- never evaluated' : ''}`
        );
        if (bad) failures++;
      }
    }

    console.log(
      failures === 0
        ? '\nVerified. Safe to repoint Hyperdrive and flip placement to the new region.\n'
        : `\n${failures} problem(s). Do not cut over.\n`
    );
  } finally {
    await sql.end();
  }
  if (failures > 0) process.exit(1);
}

const cmd = process.argv[2];
const run =
  cmd === 'preflight'
    ? preflight
    : cmd === 'prepare'
      ? prepare
      : cmd === 'verify'
        ? verify
        : null;

if (!run) {
  console.error(
    'Usage: migrate-supabase-region.ts <preflight|prepare|verify> [--apply] [--manifest path]'
  );
  process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
