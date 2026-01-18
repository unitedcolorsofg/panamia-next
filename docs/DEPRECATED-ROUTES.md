# Deprecated MongoDB Routes

This document tracks routes that were deprecated during Phase 9 of the MongoDB decommissioning. These routes use the legacy `users.ts` MongoDB model and will be rebuilt in Phase 10 using Prisma's Profile model.

## Background

The original app used a `users` MongoDB collection for directory functionality. With the migration to PostgreSQL + Prisma, user authentication is handled by the Prisma `User` model (managed by Auth.js), and public directory/profile data lives in the Prisma `Profile` model.

The routes below operated on the legacy MongoDB `users` collection. They are being deprecated rather than migrated because:

1. The data model has changed (User vs Profile separation)
2. Many operations are now handled differently (Auth.js for auth, Profile for public data)
3. Some routes are simply obsolete (password-based registration)

---

## Deprecated Routes

### Directory Query Routes

| Route                     | Method | Purpose                    | Post-MongoDB Replacement                                 |
| ------------------------- | ------ | -------------------------- | -------------------------------------------------------- |
| `/api/getAllUsers`        | GET    | Paginated user listing     | `prisma.profile.findMany()` with pagination              |
| `/api/getUser`            | GET    | Get user by email/username | `prisma.profile.findFirst()` by email or screenname      |
| `/api/getUserId`          | GET    | Get MongoDB \_id by email  | `prisma.profile.findFirst({ select: { id: true } })`     |
| `/api/getUsersByCategory` | GET    | Filter users by category   | `prisma.profile.findMany({ where: { categories } })`     |
| `/api/getFeaturedPanas`   | GET    | Get featured users         | `prisma.profile.findMany({ where: { featured: true } })` |

**Notes:**

- The Prisma `Profile` model has `categories` (array of strings) replacing `category`
- The Prisma `Profile` model has `featured` boolean
- Consider building a proper `/api/directory` endpoint with filtering, sorting, and pagination

### User Modification Routes

| Route                         | Method | Purpose                     | Post-MongoDB Replacement                        |
| ----------------------------- | ------ | --------------------------- | ----------------------------------------------- |
| `/api/register`               | POST   | Password-based registration | **Obsolete** - Use Auth.js magic link/OAuth     |
| `/api/editProfile`            | PUT    | Update profile fields       | `prisma.profile.update()`                       |
| `/api/editFeatured`           | PUT    | Toggle featured status      | `prisma.profile.update({ data: { featured } })` |
| `/api/editAvatar`             | PUT    | Update avatar URL           | Vercel Blobs for storage, update Profile        |
| `/api/editBanner`             | PUT    | Update banner URL           | Vercel Blobs for storage, update Profile        |
| `/api/editCompleteOnboarding` | PUT    | Mark onboarding complete    | **Review** - May need Profile field             |

**Notes:**

- `editAvatar` and `editBanner` should use Vercel Blobs for image storage
- `editCompleteOnboarding` may need a new `onboardingComplete` field on Profile
- All edit routes should require authentication via `auth()`

### Intake Form Routes

| Route                      | Method | Purpose                      | Post-MongoDB Replacement        |
| -------------------------- | ------ | ---------------------------- | ------------------------------- |
| `/api/getIntakeFormStatus` | GET    | Check intake form completion | `prisma.intakeForm.findFirst()` |

**Notes:**

- Uses 6 separate MongoDB intake models (art, apparel, food, goods, org, services)
- Prisma has consolidated `IntakeForm` model with `formType` enum
- Need to migrate from 6 collections → 1 table with type discrimination

### Image Routes

| Route                | Method | Purpose                 | Post-MongoDB Replacement            |
| -------------------- | ------ | ----------------------- | ----------------------------------- |
| `/api/uploadImage`   | PUT    | Upload image to MongoDB | Vercel Blobs + Profile update       |
| `/api/getUserImages` | GET    | Get user's images       | Vercel Blobs + Profile images array |

**Notes:**

- Currently stores image data in MongoDB `images` collection
- Should use Vercel Blobs for actual storage
- Profile should store blob URL references

---

## Phase 10 Recommendations

### 1. New Directory API

Create `/api/directory` with:

- GET: List profiles with filtering, sorting, pagination
- Query params: `category`, `featured`, `search`, `page`, `limit`

### 2. Profile Image Handling

- Use Vercel Blobs for image storage
- Create `/api/profile/avatar` and `/api/profile/banner` endpoints
- Store blob URLs in Profile model

### 3. Intake Forms

- Create `/api/intake` endpoint using Prisma `IntakeForm` model
- Single endpoint handles all form types via `formType` field

### 4. Onboarding

- Add `onboardingComplete` field to Profile model if needed
- Or track via existence of required profile fields

---

## Migration Status

| Route                         | Status                | Date Deprecated |
| ----------------------------- | --------------------- | --------------- |
| `/api/getAllUsers`            | Deprecated            | 2026-01-18      |
| `/api/getUser`                | Deprecated            | 2026-01-18      |
| `/api/getUserId`              | Deprecated            | 2026-01-18      |
| `/api/getUsersByCategory`     | Deprecated            | 2026-01-18      |
| `/api/getFeaturedPanas`       | Deprecated            | 2026-01-18      |
| `/api/register`               | Deprecated (obsolete) | 2026-01-18      |
| `/api/editProfile`            | Deprecated            | 2026-01-18      |
| `/api/editFeatured`           | Deprecated            | 2026-01-18      |
| `/api/editAvatar`             | Deprecated            | 2026-01-18      |
| `/api/editBanner`             | Deprecated            | 2026-01-18      |
| `/api/editCompleteOnboarding` | Deprecated            | 2026-01-18      |
| `/api/getIntakeFormStatus`    | Deprecated            | 2026-01-18      |
| `/api/uploadImage`            | Deprecated            | 2026-01-18      |
| `/api/getUserImages`          | Deprecated            | 2026-01-18      |
