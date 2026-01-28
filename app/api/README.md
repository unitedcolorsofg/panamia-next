# API Routes

Server-side API endpoints for the Pana MIA application.

## Authentication

| Endpoint                           | Method | Description                                     |
| ---------------------------------- | ------ | ----------------------------------------------- |
| `/api/auth/[...nextauth]`          | \*     | NextAuth.js handlers (signin, signout, session) |
| `/api/auth/verify-recaptcha`       | POST   | Verify reCAPTCHA tokens                         |
| `/api/register`                    | POST   | Register new user                               |
| `/api/oauth/complete-verification` | POST   | Complete OAuth email verification               |

## User Management (`/api/user/*`)

Current user operations:

| Endpoint                             | Method | Description                |
| ------------------------------------ | ------ | -------------------------- |
| `/api/user/me`                       | GET    | Get current user's data    |
| `/api/user/screenname`               | PATCH  | Update screenname          |
| `/api/user/search`                   | GET    | Search users by screenname |
| `/api/user/author`                   | GET    | Get author account status  |
| `/api/user/request-email-migration`  | POST   | Request email change       |
| `/api/user/complete-email-migration` | POST   | Confirm email change       |

### Profile Editing (via `/api/user/*` or `/api/profile/*`)

These endpoints handle profile data updates. Similar endpoints exist under
`/api/admin/*`, `/api/affiliate/*`, and `/api/geo/*` for different contexts:

| Endpoint            | Method | Description                    |
| ------------------- | ------ | ------------------------------ |
| `*/get`             | GET    | Get profile data               |
| `*/saveDesc`        | POST   | Update description             |
| `*/saveAddress`     | POST   | Update location                |
| `*/saveContact`     | POST   | Update contact info            |
| `*/saveSocial`      | POST   | Update social links            |
| `*/saveCategories`  | POST   | Update categories              |
| `*/saveGenteDePana` | POST   | Update Gente de Pana           |
| `*/upload`          | POST   | Upload profile image           |
| `*/acceptTOS`       | POST   | Accept terms of service        |
| `*/action`          | POST   | Profile actions (verify, etc.) |

## Articles (`/api/articles/*`)

Community articles feature:

| Endpoint                       | Method | Description                   |
| ------------------------------ | ------ | ----------------------------- |
| `/api/articles`                | GET    | List published articles       |
| `/api/articles`                | POST   | Create new article            |
| `/api/articles/my`             | GET    | Get user's own articles       |
| `/api/articles/recent`         | GET    | Recent published articles     |
| `/api/articles/search`         | GET    | Search articles (for replies) |
| `/api/articles/[slug]`         | GET    | Get article by slug           |
| `/api/articles/[slug]`         | PATCH  | Update article                |
| `/api/articles/[slug]`         | DELETE | Delete article                |
| `/api/articles/[slug]/publish` | POST   | Publish article               |
| `/api/articles/[slug]/replies` | GET    | Get article replies           |

### Co-author Management

| Endpoint                                 | Method | Description               |
| ---------------------------------------- | ------ | ------------------------- |
| `/api/articles/[slug]/coauthors/invite`  | POST   | Invite co-author          |
| `/api/articles/[slug]/coauthors/respond` | POST   | Accept/decline invitation |

### Review Workflow

| Endpoint                               | Method   | Description     |
| -------------------------------------- | -------- | --------------- |
| `/api/articles/[slug]/review/request`  | POST     | Request review  |
| `/api/articles/[slug]/review/respond`  | POST     | Submit review   |
| `/api/articles/[slug]/review/comments` | GET/POST | Review comments |

### Mastodon Comments

| Endpoint                        | Method | Description              |
| ------------------------------- | ------ | ------------------------ |
| `/api/articles/[slug]/comments` | GET    | Fetch Mastodon comments  |
| `/api/articles/[slug]/mastodon` | GET    | Get linked Mastodon post |
| `/api/articles/[slug]/mastodon` | PATCH  | Set Mastodon post URL    |

## Notifications (`/api/notifications/*`)

| Endpoint                           | Method | Description               |
| ---------------------------------- | ------ | ------------------------- |
| `/api/notifications`               | GET    | List user's notifications |
| `/api/notifications/unread-count`  | GET    | Get unread count          |
| `/api/notifications/mark-all-read` | POST   | Mark all as read          |
| `/api/notifications/[id]/read`     | POST   | Mark single as read       |

## Mentoring (`/api/mentoring/*`)

| Endpoint                       | Method    | Description        |
| ------------------------------ | --------- | ------------------ |
| `/api/mentoring/profile`       | GET/POST  | Mentor profile     |
| `/api/mentoring/discover`      | GET       | Find mentors       |
| `/api/mentoring/sessions`      | GET/POST  | Session management |
| `/api/mentoring/sessions/[id]` | GET/PATCH | Single session     |

## Directory & Search

| Endpoint                  | Method | Description           |
| ------------------------- | ------ | --------------------- |
| `/api/getDirectorySearch` | GET    | Search directory      |
| `/api/getUsersByCategory` | GET    | Filter by category    |
| `/api/getFeaturedPanas`   | GET    | Get featured profiles |
| `/api/getProfile`         | GET    | Get public profile    |

## Social Features

Social features (follow, timeline, etc.) are being rebuilt using the social
layer documented in `docs/SOCIAL-ROADMAP.md`. The legacy `/api/addFollower`,
`/api/list/*` endpoints have been removed.

## Admin (`/api/admin/*`)

Admin-only endpoints (require admin role):

| Endpoint                             | Method | Description            |
| ------------------------------------ | ------ | ---------------------- |
| `/api/admin/checkAdminStatus`        | GET    | Check if user is admin |
| `/api/admin/getDashboard`            | GET    | Admin dashboard data   |
| `/api/admin/allProfiles`             | GET    | List all profiles      |
| `/api/admin/importProfiles`          | POST   | Bulk import profiles   |
| `/api/admin/mentoring/dashboard`     | GET    | Mentoring admin data   |
| `/api/admin/articles/[slug]/remove`  | POST   | Remove article         |
| `/api/admin/articles/[slug]/restore` | POST   | Restore article        |

## Forms & Submissions

| Endpoint                    | Method | Description              |
| --------------------------- | ------ | ------------------------ |
| `/api/createContactUs`      | POST   | Submit contact form      |
| `/api/createSignup`         | POST   | Submit signup form       |
| `/api/createExpressProfile` | POST   | Quick profile creation   |
| `/api/getContactUsList`     | GET    | List contact submissions |
| `/api/getSignupList`        | GET    | List signup requests     |

## Payments

| Endpoint                       | Method | Description            |
| ------------------------------ | ------ | ---------------------- |
| `/api/create-checkout-session` | POST   | Create Stripe checkout |

## Realtime

| Endpoint           | Method | Description                 |
| ------------------ | ------ | --------------------------- |
| `/api/pusher/auth` | POST   | Authenticate Pusher channel |

## Image Uploads

| Endpoint             | Method | Description          |
| -------------------- | ------ | -------------------- |
| `/api/uploadImage`   | POST   | General image upload |
| `/api/editAvatar`    | POST   | Update avatar        |
| `/api/editBanner`    | POST   | Update banner        |
| `/api/getUserImages` | GET    | Get user's images    |

## Context-Specific API Groups

Several API groups provide the same operations but scoped to different contexts:

| Group              | Context                      |
| ------------------ | ---------------------------- |
| `/api/profile/*`   | User's own profile           |
| `/api/admin/*`     | Admin managing any profile   |
| `/api/affiliate/*` | Affiliate partner operations |
| `/api/geo/*`       | Geographic/location-based    |
| `/api/user/*`      | User account operations      |

## Response Format

All API endpoints return JSON with consistent structure:

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: "Error message" }
```

## Authentication

Most endpoints require authentication via NextAuth session.
Admin endpoints additionally check for admin role.
Public endpoints (search, profiles, articles) don't require auth.
