/**
 * GHL API capability probe — validates docs/CONTACT-ROADMAP.md against the
 * live account.
 *
 * Every assumption the routing design rests on is a step here: which Version
 * header each endpoint accepts, whether duplicate creates surface the existing
 * contact ID, whether add-tag is additive, whether tasks and opportunities can
 * be created and assigned. Each step records PASS/FAIL plus the observed
 * status and response shape to a timestamped log under scripts/ghl-verify-logs/.
 *
 * Writes to PRODUCTION. Everything it creates is named "Test Contact <runId>"
 * and torn down at the end unless --keep is passed. Run interactively:
 *
 *   npx tsx scripts/ghl-verify.ts \
 *     --api-key=pit-xxxx --location-id=xxxx [flags]
 *
 * Required:
 *   --api-key=       Private Integration Token for the sub-account
 *   --location-id=   the sub-account (location) to probe
 *
 * Optional:
 *   --pipeline-id=   pipeline for the opportunity step; asked interactively if
 *                    omitted, and skipped under --yes rather than guessed
 *   --email-domain=  overrides the non-deliverable domain test contacts use
 *   --read-only      preflight steps only, no writes
 *   --yes            no prompts
 *   --keep           skip teardown
 *
 * Credentials are passed as arguments, not read from .env.local, so the probe
 * targets the location you name rather than whatever the app is configured for.
 * They will appear in the shell's process list and history.
 *
 * Logs land in scripts/ghl-verify-logs/, which is gitignored — they contain
 * staff user IDs and emails.
 */

import { createInterface } from 'node:readline/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const LOG_DIR = join(import.meta.dirname, 'ghl-verify-logs');

const argv = process.argv.slice(2);
const args = new Set(argv);

/** Read a `--name=value` argument. */
function arg(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3) || undefined;
}

// Credentials come from the command line rather than .env.local. The probe is
// pointed at whichever location is being validated, which is not necessarily
// the one the app is configured for — reading the dotenv file would bind it to
// the app's location silently, which is the wrong default for a tool whose
// entire job is writing test records into a chosen account.
//
// Note this puts the token in the shell's process list and history.
const API_KEY = arg('api-key');
const LOCATION_ID = arg('location-id');

// Which pipeline the opportunity step writes into. Never guessed: pass it, pick
// from the list interactively, or the step is skipped.
const PIPELINE_ID = arg('pipeline-id');

// Test contacts are addressed here. Defaults to a subdomain that does not
// accept mail, so if a "Contact Created" workflow fires, the send bounces
// somewhere harmless instead of at a real inbox on the live domain.
const TEST_EMAIL_DOMAIN = arg('email-domain') ?? 'invalid.test.pana.social';

const AUTO_YES = args.has('--yes');
const READ_ONLY = args.has('--read-only');
const KEEP = args.has('--keep');

// Short, greppable, and stamped into every record so a failed teardown leaves
// something a human can find in the dashboard.
const runId = new Date()
  .toISOString()
  .replace(/[-:T.]/g, '')
  .slice(0, 14);

interface Attempt {
  status: number;
  ok: boolean;
  body: unknown;
  raw: string;
}

interface StepResult {
  id: string;
  title: string;
  verdict: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
  observed?: unknown;
}

const results: StepResult[] = [];

// Records created during the run, torn down in reverse order.
const created = {
  contactIds: [] as string[],
  tasks: [] as { contactId: string; taskId: string }[],
  opportunityIds: [] as string[],
};

async function call(
  method: string,
  path: string,
  version: string,
  body?: unknown
): Promise<Attempt> {
  const res = await fetch(`${GHL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Version: version,
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
  return { status: res.status, ok: res.ok, body: parsed, raw };
}

/**
 * Run the same request under both Version spellings. The v3 docs declare the
 * header enum as ["v3"] while the client has always sent 2021-07-28, so which
 * one the deployed API actually honors is the single most load-bearing
 * unknown in the integration.
 *
 * Only used on idempotent reads — sending a create twice would double the
 * records.
 */
async function compareVersions(
  method: string,
  path: string
): Promise<{ v3: Attempt; dated: Attempt }> {
  const v3 = await call(method, path, 'v3');
  const dated = await call(method, path, '2021-07-28');
  return { v3, dated };
}

let rl: ReturnType<typeof createInterface> | null = null;

async function confirm(prompt: string): Promise<boolean> {
  if (AUTO_YES) return true;
  rl ??= createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n  ${prompt} [y/N] `);
  return answer.trim().toLowerCase().startsWith('y');
}

function record(r: StepResult): void {
  results.push(r);
  // Plain-text marks: the pre-commit emoji screen rejects U+2600-U+27BF, which
  // is where check and cross glyphs live.
  console.log(`  [${r.verdict.padEnd(4)}] ${r.id}  ${r.detail}`);
}

function summarize(body: unknown): string {
  if (body === null || body === undefined) return '(empty)';
  if (typeof body === 'string') return body.slice(0, 200);
  const json = JSON.stringify(body);
  return json.length > 400 ? `${json.slice(0, 400)}…` : json;
}

/** Top-level keys of a response object — the shape a spec cares about. */
function shapeOf(body: unknown): string[] {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return Object.keys(body as Record<string, unknown>);
  }
  return [];
}

async function main(): Promise<void> {
  if (!API_KEY || !LOCATION_ID) {
    console.error(
      'FATAL: --api-key= and --location-id= are required.\n' +
        '  npx tsx scripts/ghl-verify.ts --api-key=pit-xxxx --location-id=xxxx --read-only'
    );
    process.exit(1);
  }

  console.log(`\nGHL capability probe — run ${runId}`);
  console.log(`location: ${LOCATION_ID}`);
  console.log(`mode:     ${READ_ONLY ? 'read-only' : 'read + write'}`);
  if (!READ_ONLY) {
    console.log(
      '\n  This writes to the PRODUCTION location. Contacts created here can\n' +
        '  trigger any Workflow with a "Contact Created" trigger, which may send\n' +
        '  real email to the test address. Check Automation → Workflows first.'
    );
    if (!(await confirm('Proceed against production?'))) {
      console.log('Aborted. Nothing was written.');
      rl?.close();
      return;
    }
  }

  // --- Preflight: read-only scope and structure discovery -----------------
  console.log('\nPreflight (read-only)');

  const loc = await compareVersions('GET', `/locations/${LOCATION_ID}`);
  record({
    id: 'pre.location',
    title: 'GET /locations/{id}',
    verdict: loc.v3.ok || loc.dated.ok ? 'PASS' : 'FAIL',
    detail: `v3=${loc.v3.status} dated=${loc.dated.status}`,
    observed: { v3: loc.v3.status, dated: loc.dated.status },
  });

  const pipelinesAttempt = await compareVersions(
    'GET',
    `/opportunities/pipelines?locationId=${encodeURIComponent(LOCATION_ID)}`
  );
  const pipelineBody = (
    pipelinesAttempt.v3.ok
      ? pipelinesAttempt.v3.body
      : pipelinesAttempt.dated.body
  ) as { pipelines?: Array<Record<string, unknown>> } | null;
  const pipelines = pipelineBody?.pipelines ?? [];
  record({
    id: 'pre.pipelines',
    title: 'GET /opportunities/pipelines',
    verdict: pipelines.length > 0 ? 'PASS' : 'FAIL',
    detail:
      `v3=${pipelinesAttempt.v3.status} dated=${pipelinesAttempt.dated.status} — ` +
      `${pipelines.length} pipeline(s): ${pipelines.map((p) => p.name).join(', ') || 'none'}`,
    // Answers Open Question 3 (what is the existing pipeline named?) and
    // pins down the stage object shape the published schema leaves untyped.
    observed: pipelines,
  });

  const users = await compareVersions(
    'GET',
    `/users/?locationId=${encodeURIComponent(LOCATION_ID)}`
  );
  const userBody = (users.v3.ok ? users.v3.body : users.dated.body) as {
    users?: Array<Record<string, unknown>>;
  } | null;
  record({
    id: 'pre.users',
    title: 'GET /users/',
    verdict: users.v3.ok || users.dated.ok ? 'PASS' : 'FAIL',
    detail:
      `v3=${users.v3.status} dated=${users.dated.status} — ` +
      `${userBody?.users?.length ?? 0} user(s)`,
    // Backs the role-to-user mapping: these are the only valid assignees.
    observed: userBody?.users?.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    })),
  });

  const fields = await compareVersions(
    'GET',
    `/locations/${LOCATION_ID}/customFields`
  );
  const fieldBody = (fields.v3.ok ? fields.v3.body : fields.dated.body) as {
    customFields?: Array<Record<string, unknown>>;
  } | null;
  record({
    id: 'pre.customFields',
    title: 'GET /locations/{id}/customFields',
    verdict: fields.v3.ok || fields.dated.ok ? 'PASS' : 'FAIL',
    // Answers Open Question 5 (do the panamia_* custom fields exist?).
    detail:
      `v3=${fields.v3.status} dated=${fields.dated.status} — ` +
      `panamia_* fields: ${
        fieldBody?.customFields
          ?.map((f) => String(f.fieldKey ?? f.name ?? ''))
          .filter((k) => k.includes('panamia'))
          .join(', ') || 'none'
      }`,
    observed: fieldBody?.customFields?.map((f) => ({
      id: f.id,
      name: f.name,
      fieldKey: f.fieldKey,
    })),
  });

  if (READ_ONLY) {
    await finish();
    return;
  }

  // --- Writes -------------------------------------------------------------
  console.log('\nContact creation');

  const testEmail = `test-contact-${runId}@${TEST_EMAIL_DOMAIN}`;
  const contactBody = {
    firstName: 'Test',
    lastName: `Contact ${runId}`,
    name: `Test Contact ${runId}`,
    email: testEmail,
    locationId: LOCATION_ID,
    source: 'pana.social contact-us probe',
    tags: ['unverified', 'source:contact-us', 'inquiry:general'],
  };

  let contactId: string | null = null;

  if (await confirm(`Create contact ${testEmail}?`)) {
    // Try v3 first; fall back to the dated version so a rejection tells us
    // which spelling the deployed API enforces rather than just failing.
    let attempt = await call('POST', '/contacts/', 'v3', contactBody);
    let usedVersion = 'v3';
    if (!attempt.ok) {
      attempt = await call('POST', '/contacts/', '2021-07-28', contactBody);
      usedVersion = '2021-07-28';
    }

    const body = attempt.body as {
      contact?: { id?: string; tags?: string[] };
      meta?: { contactId?: string };
    } | null;
    contactId = body?.contact?.id ?? null;
    if (contactId) created.contactIds.push(contactId);

    record({
      id: 'contact.create',
      title: 'POST /contacts/',
      verdict: attempt.ok && contactId ? 'PASS' : 'FAIL',
      detail: `${attempt.status} via Version:${usedVersion} — id=${contactId ?? 'none'}`,
      observed: {
        acceptedVersion: attempt.ok ? usedVersion : null,
        status: attempt.status,
        responseKeys: shapeOf(attempt.body),
        tagsEchoed: body?.contact?.tags,
        body: attempt.ok ? undefined : summarize(attempt.body),
      },
    });

    // Duplicate handling decides whether routing can create-then-recover or
    // must search first. Re-POSTing the identical body is the only way to
    // observe it.
    if (
      contactId &&
      (await confirm('Re-POST the same contact to test duplicate handling?'))
    ) {
      const dup = await call('POST', '/contacts/', usedVersion, contactBody);
      const dupBody = dup.body as {
        contact?: { id?: string };
        meta?: { contactId?: string };
      } | null;
      const surfacedId =
        dupBody?.meta?.contactId ?? dupBody?.contact?.id ?? null;
      // A second 2xx means the location allows duplicates — that record is
      // ours too, so track it for teardown.
      if (dup.ok && dupBody?.contact?.id && dupBody.contact.id !== contactId) {
        created.contactIds.push(dupBody.contact.id);
      }
      record({
        id: 'contact.duplicate',
        title: 'POST /contacts/ (duplicate)',
        verdict: surfacedId ? 'PASS' : 'FAIL',
        detail: dup.ok
          ? `${dup.status} — location ALLOWS duplicates (new id=${dupBody?.contact?.id})`
          : `${dup.status} — rejected; meta.contactId=${dupBody?.meta?.contactId ?? 'absent'}`,
        observed: {
          status: dup.status,
          allowsDuplicates: dup.ok,
          recoverableId: surfacedId,
          body: summarize(dup.body),
        },
      });
    }
  } else {
    record({
      id: 'contact.create',
      title: 'POST /contacts/',
      verdict: 'SKIP',
      detail: 'declined',
    });
  }

  // --- Tags ---------------------------------------------------------------
  if (contactId && (await confirm('Add tag "inquiry:press" to the contact?'))) {
    const before = await call('GET', `/contacts/${contactId}`, '2021-07-28');
    const beforeTags =
      (before.body as { contact?: { tags?: string[] } })?.contact?.tags ?? [];

    const add = await call(
      'POST',
      `/contacts/${contactId}/tags`,
      '2021-07-28',
      {
        tags: ['inquiry:press'],
      }
    );

    const after = await call('GET', `/contacts/${contactId}`, '2021-07-28');
    const afterTags =
      (after.body as { contact?: { tags?: string[] } })?.contact?.tags ?? [];

    // Additive is the requirement: routing must never clobber tags written by
    // the Stripe relay. Verified by re-reading, not by trusting the response.
    const additive =
      beforeTags.every((t) => afterTags.includes(t)) &&
      afterTags.includes('inquiry:press');

    record({
      id: 'contact.addTag',
      title: 'POST /contacts/{id}/tags',
      verdict: add.ok && additive ? 'PASS' : 'FAIL',
      detail: `${add.status} — additive=${additive} (${beforeTags.length}→${afterTags.length} tags)`,
      observed: { beforeTags, afterTags, responseKeys: shapeOf(add.body) },
    });
  }

  // --- Tasks --------------------------------------------------------------
  const assignee =
    (userBody?.users?.[0]?.id as string | undefined) ?? undefined;

  if (contactId && (await confirm('Create a task on the contact?'))) {
    const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const taskBody = {
      title: `Contact Us inquiry — Test Contact ${runId}`,
      body: 'Probe record. Safe to delete.',
      dueDate,
      completed: false,
      ...(assignee ? { assignedTo: assignee } : {}),
    };

    let attempt = await call(
      'POST',
      `/contacts/${contactId}/tasks`,
      'v3',
      taskBody
    );
    let usedVersion = 'v3';
    if (!attempt.ok) {
      attempt = await call(
        'POST',
        `/contacts/${contactId}/tasks`,
        '2021-07-28',
        taskBody
      );
      usedVersion = '2021-07-28';
    }

    const task = (
      attempt.body as {
        task?: { id?: string; assignedTo?: string; body?: string };
      }
    )?.task;
    if (task?.id) created.tasks.push({ contactId, taskId: task.id });

    record({
      id: 'task.create',
      title: 'POST /contacts/{id}/tasks',
      verdict: attempt.ok && task?.id ? 'PASS' : 'FAIL',
      detail:
        `${attempt.status} via Version:${usedVersion} — id=${task?.id ?? 'none'} ` +
        `assignedTo=${task?.assignedTo ?? 'UNASSIGNED'}`,
      observed: {
        acceptedVersion: attempt.ok ? usedVersion : null,
        // The spec requires every routed item to have an owner; if the API
        // silently drops assignedTo, that requirement is unmet.
        assignmentHeld: Boolean(assignee) && task?.assignedTo === assignee,
        // The Task carries the inquiry text, so a silently-dropped or
        // truncated body would defeat the point of routing it there.
        bodyEchoed: task?.body,
        responseKeys: shapeOf(attempt.body),
        body: attempt.ok ? undefined : summarize(attempt.body),
      },
    });

    // --- Task completion round trip (Phase 4b) --------------------------
    // Outbound: admin resolves in the app queue -> mark the GHL task done.
    // Inbound:  the bridge polls the task list and flips the app row.
    // Both halves are exercised here because the whole of task sync rests on
    // them, and neither has ever been run against this account.
    if (task?.id) {
      const listBefore = await call(
        'GET',
        `/contacts/${contactId}/tasks`,
        '2021-07-28'
      );
      const tasksBefore =
        (
          listBefore.body as {
            tasks?: Array<{ id?: string; completed?: boolean }>;
          }
        )?.tasks ?? [];
      record({
        id: 'task.list',
        title: 'GET /contacts/{id}/tasks',
        verdict: listBefore.ok && tasksBefore.length > 0 ? 'PASS' : 'FAIL',
        detail: `${listBefore.status} — ${tasksBefore.length} task(s); this is the inbound poll`,
        observed: {
          responseKeys: shapeOf(listBefore.body),
          completedFlagPresent: tasksBefore.some(
            (t) => typeof t.completed === 'boolean'
          ),
        },
      });

      const complete = await call(
        'PUT',
        `/contacts/${contactId}/tasks/${task.id}/completed`,
        '2021-07-28',
        { completed: true }
      );

      // Trust the re-read, not the response: the poll is what production will
      // rely on, so completion has to be visible *there*.
      const listAfter = await call(
        'GET',
        `/contacts/${contactId}/tasks`,
        '2021-07-28'
      );
      const seen = (
        (
          listAfter.body as {
            tasks?: Array<{ id?: string; completed?: boolean }>;
          }
        )?.tasks ?? []
      ).find((t) => t.id === task.id);

      record({
        id: 'task.complete',
        title: 'PUT /contacts/{id}/tasks/{taskId}/completed',
        verdict: complete.ok && seen?.completed === true ? 'PASS' : 'FAIL',
        detail:
          `${complete.status} — completed reads back as ${String(seen?.completed)}` +
          (complete.ok && seen?.completed !== true
            ? ' (WRITE ACCEPTED BUT NOT REFLECTED — task sync would silently no-op)'
            : ''),
        observed: {
          status: complete.status,
          reReadCompleted: seen?.completed,
          responseKeys: shapeOf(complete.body),
          body: complete.ok ? undefined : summarize(complete.body),
        },
      });
    }
  }

  // --- Opportunities ------------------------------------------------------
  type Pipeline = {
    id?: string;
    name?: string;
    stages?: Array<{ id?: string; name?: string }>;
  };

  // Never guess the pipeline. The spec is explicit that a paying member who
  // sends an inquiry must not be moved out of their membership state, so
  // writing a probe opportunity into the wrong pipeline is the mistake to
  // avoid. Prefer the passed ID; otherwise ask; otherwise skip.
  //
  // Note there is no membership pipeline to collide with yet: the one described
  // in CRM-ROADMAP.md is unimplemented, and membership state is currently
  // carried by tags (panamia-subscriber, panamia-churned) written by the Stripe
  // relay. Whatever this call returns is therefore pre-existing GHL structure,
  // not anything the app maintains — which is itself worth reading in the log.
  let pipeline: Pipeline | undefined;
  if (PIPELINE_ID) {
    pipeline = (pipelines as Pipeline[]).find((p) => p.id === PIPELINE_ID);
    if (!pipeline) {
      record({
        id: 'opportunity.create',
        title: 'POST /opportunities/',
        verdict: 'SKIP',
        detail: `GHL_INQUIRIES_PIPELINE_ID=${PIPELINE_ID} matches no pipeline on this location`,
      });
    }
  } else if (contactId && pipelines.length > 0 && !AUTO_YES) {
    console.log('\n  Pipelines on this location:');
    pipelines.forEach((p, i) => console.log(`    ${i + 1}. ${p.name}`));
    rl ??= createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      '  Which to create the test opportunity in? [number, or blank to skip] '
    );
    const idx = Number.parseInt(answer.trim(), 10);
    if (Number.isInteger(idx) && idx >= 1 && idx <= pipelines.length) {
      pipeline = pipelines[idx - 1] as Pipeline;
    } else {
      record({
        id: 'opportunity.create',
        title: 'POST /opportunities/',
        verdict: 'SKIP',
        detail: 'no pipeline chosen',
      });
    }
  } else if (contactId && pipelines.length > 0) {
    record({
      id: 'opportunity.create',
      title: 'POST /opportunities/',
      verdict: 'SKIP',
      detail:
        '--yes with no GHL_INQUIRIES_PIPELINE_ID — refusing to guess a pipeline',
    });
  }

  if (
    contactId &&
    pipeline?.id &&
    (await confirm(`Create an opportunity in pipeline "${pipeline.name}"?`))
  ) {
    const stageId = pipeline.stages?.[0]?.id;
    const oppBody = {
      pipelineId: pipeline.id,
      locationId: LOCATION_ID,
      name: `Press inquiry — Test Contact ${runId}`,
      status: 'open',
      contactId,
      ...(stageId ? { pipelineStageId: stageId } : {}),
      ...(assignee ? { assignedTo: assignee } : {}),
    };

    let attempt = await call('POST', '/opportunities/', 'v3', oppBody);
    let usedVersion = 'v3';
    if (!attempt.ok) {
      attempt = await call('POST', '/opportunities/', '2021-07-28', oppBody);
      usedVersion = '2021-07-28';
    }

    const opp = (
      attempt.body as {
        opportunity?: { id?: string; assignedTo?: string; status?: string };
      }
    )?.opportunity;
    if (opp?.id) created.opportunityIds.push(opp.id);

    record({
      id: 'opportunity.create',
      title: 'POST /opportunities/',
      verdict: attempt.ok && opp?.id ? 'PASS' : 'FAIL',
      detail:
        `${attempt.status} via Version:${usedVersion} — id=${opp?.id ?? 'none'} ` +
        `status=${opp?.status} assignedTo=${opp?.assignedTo ?? 'UNASSIGNED'}`,
      observed: {
        acceptedVersion: attempt.ok ? usedVersion : null,
        stageUsed: stageId ?? '(pipeline default)',
        responseKeys: shapeOf(attempt.body),
        body: attempt.ok ? undefined : summarize(attempt.body),
      },
    });

    // Stage transition is the outbound half of bilateral sync.
    const secondStage = pipeline.stages?.[1]?.id;
    if (opp?.id && secondStage) {
      const moved = await call(
        'PUT',
        `/opportunities/${opp.id}`,
        '2021-07-28',
        {
          pipelineStageId: secondStage,
        }
      );
      record({
        id: 'opportunity.updateStage',
        title: 'PUT /opportunities/{id}',
        verdict: moved.ok ? 'PASS' : 'FAIL',
        detail: `${moved.status} — moved to stage ${pipeline.stages?.[1]?.name}`,
        observed: { status: moved.status, responseKeys: shapeOf(moved.body) },
      });
    }
  }

  // --- Stale-ID reconciliation -------------------------------------------
  // The merge story depends on a deleted/merged contact returning 404 rather
  // than some other status. Probed with a well-formed but nonexistent ID.
  const ghost = await call(
    'GET',
    '/contacts/ZZZZprobe000000ZZZZ',
    '2021-07-28'
  );
  record({
    id: 'contact.staleId',
    title: 'GET /contacts/{unknown-id}',
    verdict: ghost.status === 404 ? 'PASS' : 'FAIL',
    detail: `${ghost.status} — resolveContactId() re-resolves only on 404`,
    observed: { status: ghost.status, body: summarize(ghost.body) },
  });

  await teardown();
  await finish();
}

async function teardown(): Promise<void> {
  if (KEEP) {
    console.log('\nTeardown skipped (--keep). Records left behind:');
    console.log(JSON.stringify(created, null, 2));
    return;
  }
  if (
    !created.contactIds.length &&
    !created.tasks.length &&
    !created.opportunityIds.length
  ) {
    return;
  }

  console.log('\nTeardown');
  for (const id of created.opportunityIds) {
    const res = await call('DELETE', `/opportunities/${id}`, '2021-07-28');
    record({
      id: 'teardown.opportunity',
      title: 'DELETE /opportunities/{id}',
      verdict: res.ok ? 'PASS' : 'FAIL',
      detail: `${res.status} — ${id}`,
    });
  }
  for (const { contactId, taskId } of created.tasks) {
    const res = await call(
      'DELETE',
      `/contacts/${contactId}/tasks/${taskId}`,
      '2021-07-28'
    );
    record({
      id: 'teardown.task',
      title: 'DELETE /contacts/{id}/tasks/{taskId}',
      verdict: res.ok ? 'PASS' : 'FAIL',
      detail: `${res.status} — ${taskId}`,
    });
  }
  // Contacts last: deleting a contact may cascade its tasks, and we want the
  // task deletes measured on their own.
  for (const id of created.contactIds) {
    const res = await call('DELETE', `/contacts/${id}`, '2021-07-28');
    record({
      id: 'teardown.contact',
      title: 'DELETE /contacts/{id}',
      verdict: res.ok ? 'PASS' : 'FAIL',
      detail: `${res.status} — ${id}`,
    });
  }
}

async function finish(): Promise<void> {
  rl?.close();

  const pass = results.filter((r) => r.verdict === 'PASS').length;
  const fail = results.filter((r) => r.verdict === 'FAIL').length;
  const skip = results.filter((r) => r.verdict === 'SKIP').length;

  mkdirSync(LOG_DIR, { recursive: true });

  const jsonPath = join(LOG_DIR, `${runId}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      { runId, locationId: LOCATION_ID, at: new Date().toISOString(), results },
      null,
      2
    )
  );

  const md = [
    `# GHL capability probe — ${runId}`,
    '',
    `Location: \`${LOCATION_ID}\`  `,
    `Run at: ${new Date().toISOString()}  `,
    `Result: **${pass} pass, ${fail} fail, ${skip} skipped**`,
    '',
    '| Step | Endpoint | Verdict | Detail |',
    '| --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| \`${r.id}\` | \`${r.title}\` | ${r.verdict} | ${r.detail.replace(/\|/g, '\\|')} |`
    ),
    '',
    '## Observed',
    '',
    '```json',
    JSON.stringify(
      results
        .filter((r) => r.observed !== undefined)
        .map((r) => ({ id: r.id, observed: r.observed })),
      null,
      2
    ),
    '```',
    '',
  ].join('\n');
  const mdPath = join(LOG_DIR, `${runId}.md`);
  writeFileSync(mdPath, md);

  console.log(`\n${pass} pass, ${fail} fail, ${skip} skipped`);
  console.log(`log: ${mdPath}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nProbe aborted:', err);
  console.error(
    'Records possibly left behind:',
    JSON.stringify(created, null, 2)
  );
  rl?.close();
  process.exit(1);
});
