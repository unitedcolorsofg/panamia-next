# Pana Modules

This document cross-references every platform module by its URL namespace, maturity level, and corresponding documentation.

---

## Module Registry

| Namespace   | Module            | Description                                                       | Maturity  | Docs                                                                            |
| ----------- | ----------------- | ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `/`         | **Home**          | Landing page — featured articles, directory CTA, FAQ              | `stable`  | —                                                                               |
| `/a`        | **Articles**      | Community content platform: create, co-author, review, publish    | `beta`    | [ARTICLES.md](./ARTICLES.md) · [ARTICLE-ROADMAP.md](./ARTICLE-ROADMAP.md)       |
| `/d`        | **Directory**     | Browse & search South Florida businesses and creatives            | `stable`  | —                                                                               |
| `/m`        | **Mentoring**     | Peer-to-peer mentoring: discover, schedule, and run sessions      | `beta`    | [MENTORING.md](./MENTORING.md) · [MENTORING-ROADMAP.md](./MENTORING-ROADMAP.md) |
| `/p`        | **Profiles**      | Public member profiles: bio, images, social links, posts          | `stable`  | —                                                                               |
| `/s`        | **Social**        | ActivityPub microblogging: timeline, posts, media, federation     | `alpha`   | [SOCIAL-ROADMAP.md](./SOCIAL-ROADMAP.md) · [SCREENNAME.md](./SCREENNAME.md)     |
| `/e`        | **Events**        | Community events — browse and RSVP                                | `planned` | —                                                                               |
| `/r`        | **Reserved**      | Reserved for future use                                           | `planned` | —                                                                               |
| `/account`  | **Account**       | Authenticated user hub: settings, profile editor, article history | `beta`    | [SIGNIN.md](./SIGNIN.md)                                                        |
| `/admin`    | **Admin**         | Staff tools: moderation, user management, analytics, metrics      | `beta`    | [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)                                        |
| `/donate`   | **Donations**     | Stripe-powered fundraising with membership tiers                  | `stable`  | —                                                                               |
| `/form`     | **Forms**         | Onboarding flows: become-a-pana, contact, affiliate, join-team    | `beta`    | —                                                                               |
| `/signin`   | **Auth**          | Passwordless sign-in: magic link, Google, Apple, Mastodon OAuth   | `stable`  | [SIGNIN.md](./SIGNIN.md)                                                        |
| `/links`    | **Link Hub**      | Centralised link page for social sharing                          | `stable`  | —                                                                               |
| `/podcasts` | **PanaVizión**    | YouTube podcast episode gallery                                   | `stable`  | —                                                                               |
| `/updates`  | **Notifications** | Voice memos, @-mentions, Pana Updates notification feed           | `beta`    | [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md)                          |

---

## Maturity Levels

| Level     | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| `stable`  | Production-ready; core flows complete and deployed            |
| `beta`    | Functional but incomplete; key sub-features still in progress |
| `alpha`   | Scaffolded or partially implemented; not production-ready     |
| `planned` | Designed and documented; implementation not yet started       |

---

## Namespace Notes

- **`/d`** — canonical directory URL; `/directory` and `/directorio` redirect here.
- **`/p`** — public profile pages at `/p/[screenname]`; individual post permalinks at `/p/[screenname]/[postId]`.
- **`/s`** — Social module; `/timeline` redirects here.
- **`/e`** — reserved for Events; not yet implemented.
- **`/r`** — reserved for future use.
- **`/admin`** — admin routes live under `/account/admin`; `/admin` is the conceptual namespace used in commit scopes and docs.

---

## Related Docs

| Doc                                              | Scope                                               |
| ------------------------------------------------ | --------------------------------------------------- |
| [QUICK-START.md](./QUICK-START.md)               | Dev setup, build commands, deployment               |
| [DATABASE-DESIGN.md](./DATABASE-DESIGN.md)       | Drizzle ORM schema, Hyperdrive, migrations          |
| [FEATURES.md](./FEATURES.md)                     | High-level feature overview (narrative format)      |
| [TESTING-ROADMAP.md](./TESTING-ROADMAP.md)       | Playwright coverage plan by module                  |
| [CONTRIBUTING.md](./CONTRIBUTING.md)             | Commit scopes, PR workflow, code standards          |
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)         | Auth flows, admin permissions, session security     |
| [FLOSS-ALTERNATIVES.md](./FLOSS-ALTERNATIVES.md) | Open-source service philosophy                      |
| [MASTODON-COMMENTS.md](./MASTODON-COMMENTS.md)   | Linking articles to Mastodon for federated comments |
