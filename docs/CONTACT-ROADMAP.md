# Contact Us Routing Roadmap

Routing design for `/form/contact-us` submissions across the Panamia app and
GoHighLevel (GHL). Companion to [CRM-ROADMAP.md](./CRM-ROADMAP.md), which covers
the broader GHL integration; this document covers only the inquiry path.

Status: specification. The GHL client surface this design needs exists in
`lib/ghl.ts`, and `scripts/ghl-verify.ts` probes it against the live account —
but no routing is wired up, and the request shapes it uses are unverified until
that probe has been run. Phases 1–7 below are all outstanding.

---

## Goals

1. **Route what needs a team, keep what doesn't.** Technical questions are
   answerable by whoever runs the site; press and partnership inquiries are not.
   Route each to the surface where the person who can answer it already works.
2. **Never lose a press inquiry.** This is the highest-cost failure mode and the
   one least likely to arrive from an authenticated user.
3. **Do not create CRM records from unverified input without marking them as
   such.** Anyone can type any address into a public form.
4. **Give every routed inquiry an owner.** Unowned work in a shared inbox is
   the failure mode this design exists to avoid.
5. **Audit app-initiated CRM writes.** Currently nothing records them.

---

## Context

### What exists today

`POST /api/createContactUs` validates the submission, verifies Turnstile, writes
a row to `contact_submissions` (status `open`), and sends a receipt to the
sender. Admins read the queue at `/account/admin/contactus` and flip status via
`PATCH /api/admin/contactSubmissions`.

Nobody on the team is notified of a submission. Nothing reaches GHL. The queue
is poll-only.

This makes Contact Us the outlier among the app's forms: newsletter, profile,
and affiliate submissions all send an `admin.*` notification. Those notifications
resolve their recipient through `sendTemplateEmail`'s fallback in `lib/email.ts`,
which is `DEV_RECEIVER_EMAIL || ADMIN_EMAILS.split(',')[0]` — **the first admin
entry only**. The single existing fan-out to all admins is
`notifyAdminsOfReport` in `lib/server/relay-reports.ts`.

### Relevant GHL mechanics

- A **Conversation** hangs off a **Contact**. There is no way to place a message
  in the shared inbox without a contact record.
- Conversations have **no resolution state**. The primitives are read/unread
  (shared at the location level, not per user), starred, and assignment.
  Assignment lives on the _contact_; the conversation inherits it.
- The only GHL objects with a workable lifecycle are **Opportunities**
  (`open|won|lost|abandoned` plus pipeline stage) and **Tasks** (owner, due
  date, done).
- Nothing is promoted into an Opportunity automatically. Promotion happens
  manually in the UI, via a Workflow action, or via `POST /opportunities/`.
- Contact **merge** is a manual dashboard action. It is irreversible and
  invalidates the absorbed contact's ID.

### Constraints inherited from the existing integration

- `profiles.ghlOptedOut` means the user deleted their marketing data through the
  privacy portal. Recreating their contact would undo an explicit deletion.
- New tables must be classified in `lib/legal/data-inventory.ts` or the build
  fails, and migrations are hand-written.

---

## Approach

### Routing matrix

Category determines routing. Authentication determines only whether the contact
carries the `unverified` tag.

| Category                         | App       | GHL                                        |
| -------------------------------- | --------- | ------------------------------------------ |
| `technical`                      | queue row | none                                       |
| `press`                          | queue row | contact + Opportunity (Inquiries pipeline) |
| `membership`, `general`, `other` | queue row | contact + Task                             |

Overrides:

- `ghlOptedOut` on the submitter's profile forces app-only, regardless of
  category. Recreating that contact would undo an explicit deletion.
- Unauthenticated submissions add the `unverified` tag to the contact.
- Unauthenticated `press` additionally emails every `ADMIN_EMAILS` entry.

The app queue remains the system of record for intake in every case. GHL
receives a parallel work item, never a replacement record.

### Why Tasks for most authenticated inquiries

A Task carries an owner, a due date, and a done state — the state machine
Conversations lacks — without creating a pipeline entry. Reserving Opportunities
for press keeps pipeline metrics meaningful. An inquiry that turns out to be
substantial can be promoted to an Opportunity by hand.

### Unverified contacts

Every unauthenticated submission in a GHL-bound category creates a contact per
sender, tagged `unverified` and `source:contact-us`. These contacts:

- are excluded from every marketing audience by the `unverified` tag,
- are never enrolled in workflows,
- never have DND cleared.

They are **not** purged on a schedule. An earlier draft had a bridge cron job
deleting unworked unverified contacts at 90 days; it was cut.

The cheap part of that job was the delete. The expensive part was the predicate
— "never worked and never merged" requires reading task state, opportunity
state, and detecting a merge that the API gives no direct signal for, and
getting it wrong means deleting a contact a human had just consolidated. That
is a lot of moving parts guarding against a cost nobody has measured: Open
Question 7 (plan contact limit and headroom) is still unanswered, and Contact Us
volume is low enough that the honest answer may be that it never matters.

Deferring costs nothing, because the tags are the cleanup mechanism. Every
contact this path creates carries `unverified` and `source:contact-us`, so
purging is a dashboard filter-select-delete whenever the count justifies it —
no code, no scheduler, no merge heuristic. If volume ever makes that tedious,
the job can be written then, against real numbers.

What this accepts: a spam wave that clears Turnstile inflates contact count with
no automatic relief, and someone has to remember to clean up. The app's
indefinite retention means nothing is lost either way, so the exposure is
billing and clutter, not data.

### Merge and reconciliation

When a human confirms an unverified contact is the same person as a real one,
they merge the two in the GHL dashboard. The absorbed contact's ID then no
longer resolves.

The app must therefore treat stored GHL contact IDs as **caches, not
references**: a 404 from a contact read triggers re-resolution by email, and the
stored ID is updated or cleared. This applies to `profiles.ghlContactId` as well
as any ID stored on a submission.

### Tags

| Tag                  | Applied to                                            |
| -------------------- | ----------------------------------------------------- |
| `source:contact-us`  | every contact created or updated by this path         |
| `inquiry:{category}` | mirrors the submission category                       |
| `unverified`         | contacts originating from unauthenticated submissions |

Existing tag conventions have drifted three ways (`panamia-*` from the worker,
`form:newsletter` from the bridge, `inactive-30d` from the sweep). Normalizing
them is out of scope here but should be tracked.

### GHL structure

Inquiries get their own pipeline, separate from anything tracking membership. A
paying member who sends a press inquiry must not be moved out of their
membership state to represent it; a contact can hold an opportunity in each
pipeline at once.

- **Inquiries** (new) — one short-lived Opportunity per press inquiry, or per
  manually promoted Task. Stages: New, Assigned, Awaiting Reply, Resolved.
  Terminal states map to `won` (resolved) and `abandoned` (dismissed).

Membership tracking is out of scope here — see
[CRM-ROADMAP.md](./CRM-ROADMAP.md). Note that the membership pipeline described
there is not implemented; membership state is currently carried by tags
(`panamia-subscriber`, `panamia-churned`) written by the Stripe relay.

Roles: at minimum a press/partnerships owner and a membership owner. The app
stores a role-to-GHL-user mapping in configuration rather than hardcoding user
IDs, so staffing changes do not require a deploy.

### Notifications

Category-routed, and a pointer rather than a copy: sender, category, submission
ID, and a deep link into the admin queue, with `Reply-To` set to the sender.

- `technical`, `general` — site operators
- `press`, `membership` — team role address
- unauthenticated `press` — additionally fans out to every `ADMIN_EMAILS`
  entry, modeled on `notifyAdminsOfReport`

Fan-out is deliberately limited to unauthenticated press. Broad notifications
that fire frequently get filtered, which is the failure this design is
correcting.

### GHL linkage is not a status

A submission records what it created in GHL — `ghl_contact_id`, plus
`ghl_task_id` or `ghl_opportunity_id` — as separate columns, never folded into
`contact_submission_status`.

The status enum keeps its three values because the normal case is _routed to GHL
and still open_: the work has an owner over there, and nobody has replied yet.
Collapsing "it's in GHL" into `actioned` would destroy the "still needs a reply"
signal and break the `asc(status)` ordering the admin route relies on to float
open work to the top.

`ghl_opportunity_id` is also what bilateral sync keys on.

There is no app-side escalate action. Routing is deterministic from the
category, and the cases it would have covered are all handled elsewhere:
promoting a Task to an Opportunity is a GHL dashboard action, a misfiled
`technical` inquiry is rare enough to handle the same way, and an opted-out
submitter must not get a contact created at all.

### Audit

A `crm_audit_log` table modeled on `deletion_logs`: bare actor and subject IDs
with no FK (so rows outlive the account), GHL contact and opportunity IDs, an
operation enum, a source discriminator, redacted request and response summaries,
success, and error.

Scope: all app-initiated GHL writes — including the four existing
`app/api/crm/*` privacy portal routes, which are the most consequential CRM
mutations in the codebase and are currently unaudited — plus the inbound webhook
path once it writes app state. The outbound cron jobs (`newsletter-sync`,
`contact-sync`, `inactive-sweep`) are excluded as idempotent and low
consequence.

The log doubles as the echo filter for bilateral sync (below).

### The app is the system of record

GHL holds working copies with a weaker guarantee than the app's. A dashboard
merge silently invalidates the absorbed contact's ID, and unverified contacts
are deleted by hand whenever the count justifies it. Both are routine, and both
destroy CRM state that the app row survives — so the queue is authoritative for
what was asked and when, and GHL is authoritative only for who is working it and
whether they are done.

Where the two disagree about resolution, GHL wins the _signal_ and the app wins
the _record_: an inbound completion updates `contact_submission_status`, and
that column remains the value every other surface reads.

Retention follows from this. Contact Us submissions are their own privacy
category (`contact_inquiries` in `policy.json`), classed as a compliance record
with a secondary `third_party_synced` class, retained indefinitely, and not tied
to account lifetime — most inquiries arrive from people who never had an
account. Deleting a submission once it reached GHL would make a routine CRM
cleanup capable of destroying the last copy of an unworked press inquiry, which
is the exact failure Goal 2 names.

### Inquiry text in GHL

The Task carries the message body, not just a pointer. Routing an inquiry to
"where its answerer already works" fails its own goal if answering still
requires switching to the admin console to read what was asked.

`POST /contacts/{contactId}/tasks` accepts an optional `body` string, so this is
free mechanically. It is not free legally: the message becomes third-party data,
so `inquiry_message` is declared on the GoHighLevel provider entry and on the
`crm` category in `policy.json`.

The copy is truncated with a deep link back to the submission. The app holds the
full text, GHL holds enough to answer from, and a long message cannot fail the
task write against an undocumented field limit.

### Bilateral sync

Two mechanisms, because the two object types differ in what they can signal.

**Opportunities (`press`).** Outbound: a `press` submission creates the
Opportunity at intake; app status changes push stage updates. Inbound: a GHL
**Workflow with an outbound webhook action** on opportunity stage change,
delivered to the bridge. A workflow webhook is preferred over the native webhook
subscription because the payload shape is author-controlled, which sidesteps
guessing GHL's event names.

**Tasks (`membership`, `general`, `other`).** Outbound: resolving a submission
in the admin queue calls `PUT /contacts/{id}/tasks/{taskId}/completed` — the
narrow endpoint, so a sync write can never clobber a title, due date, or
assignee a human edited. Inbound: a Workflow **Webhook (Outbound)** action fired
on task completion, delivered to the bridge.

**Webhooks supersede polling.** Both directions of this design are webhook-based
once the path is proven; polling is not the target state for either object type.
The Workflow webhook action is a supported, documented GHL feature —
[Workflow Action: Webhook (Outbound)][ghl-webhook] — with a configurable method
and URL, and a Custom Data section of key/value pairs supporting merge fields
(`{{contact.source}}`). Payloads carry contact and location data by default;
other objects, tasks included, appear only when the workflow's trigger
references them, so the trigger choice determines whether `taskId` is even in
the body.

[ghl-webhook]: https://help.gohighlevel.com/support/solutions/articles/155000003299-workflow-action-webhook-outbound-

Two things the action's documentation does not provide, both of which the
implementation has to answer rather than assume:

- **No authentication or signing.** No configurable headers and no HMAC are
  documented. This matters because `handlers/webhook-ghl.ts` currently requires
  a signature on `x-wm-hmac-sha256` and 401s without one — that handler was
  written for the native webhook subscription and would reject every workflow
  delivery. Authentication has to move to something the action can actually
  send: a shared secret in Custom Data, or an unguessable path segment, ideally
  both, over HTTPS only.
- **No documented retry.** Nothing states what happens to a delivery the bridge
  misses or 500s on. Until that is observed, a dropped delivery is a submission
  stranded at `open` with no second chance.

Because of the second point, a low-frequency reconciliation sweep over
`open` submissions holding a `ghl_task_id` stays in the design as a backstop —
not as the sync mechanism, but as the thing that notices when the webhook did
not arrive. If deliveries prove reliable in practice, the sweep interval can be
widened or the sweep dropped.

**Task Completed is a confirmed trigger**, with an optional Assigned User filter
and filters on task custom fields. Two consequences follow from how those
filters behave.

_The trigger fires account-wide by default._ Assigned User is optional, so an
unfiltered workflow fires whenever any user completes any task anywhere in the
location — not only the ones this path created. The bridge therefore **scopes by
matching the delivered task against a `ghl_task_id` on a submission** and
ignores anything that does not match. Correctness lives in that match, never in
the workflow filter: a filter is dashboard configuration that can be edited or
misconfigured by someone with no idea it feeds the app, and it cannot scope
reliably anyway, because the inquiry owner is a real person with unrelated tasks
of their own. Treat the filter as noise reduction only.

_Assignment becomes load-bearing._ GHL's own caveat is that an unassigned task
makes the Assigned User filter behave unexpectedly. Assignment was already
required by Goal 4 to keep work from landing in an unowned pile; it is now also
what keeps that filter meaningful, so a silently dropped `assignedTo` is a sync
defect and not merely an ownership one. `scripts/ghl-verify.ts` asserts the
assignee survives task creation for exactly this reason.

Loop prevention: the inbound handler compares the incoming state against the
most recent outbound `crm_audit_log` row for that object and drops matching
echoes. This covers both mechanisms.

A completed task maps to `actioned`. The distinction between "someone worked
it" and "the sender got a reply" is real but not worth a second state column:
the person ticking the task done is the person who answered, and every status
transition is reversible if they were premature.

---

## Advantages

- **Each inquiry lands where its answerer already works.** No new tool for
  anyone to learn or ignore.
- **No human gate on the critical path.** Routing is deterministic from the
  category, so an inquiry cannot rot waiting for someone to notice it and press
  a button.
- **One routing axis.** Category decides where work goes; authentication only
  decides how the contact is labeled. Half the matrix disappeared with the
  escalate gate.
- **Pipeline stays meaningful.** Reserving Opportunities for press, and keeping
  inquiries out of the membership pipeline, prevents both from becoming noise.
- **Consent model holds.** Authenticated submitters are verified; `ghlOptedOut`
  is respected; unverified contacts are quarantined and expire.
- **Fixes the ownership gap directly.** Tasks and Opportunities both carry an
  assignee, so nothing lands in an unowned pile.
- **Incrementally deliverable.** The notification change is independent of every
  GHL dashboard question and can ship first.

---

## Known Limitations

- **Contact count is now a billing vector, and nothing bounds it
  automatically.** Auto-routing every non-technical submission creates a GHL
  contact per inquiry, GHL plans commonly meter contact count, and with the
  scheduled purge cut, accumulation is reclaimed only when someone runs a
  tag-filtered delete in the dashboard. Confirm the plan's limit and current
  headroom before Phase 4 — this is the one open question that could still
  justify a manual routing gate.
- **Unverified contacts are records built from addresses nobody confirmed.** The
  `unverified` tag bounds the exposure; it does not eliminate it. Turnstile gates
  volume but not a determined human, so impersonation (submitting under someone
  else's address) produces a junk contact that a human has to spot.
- **Merge is manual and irreversible.** There is no API path, so consolidating a
  duplicate is a dashboard action with no undo, and the app can only react to the
  result rather than participate in it.
- **Read state in GHL Conversations is shared, not per user.** Any triage view
  built on unread is fragile. This design routes around it rather than fixing it.
- **The inbound webhook path is unproven, and the existing handler targets the
  wrong mechanism.** `handlers/webhook-ghl.ts` has never been verified against a
  real delivery; its signature header and event names are assumptions, and it
  was written for the native webhook subscription rather than the Workflow
  action this design uses. It handles only `contact.delete` and
  `contact.dnd_update` — nothing for tasks or opportunities. Treat it as a
  starting point to rewrite, not a working receiver.
- **Instagram remains outside the app entirely.** The design unifies IG and
  Contact Us only at the Inquiries pipeline, by human promotion. The app never
  ingests IG messages.
- **IG-originated contacts usually have no email**, so they cannot be matched to
  app users and will not merge cleanly with app-created contacts.
- **Two systems still hold inquiry state.** The app queue is authoritative for
  intake and GHL for work, and bilateral sync keeps them aligned. That is a
  reconciliation surface, and reconciliation surfaces drift.
- **Webhook delivery has no documented guarantee.** The Webhook (Outbound)
  action's documentation states no retry behavior, so a delivery the bridge
  misses may simply be lost, stranding a submission at `open`. This is why a
  reconciliation sweep stays in the design behind the webhook, and why "webhooks
  supersede polling" means the webhook carries the signal, not that nothing
  checks the result.
- **Workflow webhooks cannot authenticate themselves.** No configurable headers
  and no signing are documented, so the receiver's only options are a shared
  secret in Custom Data and an unguessable path. Both are bearer secrets in a
  URL or body rather than a signature over the payload, which is weaker than
  what `handlers/webhook-ghl.ts` was written to expect.
- **Copying inquiry text to GHL widens the third-party surface.** A message
  written by someone who is not signed in — and whose address nobody has
  confirmed — is replicated to a CRM the sender was never told about at the
  point of writing. The truncation bounds the volume, not the principle; the
  Contact Us form's disclosure needs to name the CRM.
- **Promotion breaks the chain, and is left broken.** Promoting a Task to an
  Opportunity is a dashboard action, so the app never learns a
  `ghl_opportunity_id` exists and the row stays `open` until closed by hand.
  Judged rare enough not to design around.
- **Role mapping is configuration.** If a role's GHL user is deactivated,
  assignment fails silently unless the sync path checks.

---

## Open Questions (require GHL dashboard access)

1. Is conversation read state shared across users? Verify by opening a thread on
   one seat and checking a second.
2. Does any Workflow currently listen to `Inbound Message`?
3. What is the existing pipeline actually named, and what are its stages?
4. Is the GHL webhook registered, and what signature header and event names does
   it send?
5. Do the `panamia_*` custom fields exist in the account?
6. Are GHL-hosted forms creating contacts the app has no record of?
7. What is the plan's contact limit and current headroom? (Gates Phase 4 — see
   Known Limitations.)
8. ~~Is there a workflow trigger for task completion?~~ **Answered: yes.** Task
   Completed exists, with an optional Assigned User filter and custom-field
   filters. Unfiltered it fires account-wide, which is why the bridge scopes on
   `ghl_task_id` rather than on the filter — see Bilateral sync.
9. What does a Workflow webhook delivery actually look like on the wire —
   headers, body shape, and whether a failed delivery is retried? Answers the
   authentication and backstop questions in Bilateral sync. **Specifically:
   does a Task Completed payload carry the task's own ID?** The whole scoping
   model depends on it; if the payload carries only contact fields, the bridge
   cannot tell which task completed and would have to re-read the contact's
   task list to find out.

---

## Phased Rollout

### Phase 1 — Role-address notifications

Category-routed staff notification with `Reply-To`, replacing the
`ADMIN_EMAILS[0]` fallback for Contact Us. All-admin fan-out for unauthenticated
press. No GHL dependency; unblocked by every open question above.

### Phase 2 — Audit log

`crm_audit_log` table (hand-written migration, `data-inventory.ts` entry), wired
into the four `app/api/crm/*` privacy portal routes first.

### Phase 3 — GHL structure

Create the Inquiries pipeline, define roles and the role-to-user mapping,
establish the tag conventions. Dashboard work; no code.

### Phase 4 — Category routing

Contact upsert gated on `ghlOptedOut`, Task creation for `membership` /
`general` / `other`, Opportunity creation for `press`, `unverified` tagging when
the submitter was not authenticated. Reconciliation-by-email on stale IDs.
Requires the contact-limit answer from Open Questions first.

Adds `ghl_contact_id`, `ghl_task_id`, and `ghl_opportunity_id` to
`contact_submissions` (hand-written migration). The Task carries the truncated
message body and a deep link back to the submission.

### Phase 4b — Task completion sync

Inbound Workflow webhook on task completion, flipping the submission to
`actioned`, plus the outbound `PUT .../completed` on admin resolve. Ships with
Phase 4 — without it the majority of routed inquiries never leave `open`.

Ungated — Task Completed is confirmed to exist (Open Question 8). The work is:

1. A Workflow on Task Completed with a Webhook (Outbound) action pointing at the
   bridge, carrying a shared secret in Custom Data.
2. A receiver that authenticates, resolves the delivery to a submission by
   `ghl_task_id`, ignores non-matching tasks, and drops echoes via
   `crm_audit_log`.
3. The outbound `PUT .../completed` on admin resolve.
4. A widely-spaced reconciliation sweep behind the webhook, since delivery is
   not guaranteed.

Shares its receiver, authentication, and echo suppression with Phase 7 — the two
differ only in which workflow fires and what the payload maps to, so building
them together avoids doing the unproven part twice.

### Phase 5 — Unverified purge (cut)

Dropped. Cleanup is a tag-filtered delete in the GHL dashboard, which the
`unverified` and `source:contact-us` tags make possible without any code. See
"Unverified contacts" above for what this trades away. Revisit only if the
contact-limit answer from Open Questions shows real pressure.

### Phase 6 — Admin queue surfacing

Deep link from a submission to its GHL Task or Opportunity, a badge showing
whether it routed to GHL, and queue filters for routed vs app-only.

### Phase 7 — Opportunity bilateral sync

Only after the webhook path is verified against a real delivery. Workflow
webhook to the bridge on opportunity stage change, stage-to-status mapping, echo
suppression via the audit log.

Shares its receiver, authentication, and echo-suppression machinery with Phase
4b — the two differ only in which workflow fires and what the payload maps to,
so building them together avoids doing the unproven part twice.
