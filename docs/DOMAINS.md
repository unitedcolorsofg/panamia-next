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
| `social.panamia.club` | **Fails** — connection timeout | Not deployed yet.                                         |

`www.panamia.club` is not this codebase. It returns zero React Server Component markers, which is the reliable way to tell the two apart — the page titles alone are similar enough to mislead.

The panaverse surface split (`panamia.club` for the directory, `social.panamia.club` for Pana Social) is therefore **a planned migration, not a configuration change**. Today neither of those hosts serves this app.

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

Migrate the 20 hardcoded sites explicitly, by hand, from the list below.

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

## Cutover checklist

1. Fix the `panamia.club` apex certificate; confirm the apex and `www` both serve.
2. Decide what happens to the existing `www.panamia.club` site — it is a separate deployment, not a route in this app.
3. Stand up `social.panamia.club`.
4. Set `NEXT_PUBLIC_HOST_URL` to the new surface root. This moves the 8 env-guarded origins on its own.
5. Edit the 20 hardcoded origins by hand, excluding the federation one.
6. **Leave `FEDERATION_DOMAIN=pana.social` pinned.** `lib/panaverse/boot.ts` fails at boot if it is unset on a public host, deliberately.
7. Keep `pana.social` resolving and serving WebFinger and actor JSON indefinitely, whatever happens to the web surface.

## Known issues

**`panamia.club` apex TLS certificate expired 2024-07-24** (~790 days ago as of 2026-09-22).

```
Subject  : CN=panamia.club
Issuer   : CN=R3, O=Let's Encrypt
NotAfter : 2024-07-24 13:19:24
SAN      : DNS Name=panamia.club     (apex only — which is why www is unaffected)
```

Anyone typing the bare brand domain gets a full-page browser security interstitial. Because `www` is healthy, visitors arriving from links or search never see it, which is why it has stayed invisible for over two years.
