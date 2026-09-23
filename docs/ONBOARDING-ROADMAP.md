# Onboarding Roadmap

What a person meets between clicking a magic link and becoming a participating
member, and what has to change for that stretch to work.

## Overview

`docs/ACCOUNTS-ROADMAP.md` owns the **data model** — which table holds what, and
when a `profiles` row comes into being. This document owns the **experience**:
the arrival moment, what a new member is asked for, in what order, and what
happens when they decline.

The platform's sign-in is good. One field, no password, four OAuth providers.
The problem is everything immediately after it: a brand-new member and a member
of three years land on the same page, see the same copy, and are given the same
nothing. One of them is missing a profile and cannot post, follow, or be
followed — and nothing on screen says so.

### Design Philosophy

1. **The door stays open.** Sign-in and sign-up are the same exchange, because
   the site is passwordless — the account is created the first time a magic link
   is used. Asking a visitor to classify themselves as new or returning before
   anything has explained the difference is a question with no answer.
2. **Gate the action, not the door.** Arrival is never blocked. What a member
   cannot do yet is explained at the point they try to do it.
3. **Nobody is left silently inert.** If something is unavailable because a step
   was skipped, say which step, and offer it in place.
4. **Ask for a thing where it pays off.** A postcode belongs to the moment
   someone searches nearby, not to a form they fill out before they have seen
   anything.
5. **Arrival is not intent.** Someone who clicked a magic link from a
   half-finished business listing was going somewhere. An interstitial may
   interrupt that journey, but it must not end it.

---

## Current State

### One door

`/signin` is the only entry point. It offers a magic link (email + Turnstile)
and whichever of Google, Apple, Wikimedia and Mastodon have credentials
configured — all four are `false` by default in `lib/env.config.ts`, so a
default deployment offers the magic link alone.

`callbackUrl` defaults to the **current surface's** `rootPath`, not the main
site's, so signing in on Pana Social returns you to Pana Social.

### What happens on a first sign-in

| Step                   | Where       | Effect                                                                                                      |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `user.create.before`   | `auth.ts`   | Rejects a sign-in with no email. Nothing else.                                                              |
| `users` row            | Better Auth | Created. `screenname` null, `accountType` `'personal'`.                                                     |
| `account.create.after` | `auth.ts`   | OAuth only — `claimProfileForUser(…, true)`                                                                 |
| `session.create.after` | `auth.ts`   | Magic link's path, since the account hook never fires for it — `claimProfileForUser(…, false)`              |
| `claimProfileForUser`  | `auth.ts`   | Attaches an **existing unclaimed** profile matching the email. Business listings excluded. Creates nothing. |
| `ensureSocialActor`    | `auth.ts`   | Builds the ActivityPub actor — but only if a profile exists.                                                |

A member whose email has no pre-existing listing therefore finishes sign-in
with a `users` row and nothing else.

### The half-state

| Record          | Present after first sign-in?                                                |
| --------------- | --------------------------------------------------------------------------- |
| `users`         | Yes                                                                         |
| `profiles`      | **No** — created only by `POST /api/user/screenname/set` or `become-a-pana` |
| `social_actors` | **No** — references `profiles`, so it cannot exist yet                      |

The consequence, per `docs/ACCOUNTS-ROADMAP.md`: the member can browse, but can
never post, follow, or be followed. Nothing communicates this.

### What exists today to catch it

| Mechanism                            | Where                       | Problem                                                                                                                                                                                      |
| ------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScreennameGate`                     | `app/layout.tsx`            | A skippable modal. Correctly mounted in the layout so it catches every door, but its skip says nothing about what skipping costs, and dismissal is remembered for the whole browser session. |
| `CallToActionBar` `complete-profile` | `components/MainHeader.tsx` | Points at `/form/become-a-pana` — the **business listing** form. It offers a person who wants to read a feed the job of registering a company.                                               |
| `IdentityMenu`                       | masthead                    | `return null` when `identities.length === 0`, so it vanishes for precisely the profile-less members who need it most.                                                                        |

---

## The Gap

1. **There is no arrival moment.** A new member and a returning one are routed
   identically, to a surface root, with identical copy.
2. **The half-state is silent.** No profile means no posting and no following,
   and the UI neither explains nor offers a remedy.
3. **The one nudge points at the wrong thing.** Sending a consumer to
   `become-a-pana` is the exact conflation `ACCOUNTS-ROADMAP.md` was written to
   undo.
4. **The account menu hides from the people who need it.** Because it returns
   null without identities, a profile-less member has no avatar menu — and since
   sign-out moved into that menu (#178), no way to sign out at all.

---

## Proposed Model

A single interstitial, `/welcome`, shown once to accounts that have not yet
claimed a screenname. It names the place, takes the one input that unlocks
everything else, and then returns the member to wherever they were going.

```
magic link / OAuth
        │
        ▼
  callbackUrl (unchanged)
        │
        ▼
  ScreennameGate ── has screenname? ──yes──▶ stay put
        │ no
        ├── legacy account ──▶ skippable modal (unchanged)
        └── new account ─────▶ /welcome?next=<where they landed>
                                   │
                                   ├── claim screenname + display name ──▶ next
                                   └── skip (cost stated) ──────────────▶ next
                                                                            │
                                                          "Finish setting up"
                                                          row persists in the
                                                          account menu
```

---

## Decisions

### 1. An interstitial, not a wizard

One page, one required input. Multi-step onboarding is how you convert a
first-time visitor into a bounce. Everything that is not load-bearing is asked
for later, in context.

### 2. Intent is preserved with `?next=`

`ScreennameGate` fires on whatever page the callback landed on, which may be a
page the member deliberately chose. `/welcome` therefore carries the origin in
`next` and returns there on completion **or** on skip.

`next` must be validated as a site-relative path — a value starting with `/` but
not `//` or `/\` — or it is an open redirect.

### 3. Display name is collected alongside the screenname

`ACCOUNTS-ROADMAP.md` lists this as a known gap:

> `users.name ?? screenname` guarantees a non-null `profiles.name`, but a
> screenname-derived display name is a poor default. The screenname prompt
> should ideally collect a display name at the same time.

A magic-link member has no name from any provider, so without this every such
profile is named after its handle. A full page has room for the second field
that the dialog did not.

### 4. The skip stays, but states its cost

Removing the skip would contradict the reasoning recorded in `ScreennameGate`
and `ACCOUNTS-ROADMAP.md`: a screenname is locked for
`SCREENNAME_COOLDOWN_DAYS` (90), so coercing a first-time visitor into one is
worse than asking again. The defect is not that skipping is possible — it is
that today's skip is silent about the consequence.

### 5. New and legacy accounts are treated differently

`/welcome` is a first-run experience and reads oddly for an account that has
existed for two years without a handle. Those members — the backfill population
described in `ACCOUNTS-ROADMAP.md` — keep the existing modal.

---

## Implementation

### Phase 1 — arrival

| #   | Area  | File                                   | Change                                                                                                                            |
| --- | ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | API   | `app/api/user/me/route.ts`             | Return `createdAt` so the client can tell a new account from a legacy one                                                         |
| 2   | Route | `app/welcome/`                         | The interstitial: names the place, claims screenname + display name, honest skip, returns to `next`                               |
| 3   | Gate  | `components/ScreennameGate.tsx`        | New accounts redirect to `/welcome?next=…`; legacy accounts keep the modal                                                        |
| 4   | Menu  | `components/account/identity-menu.tsx` | Render for any signed-in member, including those with no identities; add a "Finish setting up" row when the screenname is missing |
| 5   | CTA   | `components/MainHeader.tsx`            | Point the `complete-profile` bar at `/welcome` instead of `/form/become-a-pana`                                                   |

Change 4 also repairs the sign-out regression noted above.

### Phase 2 — the fork

Offer, after the screenname is claimed, the three things a member can actually
do: explore the directory (`/d`), join the conversation (`/s`), or list a
business (`/form/become-a-pana`, which sets `accountType`). This is the
person-versus-business split that `ACCOUNTS-ROADMAP.md` specifies; the welcome
page is where it should first be offered, as one click rather than a form.

| #   | Area  | File                                       | Change                                                                             |
| --- | ----- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | Route | `app/welcome/start/`                       | The fork: two browse doors plus a listing door, gated on a claimed screenname      |
| 2   | Flow  | `app/welcome/_components/welcome-view.tsx` | Land a completed claim on the fork, unless the member was already headed somewhere |

Three details settled during the build:

- **The fork yields to intent.** A member interrupted on the way to a specific
  page is returned there, not handed a tour — `?next=` outranks the fork, per
  Decision §2. It appears only when the destination is a front door, which is
  the case that means "nowhere in particular".
- **Skipping the screenname skips the fork.** Someone who just declined to
  answer a question has not asked for a second screen. Skip goes straight to
  the destination.
- **The listing door hides for accounts that already have one.** Offering
  `become-a-pana` to a `small_business` or `hybrid` account is noise. No new
  write path was needed: `createExpressProfile` already updates an existing
  profile rather than inserting a second one (`ACCOUNTS-ROADMAP.md` #7), which
  is what keeps the `UNIQUE` constraint on `profiles.userId` satisfied now that
  every member arrives with a profile.

### Phase 3 — contextual asks

- **`zipCode`** — exists on `users`, collected today only in account settings.
  Ask at the first locality-scoped directory search.
- **Display name and avatar** — prompt on first post if still unset.
- **Who to follow** — see Known Gaps; this one is not a wiring job.

---

## Known Gaps

- **Follow suggestions cannot seed a first run.** `/api/social/suggestions`
  ranks by `mutualCount` and returns an empty array for an actor with no
  follows, which is every new member by definition. A first-run "panas to
  follow" needs a different signal — recently-active local actors, or a curated
  list — and is a backend change, not a UI one.
- **`hasProfile` fails closed.** `components/MainHeader.tsx` catches a failed
  `/api/getProfile` with `setHasProfile(false)`, so a network blip shows an
  established member the complete-profile bar.
- **Dismissal is per browser session.** `ScreennameGate` stores its dismissal in
  `sessionStorage`, so a member who skips is asked again in every new tab
  session. The account-menu row added in Phase 1 is the calmer channel; the
  modal's frequency should be revisited once it exists.
- **No first-run copy on `/signin` itself.** The page branches only on
  `isBecomeAPana`. A visitor arriving from a "join us" link still reads copy
  addressed to a returning member.

---

## Related

- `docs/ACCOUNTS-ROADMAP.md` — the account-type model and where profiles are created
- `docs/SCREENNAME.md` — screenname rules, validation, and the 90-day cooldown
- `docs/SIGNIN.md` — provider switching and account linking
- `docs/SOCIAL-ROADMAP.md` — the ActivityPub layer that consumes these profiles
- `auth.ts` — `claimProfileForUser`, `ensureSocialActor`, and the database hooks
