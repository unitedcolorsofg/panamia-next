# Domains

This document describes which domains serve Pana Mia, which domain federation identity is minted under, and why the string `pana.social` must never be changed with a find-and-replace.

Read this before repointing any domain constant. Two separate sessions independently concluded that the hardcoded `pana.social` on the legal pages was a stale federation value that should be "corrected" to `panamia.club`. Both were wrong, and the change would have taken the compliance-critical pages down.

## Live topology

Measured 2026-10-07 unless noted. Verify before acting on it; deployments move.

| Host                     | Status                            | What it serves                                                       |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| `pana.social`            | **200** (Cloudflare)              | **This app.** The live production deployment.                        |
| `social.pana.social`     | **200**                           | Pana Social. Bound as a Worker Custom Domain 2026-09-24.             |
| `connectors.pana.social` | **No DNS record**                 | Pana Connectors. Registered in code; needs a Custom Domain.          |
| `admin.pana.social`      | **No DNS record**                 | The admin console. Registered in code; needs a Custom Domain.        |
| `relay.pana.social`      | Resolves                          | The **separate** `panamia-nosflare` Worker, not this one.            |
| `www.panamia.club`       | **200**                           | A **different, older site** — "All Things Local In SoFlo"            |
| `panamia.club` (apex)    | **Fails** — timed out             | Nothing reachable. TLS cert expired when measured 2026-09-22; a bare timeout now. Both are consistent with the split A record — see [Known issues](#known-issues). |
| `social.panamia.club`    | **Fails** — timeout (2026-09-22)  | Parked domain. Not part of the plan; see below.                      |

The two surfaces with no record are a missing binding, not a fault: both answer on the apex today, at `pana.social/connectors` and `pana.social/admin`.

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

The repo side is done: `PANAVERSE_ROOT_DOMAIN` is `pana.social` in `wrangler.jsonc`, and `DEFAULT_ROOT_DOMAIN` matches. Hostname binding lives outside the repo — this Worker has no `routes` or `custom_domain` block, so `social.pana.social` was bound as a Custom Domain in the Cloudflare dashboard (2026-09-24) rather than from config.

**`PANAVERSE_SUBDOMAINS` is now `"1"` and Pana Social's front door is `https://social.pana.social`.** That flag gates links only, never routing: with it on, `originForFrom` returns the surface subdomain, so the surface switcher, `metadataBase` and every `canonical` point there. **`/s` keeps working on every hostname regardless** — flipping this moved the front door without moving a single route, so existing `/s` links are not broken. Set it back to `"0"` if the subdomain ever stops resolving; that setting keeps every link on the host in hand, because a link to a host with no record is a dead end rather than a slower route. `*.localhost` is exempt from the flag entirely, so `social.localhost:3002` exercises the subdomain path in dev either way.

**The front door is served at `/`, not redirected to `/s`.** `https://social.pana.social/` renders the feed under that URL; it used to answer `307 → /s`, so the surface had a subdomain but still wore a path prefix in the address bar. The choice is made in `app/page.tsx` from the `Host` header, because both surfaces share one route tree: a route group cannot express this — `app/(social)/page.tsx` still resolves to `/` and collides with the homepage — and a Worker rewrite cannot either, since vinext has no middleware-rewrite signalling and the client router would fetch RSC payloads for a path the server does not think it is on. Branching inside the route keeps URL and route identical. `/s` still serves the feed on every hostname, so nothing that links it breaks; `frontDoorPath` is what decides which of the two a masthead or account tile should name.

1. ~~Add `social.pana.social` as a custom domain on the `panamia-next` Worker.~~ **Done 2026-09-24.** Cloudflare issued the certificate on binding. The pre-existing certs were per-hostname (`pana.social`, `relay.pana.social`, `*.relay.pana.social`) with **no `*.pana.social` wildcard**, which is why the subdomain returned a connection failure rather than a TLS error while unbound — there was no certificate for it at all.
2. ~~Confirm `PANAVERSE_ROOT_DOMAIN=pana.social` in the deployed Worker vars, then set `PANAVERSE_SUBDOMAINS=1`.~~ **Done 2026-09-24**, in that order, after `https://social.pana.social/s` was confirmed to serve. Both vars are pinned in `wrangler.jsonc`, so they apply on deploy rather than needing a dashboard edit. Setting the flag before step 1 resolved would have re-pointed every cross-surface link and canonical URL at a host answering nothing — the state this flag exists to prevent — so the ordering above is the whole point of it.
3. ~~Only then set `PANAVERSE_COOKIE_DOMAIN=".pana.social"`~~ — **already done, ahead of this step.** It is pinned in `wrangler.jsonc`, so it applied on the deploy of `baf61d9` (2026-09-23), before `social.pana.social` existed. The one-time sign-out this step warns about has therefore already been spent, on a deploy made for other reasons.

   This is harmless but worth understanding, because the ordering advice above is no longer available to follow. `.pana.social` is a valid `Domain` for `pana.social` itself, so the apex holds sessions normally and nothing is broken. The _benefit_ — one session spanning both surfaces — only became observable once step 1 bound the subdomain, so it is newly testable rather than proven: sign in on one surface and confirm the other shows you signed in. Do not read a working apex login as evidence on its own.

   Still true from the original note: this also sends the session cookie to `relay.pana.social`.

   **The sign-out's blast radius is larger than it looks, because production has no OAuth providers configured.** Measured against the deployed site on 2026-09-23: `https://pana.social/signin` renders **zero** "Continue with" buttons and opens the email form directly, since `signin-view.tsx` filters to providers whose `NEXT_PUBLIC_*_ENABLED` flag is `'true'` and production sets none. So the magic link is not one way back in, it is the _only_ way back in, for every account at once. The endpoint is wired — `POST /api/auth/sign-in/magic-link` with a malformed address returns `400 VALIDATION_ERROR`, and a wrong path returns `404`, so that 400 is real application logic rather than a catch-all — but **delivery is a separate question that a 400 does not answer.** Send yourself a real magic link and confirm it arrives before treating a cookie-domain change as complete.

4. `NEXT_PUBLIC_HOST_URL` is optional here and is **build-time inlined** (CF-BUILD — see `auth.ts`), so changing it requires a rebuild, not a config edit.
5. **Leave `FEDERATION_DOMAIN=pana.social` pinned.** `lib/panaverse/boot.ts` fails at boot if it is unset on a public host, deliberately.
6. Keep `pana.social` resolving and serving WebFinger and actor JSON indefinitely, whatever happens to the web surface.

`panamia.club` is a separate concern with no dependency on any of the above. It is an older, unrelated deployment, and what becomes of it is a product decision rather than a routing one.

## Launching `connectors.pana.social` and `admin.pana.social`

Both surfaces are registered in `lib/panaverse/surfaces.ts` and both already serve on the apex — `pana.social/connectors` and `pana.social/admin` each returned 200 on 2026-10-07. What is missing is only the hostname binding, so this is a nicety rather than a repair.

**Nothing links to the unbound hosts, so there is no ordering hazard to respect.** This is the one way these two differ from social's launch, where the ordering of steps 1 and 2 was the whole point: `PANAVERSE_SUBDOMAINS` is already `"1"` and both surfaces are already in the registry, yet the account-menu tile for the console is `{ id: 'admin', href: '/admin' }` in `lib/panaverse/sites.ts` — a relative path, which stays on the host in hand. The subdomains begin serving the moment they resolve, and `/connectors` and `/admin` keep working on every hostname either way.

**Binding is dashboard work, and wrangler's OAuth token cannot do it.** Measured 2026-10-07: that token manages script secrets — `wrangler secret put` succeeds — but returns **403** on both `GET /accounts/{account}/workers/domains` and `GET /zones/{zone}/dns_records`. The account is not the problem: zone `pana.social` (`0e91bbfa…`, active) and the Worker are both in `Gschriss@gmail.com's Account`. Binding needs the dashboard, or an API token carrying Workers and DNS edit.

Workers & Pages → `panamia-next` → Settings → Domains & Routes → Add → Custom Domain:

- `connectors.pana.social`
- `admin.pana.social`

Cloudflare creates the DNS record and issues the certificate on binding. There is still **no `*.pana.social` wildcard** — certs here remain per-hostname, which is why an unbound subdomain fails at connection rather than with a TLS warning: there is no certificate for it at all, the same symptom social showed before 2026-09-24.

`GET /zones/{zone}/workers/routes` returned no pattern routes on 2026-10-07, confirming every hostname here is bound as a Custom Domain rather than by route pattern. That is why this Worker still has no `routes` block in `wrangler.jsonc`, and why adding one is a change of convention rather than a tidy-up.

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
