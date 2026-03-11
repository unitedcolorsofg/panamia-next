# FLOSS Alternatives Reference

This document outlines the Free/Libre Open Source Software (FLOSS) philosophy adopted for this project and documents alternatives to proprietary services.

## Philosophy

We prioritize FLOSS solutions where:

1. **Freedom**: Users and developers have freedom to use, study, modify, and distribute
2. **Transparency**: Source code is publicly available for audit
3. **Community**: Development is community-driven
4. **Privacy**: No vendor lock-in or data exploitation

## Current Proprietary Services

### Stripe (Payment Processing)

**Status:** Keeping (industry standard, few viable alternatives)

**Why we're keeping it:**

- Industry-standard payment processing
- Excellent developer experience
- PCI compliance handled
- Wide payment method support
- Few viable FLOSS alternatives exist

**FLOSS Alternatives:**

| Alternative              | License | Pros                         | Cons                        | Migration Effort |
| ------------------------ | ------- | ---------------------------- | --------------------------- | ---------------- |
| **BTCPay Server**        | MIT     | Self-hosted, privacy-focused | Bitcoin only, complex setup | Very High        |
| **Mollie** (API is open) | N/A     | European payments            | Not fully FLOSS             | High             |

**Recommendation:** Keep Stripe. Payment processing is one area where proprietary solutions dominate due to regulatory and financial requirements.

---

### Cloudflare Workers

**Status:** Keeping (current deployment platform)

**Why we're keeping it:**

- Entire app is deployed on CF Workers via Vinext
- Edge computing with global distribution
- Integrated with Hyperdrive, D1, and Durable Objects
- Excellent performance and developer experience

**Note:** Although proprietary, this is fundamentally a hosting decision. The underlying functionality — running a Node.js-compatible server that handles HTTP requests — is easily replicated using FLOSS tools. A self-hosted Node.js deployment (e.g., via the custom `server.js` used in local dev) would preserve full application portability.

**FLOSS Alternatives:**

| Alternative          | License       | Pros                            | Cons                       | Migration Effort |
| -------------------- | ------------- | ------------------------------- | -------------------------- | ---------------- |
| **Self-hosted Node** | MIT           | Full control, no vendor lock-in | Infrastructure overhead    | Medium           |
| **Deno Deploy**      | MIT (runtime) | Edge computing, similar model   | Service itself proprietary | Medium           |
| **fly.io**           | N/A           | Easy deployment, global edge    | Service is proprietary     | Low              |

**Recommendation:** Keep CF Workers. The application architecture is designed to remain portable — the FLOSS exit path is self-hosted Node.js.

---

### Cloudflare D1

**Status:** Planned (sidecar service)

**Why we're using it:**

- Purpose-built for Cloudflare Workers (co-located, no network hop for writes)
- Used exclusively for a sidecar service — not for core app data
- Global read replication via D1 Session API
- Very low cost at scale

**Note:** Like CF Workers, this is a hosting decision. D1 is SQLite under the hood, and SQLite itself is public domain. The underlying data model and queries are fully portable to any SQLite-compatible system. Core app data remains in FLOSS PostgreSQL (Supabase).

**FLOSS Alternatives:**

| Alternative            | License       | Pros                                          | Cons                          | Migration Effort  |
| ---------------------- | ------------- | --------------------------------------------- | ----------------------------- | ----------------- |
| **Turso (libSQL)**     | MIT           | SQLite-compatible, self-hostable, edge-native | Separate infrastructure       | Low               |
| **Self-hosted SQLite** | Public Domain | Zero dependencies                             | Not distributed               | Low (single node) |
| **PostgreSQL**         | PostgreSQL    | Full-featured, already in use for app data    | Different query model from D1 | Medium            |

**Recommendation:** Keep D1 for the relay. Turso (libSQL) is the FLOSS exit path if the project ever moves off Cloudflare.

---

### GoHighLevel (CRM / Marketing Automation)

**Status:** In use by the wider organizational team — integration under evaluation

**Current use:**

- CRM for member and lead management
- Email marketing automation
- Landing pages and conversion funnels

**Why we're keeping it:**

- Already in use across the organization; not a project-level decision
- Comprehensive all-in-one platform with strong automation capabilities

**FLOSS Alternatives:**

| Alternative  | License  | Pros                                            | Cons                              | Migration Effort |
| ------------ | -------- | ----------------------------------------------- | --------------------------------- | ---------------- |
| **Mautic**   | GPL-3.0  | Full-featured marketing automation, self-hosted | Requires infrastructure, older UX | High             |
| **CiviCRM**  | AGPL-3.0 | Nonprofit/community-focused CRM                 | Complex setup                     | High             |
| **Listmonk** | AGPL-3.0 | Self-hosted newsletter and email                | Email only, no CRM                | Low              |
| **Cal.com**  | AGPL-3.0 | Scheduling and booking (partial overlap)        | Limited CRM features              | N/A              |

**Recommendation:** Evaluate Mautic before committing to GoHighLevel. If GoHighLevel is adopted, document the integration scope clearly and plan an exit path.

---

### Google Analytics

**Status:** Not yet implemented — under evaluation

**Planned use:**

- Web traffic analytics
- User behavior and conversion tracking

**Why we may adopt it:**

- Industry-standard analytics
- Deep integration with Google advertising ecosystem

**Privacy concern:** GA sends extensive user data to Google's servers, which conflicts with the project's privacy values. FLOSS alternatives are strongly preferred.

**FLOSS Alternatives (preferred):**

| Alternative     | License  | Pros                     | Cons                         |
| --------------- | -------- | ------------------------ | ---------------------------- |
| **Plausible**   | AGPL-3.0 | Privacy-focused, simple  | Self-hosting or paid service |
| **Umami**       | MIT      | Lightweight, self-hosted | Less features than GA        |
| **Matomo**      | GPL-3.0  | Feature-rich, GA-like    | Heavier, more complex        |
| **GoatCounter** | EUPL-1.2 | Simple, privacy-focused  | Basic features               |

**Recommendation:** Implement Umami or Plausible before considering GA. A FLOSS analytics solution should be the default choice.

---

## FLOSS Stack (In Use)

### Core Framework & Libraries

| Package        | Version | License    | Purpose                              |
| -------------- | ------- | ---------- | ------------------------------------ |
| **Vinext**     | 0.0.13  | MIT        | Vite-based dev/build CLI for Next.js |
| **React**      | 19.2.1  | MIT        | UI library                           |
| **TypeScript** | 5.9.3   | Apache 2.0 | Type-safe JavaScript                 |
| **Node.js**    | 20+     | MIT        | JavaScript runtime                   |

### UI & Styling

| Package          | Version | License | Purpose                        |
| ---------------- | ------- | ------- | ------------------------------ |
| **Tailwind CSS** | 4.1.17  | MIT     | Utility-first CSS framework    |
| **shadcn/ui**    | latest  | MIT     | Copy/paste component library   |
| **Radix UI**     | 1.x     | MIT     | Unstyled accessible components |
| **Lucide React** | 0.559.0 | ISC     | Icon library                   |

### Forms & Validation

| Package             | Version | License | Purpose                     |
| ------------------- | ------- | ------- | --------------------------- |
| **React Hook Form** | 7.67.0  | MIT     | Performant form handling    |
| **Zod**             | 4.1.13  | MIT     | TypeScript-first validation |

### State Management

| Package            | Version | License | Purpose                 |
| ------------------ | ------- | ------- | ----------------------- |
| **TanStack Query** | 5.90.12 | MIT     | Server state management |

### Authentication

| Package         | Version | License | Purpose                             |
| --------------- | ------- | ------- | ----------------------------------- |
| **better-auth** | 1.x     | MIT     | Authentication (magic link + OAuth) |

### Database

| Package         | Version | License            | Purpose                     | Status |
| --------------- | ------- | ------------------ | --------------------------- | ------ |
| **PostgreSQL**  | 16.x    | PostgreSQL License | Relational database (FLOSS) | Active |
| **Drizzle ORM** | 0.44.x  | Apache 2.0         | PostgreSQL ORM              | Active |
| **postgres.js** | 3.x     | BSD                | PostgreSQL driver           | Active |

### Development Tools

| Package         | Version | License | Purpose                     |
| --------------- | ------- | ------- | --------------------------- |
| **Prettier**    | 3.7.4   | MIT     | Code formatter              |
| **ESLint**      | 9.39.1  | MIT     | Code linter                 |
| **Husky**       | 9.1.7   | MIT     | Git hooks                   |
| **lint-staged** | 16.2.7  | MIT     | Run linters on staged files |
| **Playwright**  | 1.57.0  | Apache  | E2E testing framework       |

---

### Search (PostgreSQL Full-Text Search)

**Status:** Using PostgreSQL full-text search

Search functionality uses PostgreSQL's built-in full-text search capabilities via Drizzle ORM.

**Current Implementation:**

- **Multi-field search**: Searches across name, tags, details, background via ILIKE
- **Filtering**: Location, category, and mentoring filters via JSONB queries
- **API endpoint**: `/api/directory` provides search and filtering

**Future Enhancements (if needed):**

| Alternative        | License    | Pros                                   | Cons                              | Migration Effort |
| ------------------ | ---------- | -------------------------------------- | --------------------------------- | ---------------- |
| **PostgreSQL FTS** | PostgreSQL | Built-in, no extra service             | Basic fuzzy matching              | N/A (current)    |
| **MeiliSearch**    | MIT        | Excellent fuzzy search, typo tolerance | Self-hosting, separate deployment | Medium           |
| **Typesense**      | GPL-3.0    | Fast, typo tolerance, good relevance   | Self-hosting required             | Medium           |

**Recommendation:** PostgreSQL full-text search is sufficient for current needs. Evaluate MeiliSearch or Typesense if advanced fuzzy matching becomes a requirement.

---

### GitHub (Git Hosting)

**Status:** Keeping (ecosystem and contributor familiarity)

**FLOSS Alternatives:**

| Alternative             | License | Pros                     | Cons                 |
| ----------------------- | ------- | ------------------------ | -------------------- |
| **Forgejo** / **Gitea** | MIT     | Self-hosted, lightweight | Smaller ecosystem    |
| **GitLab CE**           | MIT     | Full DevOps platform     | Heavy resource usage |
| **Codeberg**            | Forgejo | Non-profit hosted, EU    | Smaller community    |
| **Radicle**             | MIT     | P2P, decentralized       | Different paradigm   |

**Recommendation:** Keep GitHub. Revisit if federation (ForgeFed/ActivityPub via Forgejo) matures.

---

## Decision Framework

When evaluating new dependencies or services, use this framework:

### 1. FLOSS First

Always check for FLOSS alternatives before adopting proprietary solutions.

### 2. License Evaluation

Prefer (in order):

1. MIT / Apache 2.0 / BSD (permissive)
2. LGPL / MPL (weak copyleft)
3. GPL / AGPL (strong copyleft)

### 3. Practical Considerations

- **Community Health**: Active maintenance, responsive issues
- **Documentation**: Clear, comprehensive docs
- **Migration Cost**: How hard to switch later?
- **Performance**: Meets technical requirements
- **Security**: Regular updates, CVE response

### 4. Acceptable Exceptions

Proprietary solutions acceptable when:

- No viable FLOSS alternative exists
- Handling sensitive operations (payments, compliance)
- Migration cost is prohibitive
- Vendor lock-in is minimal (data remains portable)

---

## Future Evaluation Dates

| Service            | Next Review | Reason                           |
| ------------------ | ----------- | -------------------------------- |
| Stripe             | Q4 2026     | Review payment landscape         |
| GoHighLevel        | Q2 2026     | Decide before implementation     |
| Cloudflare Workers | Q1 2028     | Evaluate self-hosted portability |
| Cloudflare D1      | Q1 2028     | Evaluate Turso maturity          |

---

## Contributing

When proposing new dependencies:

1. Check this document for existing alternatives
2. Evaluate using the Decision Framework above
3. Document the decision in your PR
4. Update this document if adding new categories

---

## Resources

- [Free Software Foundation](https://www.fsf.org/)
- [Open Source Initiative](https://opensource.org/)
- [Choose a License](https://choosealicense.com/)
- [SPDX License List](https://spdx.org/licenses/)
- [TL;DR Legal](https://tldrlegal.com/)

---

## License Philosophy

This project aims to be as FLOSS as practically possible while maintaining:

- Developer productivity
- User experience quality
- Financial sustainability
- Security and compliance

We believe in supporting the FLOSS ecosystem through:

- Using FLOSS tools where possible
- Contributing back to projects we use
- Documenting our decisions transparently
- Evaluating alternatives regularly
