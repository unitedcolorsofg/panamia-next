# Pana Modules

This document cross-references every platform module by its URL namespace, maturity level, and corresponding documentation.

---

## Module Registry

| Namespace   | Module            | Description                                                       | Maturity | Docs                                                                                                                                                                                                      |
| ----------- | ----------------- | ----------------------------------------------------------------- | :------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`         | **Home**          | Landing page — featured articles, directory CTA, FAQ              |    3     | —                                                                                                                                                                                                         |
| `/a`        | **Articles**      | Community content platform: create, co-author, review, publish    |    2     | [ARTICLES.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/ARTICLES.md) · [ARTICLE-ROADMAP.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/ARTICLE-ROADMAP.md)       |
| `/d`        | **Directory**     | Browse & search South Florida businesses and creatives            |    3     | —                                                                                                                                                                                                         |
| `/m`        | **Mentoring**     | Peer-to-peer mentoring: discover, schedule, and run sessions      |    2     | [MENTORING.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/MENTORING.md) · [MENTORING-ROADMAP.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/MENTORING-ROADMAP.md) |
| `/p`        | **Profiles**      | Public member profiles: bio, images, social links, posts          |    3     | —                                                                                                                                                                                                         |
| `/s`        | **Social**        | ActivityPub microblogging: timeline, posts, media, federation     |    3     | [SOCIAL-ROADMAP.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/SOCIAL-ROADMAP.md) · [SCREENNAME.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/SCREENNAME.md)     |
| `/e`        | **Events**        | Community events — browse and RSVP                                |    0     | —                                                                                                                                                                                                         |
| `/r`        | **Reserved**      | Reserved for future use                                           |    0     | —                                                                                                                                                                                                         |
| `/account`  | **Account**       | Authenticated user hub: settings, profile editor, article history |    3     | [SIGNIN.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/SIGNIN.md)                                                                                                                     |
| `/admin`    | **Admin**         | Staff tools: moderation, user management, analytics, metrics      |    2     | —                                                                                                                                                                                                         |
| `/donate`   | **Donations**     | Stripe-powered fundraising with membership tiers                  |    2     | —                                                                                                                                                                                                         |
| `/form`     | **Forms**         | Onboarding flows: become-a-pana, contact, affiliate, join-team    |    2     | —                                                                                                                                                                                                         |
| `/signin`   | **Auth**          | Passwordless sign-in: magic link, Google, Apple, Mastodon OAuth   |    2     | [SIGNIN.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/SIGNIN.md)                                                                                                                     |
| `/links`    | **Link Hub**      | Centralised link page for social sharing                          |    2     | —                                                                                                                                                                                                         |
| `/podcasts` | **PanaVizión**    | YouTube podcast episode gallery                                   |    4     | —                                                                                                                                                                                                         |
| `/updates`  | **Notifications** | Voice memos, @-mentions, Pana Updates notification feed           |    3     | [NOTIFICATIONS-ROADMAP.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/NOTIFICATIONS-ROADMAP.md)                                                                                       |

---

## Maturity Levels

| Level | Meaning                                                                |
| :---: | ---------------------------------------------------------------------- |
|   0   | Placeholder — namespace reserved, nothing implemented                  |
|   1   | Concept — scaffolded or early prototype, not functional                |
|   2   | In progress — core flows work, key features incomplete                 |
|   3   | Feature-complete — needs polish, QA, or edge cases                     |
|   4   | Production-ready — stable and ready for production                     |
|   5   | User-ready — deployed, documented, and ready for user support requests |

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

| Doc                                                                                                           | Scope                                               |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [QUICK-START.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/QUICK-START.md)               | Dev setup, build commands, deployment               |
| [DATABASE-DESIGN.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/DATABASE-DESIGN.md)       | Drizzle ORM schema, Hyperdrive, migrations          |
| [FEATURES.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/FEATURES.md)                     | High-level feature overview (narrative format)      |
| [TESTING-ROADMAP.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/TESTING-ROADMAP.md)       | Playwright coverage plan by module                  |
| [CONTRIBUTING.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/CONTRIBUTING.md)             | Commit scopes, PR workflow, code standards          |
| [FLOSS-ALTERNATIVES.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/FLOSS-ALTERNATIVES.md) | Open-source service philosophy                      |
| [MASTODON-COMMENTS.md](https://github.com/unitedcolorsofg/panamia-next/blob/main/docs/MASTODON-COMMENTS.md)   | Linking articles to Mastodon for federated comments |
