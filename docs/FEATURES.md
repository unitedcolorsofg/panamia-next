# Pana Mia Club Features

This document provides an overview of features available on the platform. Each feature area corresponds to a commit scope for tracking development changes.

---

## Core User System

### Authentication (`auth`)

Secure, passwordless authentication system supporting magic link emails and OAuth providers (Google, Discord, Facebook). Users can link multiple providers to a single account.

### User Accounts (`user`)

Core user management including account settings, screenname selection, and profile preferences. Screennames are unique identifiers displayed publicly on all contributions.

### Public Profiles (`profile`)

Community member profiles showcasing artists, businesses, and creatives. Profiles can include business information, social links, photos, and verification status.

---

## Discovery & Collections

### Directory (`directory`)

Browse and search community members by category, location, and keywords. Features advanced filtering for finding artists, venues, restaurants, and local businesses.

### Lists (`lists`)

User-curated collections of profiles. Create and share themed collections like "Best Coffee Shops in Wynwood" or "Jazz Venues in Miami Beach." Lists can be public or private.

Future: Align with [ActivityPub Collections](https://www.w3.org/TR/activitystreams-vocabulary/#dfn-collection) for federation. See [ARTICLE-ROADMAP.md](./ARTICLE-ROADMAP.md) Stage 15.

### Search (`search`)

Full-text search across profiles and content using MongoDB Atlas Search.

---

## Peer Mentoring

### Mentoring Platform (`mentoring`)

Connect with community members for peer-to-peer mentoring sessions. Features include:

- **Discover**: Find mentors by expertise and availability
- **Scheduling**: Book sessions with calendar integration
- **Video Sessions**: Real-time video calls with WebRTC
- **Session Notes**: Collaborative note-taking during calls

---

## Community Content

### Articles (`articles`)

Community-driven content platform for sharing stories, guides, and local knowledge. Features include:

- **Co-authorship**: Collaborate with other community members
- **Peer Review**: Quality assurance through community review
- **Rich Content**: Markdown editing with image support
- **RSS Feeds**: Subscribe to content via RSS or JSON Feed

### Comments (`comments`)

Discussion threads on articles and profiles. _(Planned - via Fediverse replies)_

See [ARTICLE-ROADMAP.md](./ARTICLE-ROADMAP.md) Stage 14 for Fediverse integration plan.

---

## Events & Calendar

### Events (`events`)

Discover local events, shows, and gatherings. Integration with Shotgun Live for venue events.

---

## Communication

### Notifications (`notifications`)

Stay updated on community activity through the notification system. Accessible via the pana flower button in the navigation.

The notification system is designed to be [ActivityPub-compatible](https://www.w3.org/TR/activitypub/) for future federation with [activities.next](https://github.com/llun/activities.next).

See [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md) for implementation details.

---

## Business Onboarding

### Intake Forms (`forms`)

Specialized registration forms for different business types:

- Restaurants & Food Service
- Artisans & Craftspeople
- Musicians & Performers
- Visual Artists
- Venues & Event Spaces
- Retail & Shopping
- Services & Professionals
- And more...

---

## Financial

### Donations (`donations`)

Support the platform through tiered donations via Stripe:

- **dePana**: Basic supporter tier
- **Confiado**: Trusted community member
- **Real**: Major supporter

---

## Administration

### Admin Dashboard (`admin`)

Platform administration for user management, content moderation, and verification.

---

## Infrastructure

These scopes are used for technical changes that don't directly correspond to user-facing features:

| Scope    | Description                            |
| -------- | -------------------------------------- |
| `api`    | API routes and middleware              |
| `db`     | Database models and migrations         |
| `ui`     | Shared UI components and design system |
| `email`  | Email templates and delivery           |
| `config` | Configuration and environment          |
| `deps`   | Dependency updates                     |
| `ci`     | CI/CD and GitHub Actions               |
| `test`   | Testing infrastructure                 |
| `docs`   | Documentation                          |
| `build`  | Build configuration                    |
| `hooks`  | Git hooks and automation               |
| `misc`   | Miscellaneous changes                  |

---

## Commit Scope Reference

When contributing, use these scopes in commit messages:

```
feat(articles): add co-author invitation system
fix(mentoring): resolve video connection timeout
docs(profile): update verification requirements
```

See `commitlint.config.cjs` for the complete scope list.
