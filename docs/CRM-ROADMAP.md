# CRM Integration Roadmap (GoHighLevel)

## Overview

GoHighLevel (GHL) is Panamia's CRM layer. It manages the **pre-signup funnel** (leads, marketing automation, re-engagement sequences) and continues tracking members after they sign up. GHL provides email/SMS marketing, pipeline management, and contact enrichment — capabilities that fall outside Panamia's core product scope and are deliberately kept separate.

The integration is designed around two concerns that must not be conflated:

1. **Privacy portal ("peaky window")** — a Settings page section that lets authenticated users read and manage their own GHL contact record directly. On-demand, user-driven, non-blocking.
2. **Dedicated CRM worker** — a background sync engine (`panamia-crm-bridge`) that keeps GHL contact fields, tags, and pipeline stages in sync with Panamia DB state. Invisible to users.

---

## Integration Model

**Model B: GHL is the superset. Panamia is System of Record post-signup.**

```
GHL contacts:
  ├── Leads (no Panamia account yet)
  │     └── GHL automation → user clicks link → signs up to Panamia
  │                                   ↓
  └── Linked users (ghlContactId stored on Panamia profile)
            ↓ one-way sync (dedicated CRM worker)
        Panamia DB changes → GHL contact field/tag/pipeline updates
```

GHL holds contacts from the moment they enter the funnel (event check-in, opt-in form, referral, etc.). When a lead signs up to Panamia, their GHL contact is linked via `ghlContactId` on the `profiles` table. From that point, the CRM worker pushes Panamia state changes to GHL; GHL automation reacts to those state changes to trigger sequences.

---

## System of Record

| Data                                     | System of Record                        | Notes                                                                      |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| Contact identity (name, email, phone)    | GHL (pre-signup), Panamia (post-signup) | Panamia is authoritative after signup; copy-to-profile is opt-in per field |
| Lead source / UTM / event check-in       | GHL                                     | Read-only in privacy portal; not copied to Panamia                         |
| Marketing preferences (DND, unsubscribe) | GHL                                     | Written by privacy portal; synced inbound via webhook                      |
| Member profile (bio, mentoring, roles)   | Panamia                                 | Pushed outbound to GHL custom fields by CRM worker                         |
| Subscription / payment status            | Panamia (Stripe)                        | CRM worker relays to GHL pipeline stage                                    |
| Pipeline stage                           | GHL                                     | CRM worker writes; sales rep may override manually                         |
| Tags                                     | GHL                                     | CRM worker writes; GHL automation reacts                                   |

---

## Contact Lifecycle

```
Entry points (lead sources)
        ↓
GHL contact created (lead)
        ↓
GHL automation sends nurture sequence
        ↓
User clicks link → signs up to Panamia
        ↓
Signup claim: ghlContactId linked to profile
        ↓
CRM worker: pushes profile fields, sets pipeline stage → "Active Member"
        ↓
Member subscribes (Stripe) → CRM worker: pipeline → "Paying Member"
        ↓
Member inactive 30d → CRM worker adds "inactive-30d" tag
        ↓
GHL automation fires re-engagement sequence
        ↓
Member cancels subscription → CRM worker: pipeline → "Churned"
```

---

## Lead Sources

Contacts enter GHL only through explicit opt-in or legitimate interaction:

| Source           | Mechanism                                                                |
| ---------------- | ------------------------------------------------------------------------ |
| Event check-in   | Organizer scans QR / enters email; GHL contact created with event tag    |
| Opt-in forms     | GHL-hosted or embedded forms on panamia.club                             |
| Referral         | Existing member shares link with UTM; landing page submits to GHL        |
| Abandoned signup | User starts Panamia signup but doesn't complete; email captured pre-auth |
| Manual import    | Admin imports attendee list from off-platform event (with consent)       |

PDL (People Data Layer) enrichment data, if used, is displayed read-only in the privacy portal with a provenance note ("sourced from third-party data provider") and is excluded from the copy-to-profile option.

---

## Privacy Portal ("Peaky Window")

A dedicated section on the user's Settings page. Calls the GHL API directly from the main app on behalf of the authenticated user. Entirely on-demand — no background sync involved.

### What it shows

- GHL contact fields (name, email, phone, custom fields)
- Lead source metadata (e.g., "event check-in: Panama City Meetup 2025-03")
- Current pipeline stage and tags
- DND / subscription status per channel (email, SMS)
- PDL enrichment data (read-only, with provenance note)

### User actions

| Action                              | Effect                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Unsubscribe from GHL communications | Sets DND for all channels on the GHL contact                                                 |
| Delete GHL contact                  | Deletes contact from GHL; sets `ghlOptedOut = true` on Panamia profile to prevent recreation |
| Copy field to Panamia profile       | Opt-in, per field; excludes PDL enrichment fields                                            |

### GHL ToS compliance

GHL ToS §1.4 (Data Subject Rights Management) actively requires operators to honor data subject requests (access, deletion, opt-out). The privacy portal is the fulfillment mechanism for these obligations — it is not optional for compliance.

### Resilience

The GHL API call is **non-blocking**. If GHL is unavailable:

- Show a graceful error state: "Could not load marketing data — try again later"
- The Settings page continues to function normally
- GHL is never a hard dependency for core app function

---

## Dedicated CRM Worker

A separate Cloudflare Workers project (`panamia-crm-bridge`, at `external/panamia-next-crm-bridge/`). Runs entirely in the background — no user requests touch it.

### Role

State bridge: reads Panamia DB state → writes GHL contact fields, tags, and pipeline stages. Does **not** send email or SMS — GHL's own automation engine reacts to the state changes the worker writes.

### Responsibilities

| Concern                       | Mechanism                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Outbound contact sync         | Profile field changes → GHL custom field updates                                             |
| Tag management                | Membership status, activity level → GHL tags                                                 |
| Pipeline stage transitions    | Signup → Active Member → Paying Member → Churned                                             |
| Inbound GHL webhooks          | DND changes, manual pipeline moves by sales rep → update Panamia `ghlOptedOut`               |
| Stripe relay                  | Stripe webhook → translate subscription events to GHL pipeline/tag changes                   |
| Inactive user sweep (cron)    | Query `lastLoginAt > 30d` → add `inactive-30d` tag in GHL → GHL fires re-engagement sequence |
| Contact sync catch-all (cron) | Sweep recently updated profiles → push any missed field changes                              |

### Wrangler bindings needed

- `HYPERDRIVE` — same Supabase DB as main app (new binding ID, separate from main app's binding)
- `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET` as env vars

### Cron schedule

| Trigger                 | Job                                                        |
| ----------------------- | ---------------------------------------------------------- |
| `0 * * * *` (hourly)    | `jobs/contact-sync.ts` — sweep recently updated profiles   |
| `0 3 * * *` (daily 3am) | `jobs/inactive-sweep.ts` — query `lastLoginAt > 30d` → tag |

### Split rationale

Separating the CRM worker from the main app provides:

- **Failure isolation**: GHL API errors, rate limits, or outages cannot affect user-facing requests
- **Deployment independence**: CRM logic can be updated without touching the main app
- **Clean separation**: Marketing automation logic is structurally isolated from core product code

CF Workers do support cron triggers on the main app directly — splitting is an architectural preference, not a hard technical requirement. The worker could start as cron handlers in the main app and be extracted later.

---

## GHL → Panamia (Inbound)

When GHL state changes should affect Panamia:

| GHL Event                         | Panamia Action                               |
| --------------------------------- | -------------------------------------------- |
| Contact DND set (all channels)    | Set `ghlOptedOut = true` on profile          |
| Contact deleted                   | Set `ghlOptedOut = true` on profile          |
| Manual pipeline move by sales rep | Log to Panamia (audit only, no state change) |

Inbound events arrive via GHL webhook to `POST /webhooks/ghl` on the CRM worker. The worker verifies the HMAC signature (`GHL_WEBHOOK_SECRET`) before processing.

---

## Panamia → GHL Field Mapping

| Panamia Field               | GHL Custom Field               | Notes                                           |
| --------------------------- | ------------------------------ | ----------------------------------------------- |
| `profiles.bio`              | `panamia_bio`                  | Plain text                                      |
| `profiles.panaVerified`     | `panamia_verified`             | Boolean                                         |
| `profiles.mentoring` (JSON) | `panamia_mentoring`            | Serialized JSON or tag                          |
| `users.name`                | Contact `firstName`/`lastName` | Split on first space                            |
| `users.email`               | Contact `email`                | Read-only (GHL owns pre-signup)                 |
| `subscriptions.status`      | Pipeline stage                 | active → "Paying Member"; cancelled → "Churned" |
| `subscriptions.planId`      | `panamia_plan`                 | Plan name tag                                   |
| `lastLoginAt`               | `panamia_last_login`           | ISO 8601 date                                   |

Tags written by the CRM worker follow the `panamia-*` prefix convention (e.g., `panamia-verified`, `panamia-mentor`, `inactive-30d`).

---

## GHL ToS Compliance Notes

Key findings from ToS review relevant to this integration:

- **§1.4 Data Subject Rights**: Operators must provide a mechanism for contacts to request access, deletion, and opt-out. The privacy portal fulfills this requirement.
- **Consent for contact creation**: Contacts may only be created with explicit opt-in. All lead sources listed above require affirmative consent at point of capture.
- **PDL enrichment data**: If used, must be displayed with provenance disclosure and may not be re-exported to the data subject as if it were first-party data. The privacy portal enforces this with the read-only display and exclusion from copy-to-profile.
- **`ghlOptedOut` flag**: Prevents the CRM worker from recreating a contact that the user has deleted via the privacy portal. Without this guard, deleting a GHL contact would be immediately undone by the next sync cycle.

---

## Phased Rollout

### Phase 1 — Schema additions (complete)

- Added `ghlContactId: text('ghl_contact_id')` (nullable) to `profiles` table
- Added `ghlOptedOut: boolean('ghl_opted_out')` (default `false`) to `profiles` table
- Migration: `drizzle/0006_ghl_profiles.sql`

### Phase 2 — Privacy portal API routes (complete)

- `GET /api/crm/contact` — fetch authenticated user's GHL contact record
- `POST /api/crm/contact/unsubscribe` — set DND on all channels
- `DELETE /api/crm/contact` — delete GHL contact; set `ghlOptedOut = true`, clear `ghlContactId`
- `POST /api/crm/contact/copy-field` — copy `name` or `phone` field to Panamia profile
- GHL client: `lib/ghl.ts` (reads `GHL_API_KEY` / `GHL_LOCATION_ID` from env)
- All routes degrade gracefully (503) if GHL is unconfigured or unreachable
- Settings page section: not yet built (UI is out of scope for this phase)

### Phase 3 — Signup claim (complete)

- `auth.ts` `account.create.after` hook: after profile claim, searches GHL by email
- If a matching GHL contact is found and `ghlOptedOut = false`, links `ghlContactId` on profile
- Best-effort: GHL errors are caught and logged; account creation never blocked
- CRM worker sets GHL pipeline stage to "Active Member" after claim (Phase 4)

### Phase 4 — Dedicated CRM worker (complete)

- `jobs/contact-sync.ts` — hourly sweep of recently updated profiles → push name + `panamia_verified` custom field to GHL
- `jobs/inactive-sweep.ts` — daily sweep via raw SQL against sessions table; adds `inactive-30d` tag on GHL contacts with no session activity in 30 days
- `src/lib/schema.ts` — corrected: `panaVerified` is accessed from `verification` JSONB (not a separate column); `lastLoginAt` removed (use sessions table instead)
- TODO (ops): deploy worker, configure HYPERDRIVE binding ID in `wrangler.jsonc`, set cron triggers in CF dashboard

### Phase 5 — GHL inbound webhook handler (complete)

- `handlers/webhook-ghl.ts` — HMAC-SHA256 signature verification + DB update via HYPERDRIVE
- `contact.delete` → sets `ghlOptedOut=true`, clears `ghlContactId` on profile
- `contact.dnd_update` (dnd=true) → sets `ghlOptedOut=true` on profile
- TODO (ops): register worker's `/webhooks/ghl` URL in GHL → Settings → Webhooks; note actual signature header name in GHL docs (may be `x-wm-hmac-sha256`)

### Phase 6 — Stripe relay (complete)

- `handlers/webhook-stripe.ts` — Stripe signature verification (timestamp + HMAC-SHA256) with 5-minute replay window
- `customer.subscription.created/updated` (active/trialing) → adds `panamia-subscriber` + `panamia-plan-{planId}` tags, removes `panamia-churned`
- `customer.subscription.deleted` or lapsed status → adds `panamia-churned`, removes `panamia-subscriber`
- GHL contact found via `users.email` → `profiles.ghlContactId` join; silently skips if no contact linked
- `STRIPE_WEBHOOK_SECRET` added to `.env.example` and `Env` interface
- TODO (ops): register worker's `/webhooks/stripe` URL in Stripe dashboard → Webhooks; subscribe to `customer.subscription.*` events

---

## Required Env Vars

### Main app (privacy portal)

| Var               | Type   | Location   | Required | Purpose                         |
| ----------------- | ------ | ---------- | -------- | ------------------------------- |
| `GHL_API_KEY`     | SECRET | CF-RUNTIME | No       | GHL private integration API key |
| `GHL_LOCATION_ID` | VAR    | CF-RUNTIME | No       | GHL sub-account/location ID     |

### CRM worker (`panamia-crm-bridge`) — not in main app

| Var                  | Purpose                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GHL_API_KEY`        | Same key as main app (or a separate worker-scoped key)                                                                                |
| `GHL_LOCATION_ID`    | Same location ID as main app                                                                                                          |
| `GHL_WEBHOOK_SECRET` | HMAC secret to verify inbound GHL webhook signatures                                                                                  |
| `GHL_WEBHOOK_URL`    | The worker's public URL registered in GHL as webhook endpoint                                                                         |
| `CRM_WORKER_SECRET`  | Shared HMAC secret for main app ↔ CRM worker internal calls (if privacy portal routes through worker instead of calling GHL directly) |

---

## Access Control

| Route                               | Required                                  |
| ----------------------------------- | ----------------------------------------- |
| `GET /api/crm/contact`              | Authenticated user (own data only)        |
| `POST /api/crm/contact/unsubscribe` | Authenticated user (own data only)        |
| `DELETE /api/crm/contact`           | Authenticated user (own data only)        |
| `POST /api/crm/contact/copy-field`  | Authenticated user (own data only)        |
| `POST /webhooks/ghl` (CRM worker)   | Valid `GHL_WEBHOOK_SECRET` HMAC signature |

All privacy portal routes verify that the GHL contact ID belongs to the authenticated user's profile before making any GHL API call. There is no admin-level route to read or modify another user's GHL contact via the main app — administrative GHL access goes through the GHL dashboard directly.
