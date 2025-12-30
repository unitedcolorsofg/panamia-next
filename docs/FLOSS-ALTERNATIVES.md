# FLOSS Alternatives Reference

This document outlines the Free/Libre Open Source Software (FLOSS) philosophy adopted for this project and documents alternatives to proprietary services.

## Philosophy

We prioritize FLOSS solutions where:

1. **Freedom**: Users and developers have freedom to use, study, modify, and distribute
2. **Transparency**: Source code is publicly available for audit
3. **Community**: Development is community-driven
4. **Privacy**: No vendor lock-in or data exploitation

## Current Proprietary Services

### Pusher (Real-time Communication)

**Status:** Keeping (already integrated, works well)

**Why we're keeping it:**

- Already integrated and working well
- Reliable WebRTC signaling for peer mentoring
- Reasonable pricing for our scale
- Migration would require significant effort

**FLOSS Alternatives for Future Consideration:**

| Alternative              | License          | Pros                                | Cons                       | Migration Effort |
| ------------------------ | ---------------- | ----------------------------------- | -------------------------- | ---------------- |
| **Socket.io**            | MIT              | Widely adopted, good docs           | Self-hosted complexity     | High             |
| **Supabase Realtime**    | Apache 2.0       | Managed service, generous free tier | Tied to Supabase ecosystem | High             |
| **Soketi**               | MIT              | Pusher-compatible, self-hosted      | Self-hosting required      | Medium           |
| **Ably** (has FLOSS SDK) | Apache 2.0 (SDK) | Good performance                    | Service is proprietary     | High             |

**Recommendation:** Keep Pusher for now. Evaluate Soketi if self-hosting becomes viable.

---

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

### BunnyCDN (File Storage/CDN)

**Status:** Keeping (performant, cost-effective)

**Why we're keeping it:**

- Excellent performance and pricing
- Simple API
- Global CDN coverage
- Low vendor lock-in (S3-compatible API)

**FLOSS Alternatives:**

| Alternative          | License    | Pros                            | Cons                    | Migration Effort |
| -------------------- | ---------- | ------------------------------- | ----------------------- | ---------------- |
| **MinIO**            | AGPL-3.0   | S3-compatible, self-hosted      | Requires infrastructure | Medium           |
| **Cloudflare R2**    | N/A        | Zero egress fees, S3-compatible | Service is proprietary  | Low              |
| **Backblaze B2**     | N/A        | Affordable, S3-compatible       | Limited CDN             | Low              |
| **Supabase Storage** | Apache 2.0 | Integrated with Supabase        | Limited CDN features    | Medium           |

**Recommendation:** Keep BunnyCDN. If migration needed, MinIO (self-hosted) or Cloudflare R2 (managed) are good options.

---

### Google Analytics (REMOVED )

**Status:** 🚫 Removed in Phase 9

**Why we removed it:**

- Privacy concerns
- Proprietary tracking
- Not essential for current operations

**FLOSS Alternatives (if analytics needed in future):**

| Alternative     | License  | Pros                     | Cons                         |
| --------------- | -------- | ------------------------ | ---------------------------- |
| **Plausible**   | AGPL-3.0 | Privacy-focused, simple  | Self-hosting or paid service |
| **Umami**       | MIT      | Lightweight, self-hosted | Less features than GA        |
| **Matomo**      | GPL-3.0  | Feature-rich, GA-like    | Heavier, more complex        |
| **GoatCounter** | EUPL-1.2 | Simple, privacy-focused  | Basic features               |

**Recommendation:** Umami for simplicity or Plausible for better UX.

---

## FLOSS Stack (In Use)

### Core Framework & Libraries

| Package        | Version | License    | Purpose                      |
| -------------- | ------- | ---------- | ---------------------------- |
| **Next.js**    | 16.0.8  | MIT        | React framework with SSR/SSG |
| **React**      | 19.2.1  | MIT        | UI library                   |
| **TypeScript** | 5.9.3   | Apache 2.0 | Type-safe JavaScript         |
| **Node.js**    | 20+     | MIT        | JavaScript runtime           |

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

| Package                   | Version       | License | Purpose                    |
| ------------------------- | ------------- | ------- | -------------------------- |
| **NextAuth.js**           | 5.0.0-beta.30 | ISC     | Authentication for Next.js |
| **@auth/mongodb-adapter** | 3.11.1        | ISC     | MongoDB session storage    |

### Database

| Package      | Version | License | Purpose           |
| ------------ | ------- | ------- | ----------------- |
| **MongoDB**  | 7.x     | SSPL    | Document database |
| **Mongoose** | 9.0.1   | MIT     | MongoDB ODM       |

### Development Tools

| Package         | Version | License | Purpose                     |
| --------------- | ------- | ------- | --------------------------- |
| **Prettier**    | 3.7.4   | MIT     | Code formatter              |
| **ESLint**      | 9.39.1  | MIT     | Code linter                 |
| **Husky**       | 9.1.7   | MIT     | Git hooks                   |
| **lint-staged** | 16.2.7  | MIT     | Run linters on staged files |
| **Playwright**  | 1.57.0  | Apache  | E2E testing framework       |

---

## MongoDB Server Side Public License (SSPL)

**Note on MongoDB License:**
MongoDB uses the SSPL license, which is **not considered FLOSS** by the Free Software Foundation and Open Source Initiative due to restrictions on providing MongoDB as a service.

**FLOSS Database Alternatives:**

| Alternative    | License            | Pros                                | Cons                        | Migration Effort |
| -------------- | ------------------ | ----------------------------------- | --------------------------- | ---------------- |
| **PostgreSQL** | PostgreSQL License | Truly FLOSS, robust, JSON support   | Different query paradigm    | Very High        |
| **CouchDB**    | Apache 2.0         | Document DB, true FLOSS             | Less popular, different API | Very High        |
| **FerretDB**   | Apache 2.0         | MongoDB-compatible, Postgres-backed | Newer, less mature          | Medium           |

**Current Stance:**
We're keeping MongoDB despite SSPL concerns because:

1. We're not providing MongoDB as a service
2. Mature ecosystem and tooling
3. Migration effort is very high
4. FerretDB shows promise as future alternative

**Recommendation:** Monitor FerretDB maturity. Consider migration if it reaches production-ready status.

---

### MongoDB Atlas Search (Search Engine)

**Status:** Keeping (core feature, free, cost-effective)

**Why we're keeping it:**

Panamia.club is a **local business directory** where search quality directly impacts the core value proposition. Atlas Search provides capabilities essential for directory discovery:

- **Fuzzy matching**: Users can make typos ("photografer" → "photographer")
- **Relevance scoring**: Custom weighted fields (names ranked 5x higher than bio text)
- **Multi-field search**: Single query searches across name, tags, details, background
- **Complex filtering**: Combines text search with location, category, and mentoring filters
- **Already implemented**: Full search infrastructure exists in `lib/server/directory.ts`

**Cost Analysis:**

| Solution                    | Monthly Cost | Features                          | Migration Effort |
| --------------------------- | ------------ | --------------------------------- | ---------------- |
| **Atlas Search (current)**  | $0           | Fuzzy, scoring, all features      | N/A              |
| Basic MongoDB text indexes  | $0           | ❌ No fuzzy, ❌ No custom scoring | Medium           |
| Algolia                     | $50-100      | Similar features                  | High             |
| Elasticsearch (self-hosted) | $20-50       | Similar features                  | Very High        |
| Typesense (self-hosted)     | $10-30       | Similar features                  | Very High        |
| MeiliSearch                 | $0           | Self-hosted, good features        | Very High        |

**FLOSS Alternatives:**

| Alternative        | License    | Pros                                   | Cons                              | Migration Effort |
| ------------------ | ---------- | -------------------------------------- | --------------------------------- | ---------------- |
| **MeiliSearch**    | MIT        | Excellent fuzzy search, typo tolerance | Self-hosting, separate deployment | Very High        |
| **Typesense**      | GPL-3.0    | Fast, typo tolerance, good relevance   | Self-hosting required             | Very High        |
| **Elasticsearch**  | SSPL/Agpl  | Feature-rich, industry standard        | Complex, resource-heavy           | Very High        |
| **MongoDB $text**  | SSPL       | Built-in, no extra service             | No fuzzy, poor relevance          | Medium           |
| **PostgreSQL FTS** | PostgreSQL | Mature full-text search                | Requires DB migration             | Very High        |

**Trade-offs:**

Removing Atlas Search would require either:

1. **Degraded UX**: Basic `$text` search loses fuzzy matching and relevance scoring
2. **Added complexity**: Self-host MeiliSearch/Typesense/Elasticsearch (20-40 hours + infrastructure)
3. **Added cost**: Use Algolia ($50-100/month)

**Current Stance:**

We're keeping Atlas Search because:

1. **Free**: Included in MongoDB Atlas M0 free tier
2. **Core feature**: Search quality is essential for directory discovery
3. **Already implemented**: Complexity already absorbed
4. **Cost-effective**: Alternatives cost $50-100/month or 20-40 hours dev time
5. **Low lock-in**: Data is standard MongoDB, only search queries need rewriting

The tradeoff is "developers need Atlas for local dev" - a one-time 10-minute setup vs. ongoing product quality degradation or significant migration costs.

**Recommendation:** Keep Atlas Search. If migrating away from MongoDB entirely (to PostgreSQL/FerretDB), consider MeiliSearch or Typesense as FLOSS search alternatives.

---

### GitHub (Git Hosting)

**Status:** Keeping (ecosystem, contributor familiarity)

**Why we're keeping it:**

- Industry standard, most contributors are familiar with it
- Excellent CI/CD with GitHub Actions
- Free for open source projects
- Strong community and discoverability

**FLOSS Alternatives (Self-Hosted):**

| Alternative                            | License  | Pros                                           | Cons                      |
| -------------------------------------- | -------- | ---------------------------------------------- | ------------------------- |
| **[Gitea](https://gitea.io/)**         | MIT      | Lightweight, easy deploy, Go-based             | Smaller community         |
| **[Forgejo](https://forgejo.org/)**    | MIT      | Gitea fork, ActivityPub federation in progress | Newer, smaller ecosystem  |
| **[GitLab CE](https://gitlab.com/)**   | MIT      | Full DevOps platform                           | Heavy resource usage      |
| **[Gogs](https://gogs.io/)**           | MIT      | Minimal, single binary                         | Less features than Gitea  |
| **[Sourcehut](https://sr.ht/)**        | AGPL-3.0 | Email-driven workflow, minimal                 | Different paradigm        |
| **[cgit](https://git.zx2c4.com/cgit)** | GPL-2.0  | Ultra-minimal web interface                    | No collaboration features |

**FLOSS Alternatives (Hosted Services):**

| Service                                              | Based On  | Pros                             | Cons              |
| ---------------------------------------------------- | --------- | -------------------------------- | ----------------- |
| **[Codeberg](https://codeberg.org/)**                | Forgejo   | Non-profit, EU-hosted            | Smaller community |
| **[GitLab.com](https://gitlab.com/)**                | GitLab    | Free tier, CI/CD included        | Heavy UI          |
| **[Sourcehut](https://sr.ht/)**                      | Sourcehut | Email workflow, paid after alpha | Learning curve    |
| **[Disroot](https://disroot.org/en/services/gitea)** | Gitea     | Community-run collective         | Limited resources |

**Federated / Decentralized:**

| Project                             | Protocol             | Notes                            |
| ----------------------------------- | -------------------- | -------------------------------- |
| **[Forgejo](https://forgejo.org/)** | ForgeFed/ActivityPub | Federation in active development |
| **[Radicle](https://radicle.xyz/)** | P2P                  | Peer-to-peer code collaboration  |

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
4. SSPL / BSL (source-available but restricted)

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
- Vendor lock-in is minimal

---

## Future Evaluation Dates

| Service      | Next Review | Reason                        |
| ------------ | ----------- | ----------------------------- |
| Pusher       | Q2 2026     | Check Soketi maturity         |
| Stripe       | Q4 2025     | Review payment landscape      |
| BunnyCDN     | Q1 2026     | Evaluate MinIO/R2 costs       |
| MongoDB      | Q3 2025     | FerretDB production readiness |
| Atlas Search | Q3 2025     | Review with MongoDB decision  |

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
