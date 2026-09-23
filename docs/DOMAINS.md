# Domains

This document describes which domains serve Pana Mia, which domain federation identity is minted under, and why the string `pana.social` must never be changed with a find-and-replace.

Read this before repointing any domain constant. Two separate sessions independently concluded that the hardcoded `pana.social` on the legal pages was a stale federation value that should be "corrected" to `panamia.club`. Both were wrong, and the change would have taken the compliance-critical pages down.

## Live topology

Measured 2026-09-22. Verify before acting on it; deployments move.

| Host                  | Status                         | What it serves                                            |
| --------------------- | ------------------------------ | --------------------------------------------------------- |
| `pana.social`         | **200** (Cloudflare)           | **This app.** The live production deployment.             |
| `www.panamia.club`    | **200**                        | A **different, older site** — "All Things Local In SoFlo" |
| `panamia.club` (apex) | **Fails** — TLS cert expired   | Nothing reachable. See [Known issues](#known-issues).     |
| `social.pana.social`  | Not created yet                | The Pana Social surface. Needs a Worker custom domain.    |
| `social.panamia.club` | **Fails** — connection timeout | Parked domain. Not part of the plan; see below.           |

`www.panamia.club` is not this codebase. It is a Next.js **Pages Router** app; this one is App Router. The titles are similar enough to mislead, so tell them apart by markup:

```
                                www.panamia.club   pana.social
__NEXT_DATA__                          1               0
/_next/static/chunks/pages/            2               0
<script type="module">                 0               4
self.__next_f  (RSC marker)            0               0   <- does NOT discriminate
```

Counting RSC markers is the obvious test and is worthless here — this build emits none either, so "zero RSC markers" matches both sites. Use `__NEXT_DATA__`, which only the Pages Router ships.

### The surface root is `pana.social`, not `panamia.club`

`PANAVERSE_ROOT_DOMAIN` named `panamia.club` until this was corrected, so the root domain named a host this app does not serve. `originForFrom` builds every cross-surface link, `metadataBase` and `canonical` from it, and falls back to the configured root whenever the current host is not under it. Production runs on `pana.social`, which was not under `panamia.club`, so that fallback fired on every request:

```
host=pana.social -> www    : https://panamia.club         curl exit 35  (cert expired)
                 -> social : https://social.panamia.club  curl exit 28  (timeout)
```

Both cross-surface targets were dead. It was never live — the deployed build predates the panaverse work — so this was caught before shipping rather than after.

Pana Social is therefore `social.pana.social`. Making the surface root equal the identity domain also retires a standing hazard instead of arming one; see `lib/federation/domain.ts`.

## The two roles of `pana.social`

The same string does two unrelated jobs, and only one of them is a web address.

| Role                   | Examples                                                                                                        | Safe to repoint? |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Web origin**         | `og:url`, JSON-LD `url`, sitemap, RSS/JSON feeds, `policy.json` endpoints                                       | Yes, at cutover  |
| **Federated identity** | `@user@pana.social`, actor/status/follow URIs, WebFinger, NIP-05, `wss://relay.pana.social`, `hola@pana.social` | **No. Ever.**    |

Identity URIs are stored by remote servers as permanent primary keys. Once an actor has federated, changing the domain orphans it: the fediverse sees a brand-new account, and the ActivityPub `Move` activity that repairs it carries followers but **not** posts. `lib/federation/domain.ts` documents this in depth and is the authority on the identity side.

## Why find-and-replace is the specific hazard

Counting occurrences across `app/`, `lib/` and `components/`:

```
total 'pana.social'        114  in 66 files
  web origin (https://)     29  in 20 files
    env-guarded              8   <- follows NEXT_PUBLIC_HOST_URL, needs no edit
    request-guarded          1   <- falls back from the Origin header
    HARDCODED               20   in 11 files  <- the only ones needing edits
  identity / other          85
```

**85 of 114 occurrences are identity.** A global replace corrupts 85 correct values in order to fix 20. It will look obviously right in review, and federation breakage is silent and permanent — remote servers never re-resolve a URI they have already stored.

**Under the current plan, none of the 20 need editing.** They already name `pana.social`, which is both the live host and the surface root, so there is no pending migration — the inventory below is a map for a hypothetical future move, not a task list. If the web surface ever does move, migrate those 20 explicitly, by hand, and leave the other 94 alone.

## Inventory of hardcoded web origins

These have no environment variable to follow, so they must be edited directly at cutover.

| File                                        | Lines                                 | Notes                                       |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `app/legal/terms/page.tsx`                  | 6                                     | `const SITE`                                |
| `app/legal/privacy/page.tsx`                | 7                                     | `const SITE`                                |
| `app/legal/dmca/page.tsx`                   | 5                                     | `const SITE`                                |
| `app/legal/breach/page.tsx`                 | 4                                     | `const SITE`                                |
| `app/legal/accessibility/page.tsx`          | 4                                     | `const SITE`                                |
| `app/legal/page.tsx`                        | 8                                     | `const SITE`                                |
| `app/legal/terms/policy.json`               | 8, 45, 51, 57, 63, 69, 75, 81, 87, 93 | **JSON — cannot carry a warning comment**   |
| `app/legal/privacy/policy.json`             | 8                                     | **JSON — cannot carry a warning comment**   |
| `components/legal/JsonLd.tsx`               | 36                                    | structured-data publisher URL               |
| `lib/email-templates/layout.ts`             | 44                                    | email footer link                           |
| `app/api/federation/events/[slug]/route.ts` | 42                                    | **Federation — correct as-is, do not move** |

The two `policy.json` files are machine-readable policy documents and cannot hold an inline warning. `lib/email-templates/layout.ts` is likewise uncommentable at the line itself — the URL sits inside an HTML template literal, where a comment would render into the email. Those twelve occurrences are listed here precisely because the code cannot warn you in place.

Every other site in this table carries an inline comment pointing back to this document.

The env-guarded sites (`app/sitemap.ts`, `app/robots.ts`, the five feed routes, `app/.well-known/privacy-policy/route.ts`) need **no edit** — set `NEXT_PUBLIC_HOST_URL` and they follow it.

## Launching `social.pana.social`

The repo side is done: `PANAVERSE_ROOT_DOMAIN` is `pana.social` in `wrangler.jsonc`, and `DEFAULT_ROOT_DOMAIN` matches. The rest is Cloudflare dashboard work, because this Worker has no `routes` or `custom_domain` block — hostname binding lives outside the repo.

1. Add `social.pana.social` as a custom domain on the `panamia-next` Worker. Cloudflare issues the certificate. The current one is per-hostname (`pana.social`, `relay.pana.social`, `*.relay.pana.social`) with **no `*.pana.social` wildcard**, so the subdomain has no certificate until it is bound.
2. Confirm `PANAVERSE_ROOT_DOMAIN=pana.social` in the deployed Worker vars, not only in `wrangler.jsonc`.
3. ~~Only then set `PANAVERSE_COOKIE_DOMAIN=".pana.social"`~~ — **already done, ahead of this step.** It is pinned in `wrangler.jsonc`, so it applied on the deploy of `baf61d9` (2026-09-23), before `social.pana.social` existed. The one-time sign-out this step warns about has therefore already been spent, on a deploy made for other reasons.

   This is harmless but worth understanding, because the ordering advice above is no longer available to follow. `.pana.social` is a valid `Domain` for `pana.social` itself, so the apex holds sessions normally and nothing is broken. What has not happened yet is the _benefit_: a session spanning both surfaces cannot be observed until the subdomain is bound. So do not read a working www login as evidence that the shared-session behaviour works — that remains untested until step 1 is done.

   Still true from the original note: this also sends the session cookie to `relay.pana.social`.

   **The sign-out's blast radius is larger than it looks, because production has no OAuth providers configured.** Measured against the deployed site on 2026-09-23: `https://pana.social/signin` renders **zero** "Continue with" buttons and opens the email form directly, since `signin-view.tsx` filters to providers whose `NEXT_PUBLIC_*_ENABLED` flag is `'true'` and production sets none. So the magic link is not one way back in, it is the _only_ way back in, for every account at once. The endpoint is wired — `POST /api/auth/sign-in/magic-link` with a malformed address returns `400 VALIDATION_ERROR`, and a wrong path returns `404`, so that 400 is real application logic rather than a catch-all — but **delivery is a separate question that a 400 does not answer.** Send yourself a real magic link and confirm it arrives before treating a cookie-domain change as complete.

4. `NEXT_PUBLIC_HOST_URL` is optional here and is **build-time inlined** (CF-BUILD — see `auth.ts`), so changing it requires a rebuild, not a config edit.
5. **Leave `FEDERATION_DOMAIN=pana.social` pinned.** `lib/panaverse/boot.ts` fails at boot if it is unset on a public host, deliberately.
6. Keep `pana.social` resolving and serving WebFinger and actor JSON indefinitely, whatever happens to the web surface.

`panamia.club` is a separate concern with no dependency on any of the above. It is an older, unrelated deployment, and what becomes of it is a product decision rather than a routing one.

## Known issues

**`panamia.club` apex TLS certificate expired 2024-07-24** (~790 days ago as of 2026-09-22).

```
Subject  : CN=panamia.club
Issuer   : CN=R3, O=Let's Encrypt
NotAfter : 2024-07-24 13:19:24
SAN      : DNS Name=panamia.club     (apex only — which is why www is unaffected)
```

Anyone typing the bare brand domain gets a full-page browser security interstitial. Because `www` is healthy, visitors arriving from links or search never see it, which is why it has stayed invisible for over two years.

**Root cause is a split A record, not a lapsed subscription.** The apex resolves to two addresses — `76.76.21.21` (Vercel) and `192.64.119.168` (Namecheap). ACME HTTP-01 validation round-robins between them, and the Namecheap address `302`s `/.well-known/acme-challenge/` away to `www`, which does not serve the token. Roughly half of every renewal attempt therefore fails. `www` renews without trouble because its CNAME has a single target — same registrar, same ACME, and the only difference is the split record. Deleting the stale `192.64.119.168` record should let renewal self-heal; no certificate needs buying. Vercel additionally `308`s `http://panamia.club` to `https://panamia.club`, i.e. into its own dead certificate, so there is no working plaintext fallback either.
