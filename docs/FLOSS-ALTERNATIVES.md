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

| Package         | Version       | License | Purpose                    |
| --------------- | ------------- | ------- | -------------------------- |
| **NextAuth.js** | 5.0.0-beta.30 | ISC     | Authentication for Next.js |
| **Prisma**      | 7.2.0         | Apache  | Database adapter           |

### Database

| Package        | Version | License            | Purpose                     | Status     |
| -------------- | ------- | ------------------ | --------------------------- | ---------- |
| **PostgreSQL** | 16.x    | PostgreSQL License | Relational database (FLOSS) | ✅ Primary |
| **Prisma**     | 7.2.0   | Apache 2.0         | PostgreSQL ORM              | ✅ Active  |

### Development Tools

| Package         | Version | License | Purpose                     |
| --------------- | ------- | ------- | --------------------------- |
| **Prettier**    | 3.7.4   | MIT     | Code formatter              |
| **ESLint**      | 9.39.1  | MIT     | Code linter                 |
| **Husky**       | 9.1.7   | MIT     | Git hooks                   |
| **lint-staged** | 16.2.7  | MIT     | Run linters on staged files |
| **Playwright**  | 1.57.0  | Apache  | E2E testing framework       |

---

## MongoDB Migration Complete

**Historical Note:**
MongoDB was previously used but has been fully removed due to its SSPL license, which is not considered FLOSS by the Free Software Foundation and Open Source Initiative.

**Migration Status: ✅ Complete**

All data has been migrated to PostgreSQL. The project now uses only FLOSS-compliant database technology:

| Phase    | Data                             | Status      | Notes                        |
| -------- | -------------------------------- | ----------- | ---------------------------- |
| Phase 1  | PostgreSQL infrastructure        | ✅ Complete | Prisma + Neon                |
| Phase 2  | Auth (users, accounts, sessions) | ✅ Complete | NextAuth → Prisma adapter    |
| Phase 3  | Reference updates                | ✅ Complete | All references use PG IDs    |
| Phase 4  | Sidecars                         | ✅ Complete | Transactional features on PG |
| Phase 5  | Notifications                    | ✅ Complete | Full relational model        |
| Phase 6  | Articles                         | ✅ Complete | Content + JSONB metadata     |
| Phase 7  | Profiles                         | ✅ Complete | Flexible fields → JSONB      |
| Phase 8  | MongoDB removal                  | ✅ Complete | All MongoDB code removed     |
| Phase 9  | Auth token migrations            | ✅ Complete | Email/OAuth verification     |
| Phase 10 | Complete removal                 | ✅ Complete | No MongoDB dependencies      |

**PostgreSQL JSONB for Flexible Data:**

PostgreSQL's JSONB columns provide the document flexibility previously provided by MongoDB while maintaining full FLOSS compliance:

```sql
-- Profiles with flexible nested data
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),  -- Real FK!
  email TEXT UNIQUE,
  name TEXT,
  socials JSONB,        -- Flexible nested data
  categories JSONB,
  mentoring JSONB,
  created_at TIMESTAMPTZ
);
```

See [DATABASE-ROADMAP.md](./DATABASE-ROADMAP.md) for migration history.

---

### Search (PostgreSQL Full-Text Search)

**Status:** Using PostgreSQL full-text search

With the MongoDB migration complete, search functionality uses PostgreSQL's built-in full-text search capabilities via Prisma.

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

| Service  | Next Review | Reason                   |
| -------- | ----------- | ------------------------ |
| Pusher   | Q2 2026     | Check Soketi maturity    |
| Stripe   | Q4 2025     | Review payment landscape |
| BunnyCDN | Q1 2026     | Evaluate MinIO/R2 costs  |

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
