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

**Status:** ✅ Keeping (already integrated, works well)

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

**Status:** ✅ Keeping (industry standard, few viable alternatives)

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

**Status:** ✅ Keeping (performant, cost-effective)

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

### Google Analytics (REMOVED ✅)

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

## FLOSS Stack (In Use) ✅

### Core Framework & Libraries

| Package        | License    | Purpose                      |
| -------------- | ---------- | ---------------------------- |
| **Next.js**    | MIT        | React framework with SSR/SSG |
| **React**      | MIT        | UI library                   |
| **TypeScript** | Apache 2.0 | Type-safe JavaScript         |
| **Node.js**    | MIT        | JavaScript runtime           |

### UI & Styling

| Package              | License | Purpose                         |
| -------------------- | ------- | ------------------------------- |
| **Tailwind CSS**     | MIT     | Utility-first CSS framework     |
| **shadcn/ui**        | MIT     | Copy/paste component library    |
| **Radix UI**         | MIT     | Unstyled accessible components  |
| **Lucide React**     | ISC     | Icon library                    |
| **Mantine** (legacy) | MIT     | Component library (legacy code) |

### Forms & Validation

| Package             | License    | Purpose                     |
| ------------------- | ---------- | --------------------------- |
| **React Hook Form** | MIT        | Performant form handling    |
| **Zod**             | MIT        | TypeScript-first validation |
| **Formik** (legacy) | Apache 2.0 | Form library (legacy code)  |

### State Management

| Package            | License | Purpose                 |
| ------------------ | ------- | ----------------------- |
| **TanStack Query** | MIT     | Server state management |
| **Zustand**        | MIT     | Client state management |

### Authentication

| Package                        | License | Purpose                    |
| ------------------------------ | ------- | -------------------------- |
| **NextAuth.js**                | ISC     | Authentication for Next.js |
| **@next-auth/mongodb-adapter** | ISC     | MongoDB session storage    |

### Database

| Package      | License | Purpose           |
| ------------ | ------- | ----------------- |
| **MongoDB**  | SSPL    | Document database |
| **Mongoose** | MIT     | MongoDB ODM       |

### Development Tools

| Package         | License | Purpose                     |
| --------------- | ------- | --------------------------- |
| **Prettier**    | MIT     | Code formatter              |
| **ESLint**      | MIT     | Code linter                 |
| **Husky**       | MIT     | Git hooks                   |
| **lint-staged** | MIT     | Run linters on staged files |

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

| Service  | Next Review | Reason                        |
| -------- | ----------- | ----------------------------- |
| Pusher   | Q2 2026     | Check Soketi maturity         |
| Stripe   | Q4 2025     | Review payment landscape      |
| BunnyCDN | Q1 2026     | Evaluate MinIO/R2 costs       |
| MongoDB  | Q3 2025     | FerretDB production readiness |

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
