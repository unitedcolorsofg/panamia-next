/**
 * Verify the GHL account matches what the inquiry routing design expects.
 *
 * Phase 3 of docs/CONTACT-ROADMAP.md is dashboard work: someone creates the
 * Inquiries pipeline and its stages, and builds the Workflows that assign each
 * kind of inquiry to an owner. This script checks that what they created
 * matches what lib/ghl-structure.ts expects, so "Phase 3 is done" is a command
 * rather than an opinion.
 *
 * Read-only. Creates nothing, changes nothing, safe against production.
 *
 *   npx tsx scripts/ghl-check-structure.ts --api-key=pit-xxxx --location-id=xxxx
 *
 * Needs opportunities.readonly and users.readonly. Exits non-zero when the
 * pipeline or a stage is missing.
 *
 * What it cannot check: the assignment Workflows. Workflow triggers and actions
 * are not exposed by the API, so whether a tag actually assigns an owner has to
 * be confirmed by hand in the dashboard. The tag strings are printed so they
 * can be copied into the Workflow filters rather than retyped.
 */

import {
  INQUIRIES_PIPELINE_NAME,
  INQUIRY_STAGES,
  TAG_SOURCE_CONTACT_US,
  TAG_UNVERIFIED,
  inquiryTag,
} from '../lib/ghl-structure';
import { CONTACT_CATEGORIES } from '../lib/contact-categories';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

const argv = process.argv.slice(2);
const arg = (n: string) =>
  argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) || undefined;

const API_KEY = arg('api-key');
const LOCATION_ID = arg('location-id');

let failures = 0;

const pass = (msg: string) => console.log(`  [PASS] ${msg}`);
const warn = (msg: string) => console.log(`  [WARN] ${msg}`);
const fail = (msg: string) => {
  failures += 1;
  console.log(`  [FAIL] ${msg}`);
};

async function get<T>(path: string, version = '2021-07-28'): Promise<T | null> {
  const res = await fetch(`${GHL_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: version,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    // A 401 here can mean a missing scope or a refused Version header; both
    // look identical by status. See scripts/ghl-verify.ts.
    fail(`GET ${path} returned ${res.status}`);
    return null;
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

async function main() {
  if (!API_KEY || !LOCATION_ID) {
    console.error(
      'FATAL: --api-key= and --location-id= are required.\n' +
        '  npx tsx scripts/ghl-check-structure.ts --api-key=pit-xxxx --location-id=xxxx'
    );
    process.exit(1);
  }

  console.log('\nGHL structure check');
  console.log(`location: ${LOCATION_ID}`);
  console.log(`expecting pipeline: "${INQUIRIES_PIPELINE_NAME}"`);

  // --- Pipeline and stages -------------------------------------------------
  console.log('\nPipeline');
  const pipelineData = await get<{
    pipelines?: Array<{
      id?: string;
      name?: string;
      stages?: Array<{ id?: string; name?: string }>;
    }>;
  }>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(LOCATION_ID)}`,
    'v3'
  );
  const pipelines = pipelineData?.pipelines ?? [];

  const wanted = INQUIRIES_PIPELINE_NAME.trim().toLowerCase();
  const pipeline = pipelines.find(
    (p) => p.name?.trim().toLowerCase() === wanted
  );

  if (!pipeline) {
    fail(
      `no pipeline named "${INQUIRIES_PIPELINE_NAME}". Found: ${
        pipelines.map((p) => `"${p.name}"`).join(', ') || 'none'
      }`
    );
    console.log(
      '\n    Create it in GHL: Opportunities -> Pipelines -> Add Pipeline,\n' +
        `    named "${INQUIRIES_PIPELINE_NAME}", with these stages in order:\n` +
        INQUIRY_STAGES.map((s) => `      - ${s}`).join('\n')
    );
  } else {
    pass(`pipeline "${pipeline.name}" exists (${pipeline.id})`);
    const stageNames = (pipeline.stages ?? []).map((s) =>
      s.name?.trim().toLowerCase()
    );
    for (const stage of INQUIRY_STAGES) {
      if (stageNames.includes(stage.toLowerCase())) pass(`stage "${stage}"`);
      else fail(`stage "${stage}" missing`);
    }
    // Extra stages are harmless, but routing never writes to them, so anything
    // parked there will not sync back.
    const extra = (pipeline.stages ?? [])
      .map((s) => s.name?.trim() ?? '')
      .filter(
        (n) =>
          n && !INQUIRY_STAGES.some((s) => s.toLowerCase() === n.toLowerCase())
      );
    if (extra.length) {
      warn(`pipeline has stages this design does not use: ${extra.join(', ')}`);
    }
  }

  // --- Users ---------------------------------------------------------------
  // Informational. Ownership is assigned by Workflow, not by this app, so there
  // is no mapping to validate — but whoever builds those Workflows picks from
  // this list, and a name missing here is why an assignment silently fails.
  console.log('\nUsers available to assign inquiries to');
  const userData = await get<{
    users?: Array<{ id?: string; name?: string; email?: string }>;
  }>(`/users/?locationId=${encodeURIComponent(LOCATION_ID)}`);
  const users = userData?.users ?? [];
  if (!users.length) {
    warn(
      'no users returned — assignment Workflows would have nobody to target'
    );
  }
  for (const u of users) {
    console.log(`  ${u.name ?? '(unnamed)'} <${u.email ?? 'no email'}>`);
  }

  // --- Tags ----------------------------------------------------------------
  // Tags are created implicitly on first use, so there is nothing to verify.
  // They are printed because they are the assignment Workflows' trigger filter:
  // ownership depends on these exact strings.
  console.log(
    '\nTags this path writes — use these as Workflow trigger filters'
  );
  console.log(`  ${TAG_SOURCE_CONTACT_US}   (every contact from Contact Us)`);
  console.log(`  ${TAG_UNVERIFIED}          (submitter was not signed in)`);
  for (const category of CONTACT_CATEGORIES) {
    console.log(`  ${inquiryTag(category)}`);
  }

  console.log('\nStill to confirm by hand (not visible to the API):');
  console.log(
    '  - a Workflow assigns an owner on each inquiry:* tag\n' +
      "  - that assignment reaches the Task's assignedTo, not only the contact's owner"
  );

  console.log(
    failures === 0
      ? '\nPipeline structure is in place.'
      : `\n${failures} problem(s) — Phase 3 is not complete.`
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('\nCheck aborted:', e);
  process.exit(1);
});
