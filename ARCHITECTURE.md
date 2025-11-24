# Architecture Overview

## Project Structure

### Legacy Stack (pages/)

- **UI:** Mantine v5 with Emotion
- **Forms:** Formik
- **Auth:** NextAuth v4
- **Routing:** Pages Router
- **Status:** Maintained but not enhanced

### Modern Stack (app/)

- **UI:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Forms:** React Hook Form + Zod
- **Auth:** NextAuth v5
- **Routing:** App Router
- **Status:** All new development

## Shared Infrastructure

- **Database:** MongoDB + Mongoose v6 (upgrading to v8)
  - ⚠️ **Requires MongoDB Atlas for Search:** Directory and admin search features use `$search` aggregation (Atlas Search), which is not available in local MongoDB instances
- **Auth Sessions:** NextAuth (shared between routing systems)
- **Real-time:** Pusher
- **Payments:** Stripe
- **CDN:** BunnyCDN
- **State:** TanStack Query v5

## Development Principles

- Server Components by default
- Client Components only when necessary
- FLOSS preferred for new dependencies
- Zero breakage of existing features

## Directory Structure

```
panamia.club/
├── pages/                 # Legacy Pages Router (Next.js 12)
│   ├── api/              # API routes (shared)
│   ├── account/          # User account pages
│   ├── admin/            # Admin pages
│   └── ...
│
├── app/                   # Modern App Router (Next.js 13+)
│   ├── (marketing)/      # Marketing route group
│   ├── (dashboard)/      # Dashboard route group
│   ├── (mentoring)/      # Mentoring feature route group
│   ├── api/              # Modern API routes
│   ├── layout.tsx        # Root layout
│   ├── providers.tsx     # Client providers
│   └── globals.css       # Tailwind CSS
│
├── components/
│   ├── ui/               # shadcn/ui components (new)
│   └── ...               # Legacy Mantine components
│
├── lib/
│   ├── utils.ts          # shadcn/ui utilities
│   ├── db.ts             # Database connection
│   └── ...               # Other utilities
│
├── hooks/                # Custom React hooks
│
└── types/                # TypeScript type definitions
```

## Migration Strategy

### Phase 1: Foundation (Complete)

- ✅ Code quality tooling (Prettier, ESLint, Husky)

### Phase 2: Dependencies (Complete)

- ✅ Tailwind CSS + shadcn/ui
- ✅ React Hook Form + Zod

### Phase 3: Documentation (In Progress)

- 📝 Architecture documentation
- 📝 FLOSS alternatives guide

### Phase 4: TypeScript (Pending)

- TypeScript strict mode
- Enhanced type safety

### Phase 5: Core Upgrade (Pending)

- Next.js 12 → 13.5+
- React 18.2 → 18.3+
- NextAuth v4 → v5
- Mongoose v6 → v8

### Phase 6: App Router (Pending)

- Create app/ directory structure
- Set up layouts and providers
- Implement routing patterns

### Phase 7-11: Feature Development (Pending)

- Component library setup
- Remove proprietary analytics
- Mentoring feature scaffolding
- Documentation updates

## Authentication Architecture

### Current (NextAuth v4)

- Pages Router: `/pages/api/auth/[...nextauth].ts`
- MongoDB adapter for session storage
- Email provider for passwordless auth

### Future (NextAuth v5)

- Dual compatibility during migration
- App Router: `/app/api/auth/[...nextauth]/route.ts`
- Improved TypeScript types
- Better Server Component integration

## Styling Strategy

### Legacy Pages (Mantine)

```tsx
// pages/example.tsx
import { Button } from '@mantine/core';
```

### Modern App Router (Tailwind + shadcn/ui)

```tsx
// app/example/page.tsx
import { Button } from '@/components/ui/button';
```

### Coexistence

Both systems will coexist during migration. No style conflicts expected as:

- Mantine uses Emotion (CSS-in-JS)
- Tailwind uses utility classes
- shadcn/ui components are scoped to app/ directory

## Form Handling Strategy

### Legacy (Formik)

```tsx
// Existing forms continue using Formik
import { useFormik } from 'formik';
```

### Modern (React Hook Form + Zod)

```tsx
// New forms use React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
```

## State Management

### Server State

- **TanStack Query v5** for all API data fetching
- Used in both legacy and modern code
- Automatic caching and revalidation

### Client State

- **Zustand** for complex client state (if needed)
- React Context for simple shared state
- Minimize prop drilling with proper component architecture

## API Routes

### Legacy API Routes

- Location: `/pages/api/`
- Continue to work as-is
- Shared by both Pages and App Router

### Modern API Routes

- Location: `/app/api/`
- Route handlers (Next.js 13+)
- Better TypeScript support
- Native Request/Response objects

## Database Patterns

### Mongoose Models

- Shared between Pages and App Router
- Location: `/pages/api/auth/lib/model/`
- Will be refactored to `/lib/models/` in future

### Connection Management

- Centralized in `/lib/db.ts`
- Connection pooling and caching
- Error handling and retries

## Deployment Considerations

- **Vercel** or compatible platform
- Environment variables maintained
- No changes to existing deployment workflow
- Incremental adoption of new features

## Cloud Services Currently Required

### MongoDB Atlas (Required for Search)

- **Feature:** Directory search and admin search functionality
- **Requirement:** MongoDB Atlas with Search indexes configured
- **Alternative:** Local development requires either:
  - Connecting to MongoDB Atlas instance
  - Disabling search features for local testing
  - Using basic MongoDB queries (requires code modification)
- **Impact:** Search functionality will fail on local MongoDB/mongodb-memory-server

## Performance Goals

- Maintain or improve Core Web Vitals
- Leverage Server Components for faster initial loads
- Reduce client-side JavaScript bundle
- Optimize images and assets with Next.js Image

## Security Considerations

- Keep NextAuth configuration secure
- Validate all user input with Zod schemas
- Sanitize database queries
- Protect API routes with authentication
- Use HTTPS in production
- Secure environment variables

## Testing Strategy

- Manual testing during migration phases
- Verify existing functionality after each phase
- Test authentication flows thoroughly
- Validate form submissions
- Check database operations

## Browser Support

- Modern evergreen browsers
- ES2020+ JavaScript features
- CSS Grid and Flexbox
- No IE11 support required
