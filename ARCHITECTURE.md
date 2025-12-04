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
│   ├── (mentoring)/      # Mentoring feature route group ✅
│   │   ├── layout.tsx    # Protected layout with navigation
│   │   ├── discover/     # Mentor discovery & search
│   │   ├── profile/      # Mentoring profile management
│   │   ├── schedule/     # Sessions dashboard & booking
│   │   └── session/      # WebRTC video sessions
│   ├── api/              # Modern API routes
│   │   ├── pusher/       # Pusher authentication
│   │   └── mentoring/    # Mentoring API endpoints
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
│   ├── connectdb.ts      # Mongoose connection
│   ├── mongodb.ts        # MongoDB client (NextAuth)
│   ├── pusher-server.ts  # Pusher server SDK
│   ├── pusher-client.ts  # Pusher client SDK
│   ├── model/            # Mongoose schemas
│   │   ├── profile.ts    # Extended with mentoring fields
│   │   └── mentorSession.ts  # Session management
│   └── validations/      # Zod schemas
│       ├── mentoring-profile.ts
│       └── session.ts
│
├── hooks/                # Custom React hooks
│   └── use-debounce.ts   # Debounce for auto-save
│
├── docs/                 # Documentation
│   ├── MENTORING.md      # Mentoring feature guide
│   ├── TESTING_CHECKLIST.md
│   └── SECURITY_AUDIT.md
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

### Phase 6: App Router (Complete ✅)

- ✅ Create app/ directory structure
- ✅ Set up layouts and providers
- ✅ Implement routing patterns
- ✅ Migrate NextAuth to v5

### Phase 7: Feature Development (Complete ✅)

- ✅ Component library setup (shadcn/ui)
- ✅ Mentoring feature implementation
- ✅ WebRTC video sessions with Pusher
- ✅ Real-time chat and collaborative notes
- ✅ Documentation updates

### Phase 8-11: Future Development

- Remove proprietary analytics
- Additional feature enhancements
- Performance optimizations
- Accessibility improvements

## Authentication Architecture

### Current (NextAuth v5 ✅)

- App Router: `/app/api/auth/[...nextauth]/route.ts`
- Root config: `/auth.ts`
- MongoDB adapter for database sessions
- Email provider for passwordless magic links
- Custom verification token handling
- Server Component integration with `auth()` helper

**Mentoring Integration:**
- All mentoring routes protected via layout authentication
- Pusher channel auth validates session membership
- API routes verify user identity on every request

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

## Mentoring Feature Architecture

### Overview

The mentoring feature enables peer-to-peer video mentoring with real-time communication. All users can act as both mentors and mentees.

### Technology Stack

- **Frontend**: React 19, Next.js 15 App Router, shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Pusher (WebRTC signaling, chat, presence)
- **WebRTC**: Native browser APIs
- **Database**: MongoDB + Mongoose 8
- **Authentication**: NextAuth v5

### Key Features

#### 1. Profile Management
- Enable/disable mentoring profile
- Expertise tags (1-10 items)
- Language selection
- Mentoring bio (10-500 chars)
- Optional video introduction URL
- Hourly rate (0 for free mentoring)

**Implementation**: `app/(mentoring)/profile/`

#### 2. Mentor Discovery
- Search mentors by expertise, language, or price
- Filter free vs paid mentoring
- Display mentor cards with expertise badges
- Book session button with pre-filled mentor email

**Implementation**: `app/(mentoring)/discover/`

#### 3. Session Booking
- Calendar view with react-day-picker
- Time slot selection (9 AM - 5 PM, 30-min intervals)
- Duration selection (15, 30, 60, 90, 120 minutes)
- Topic input with validation
- Unique session ID generation (nanoid)

**Implementation**: `app/(mentoring)/schedule/book/`

#### 4. Sessions Dashboard
- Upcoming sessions (as mentor and mentee)
- Past sessions with status indicators
- Join session button (navigates to video room)
- Cancel session functionality
- Display session notes

**Implementation**: `app/(mentoring)/schedule/`

#### 5. WebRTC Video Sessions
- Peer-to-peer video/audio using native WebRTC APIs
- Pusher for signaling (offer/answer/ICE candidates)
- Video controls (mute, camera toggle, end call)
- Real-time text chat via presence channels
- Collaborative session notes with auto-save (1s debounce)

**Implementation**: `app/(mentoring)/session/[sessionId]/`

### Data Models

#### Profile Extension
```typescript
{
  mentoring: {
    enabled: Boolean,
    expertise: [String],
    languages: [String],
    bio: String,
    videoIntroUrl: String,
    goals: String,
    hourlyRate: Number,
  },
  availability: {
    timezone: String,
    schedule: [{
      day: enum['mon'...'sun'],
      startTime: String,
      endTime: String,
    }],
  },
  pusherChannelId: String,
}
```

#### MentorSession Model
```typescript
{
  mentorEmail: String (indexed),
  menteeEmail: String (indexed),
  scheduledAt: Date (indexed),
  duration: Number,
  topic: String,
  status: enum['scheduled', 'in_progress', 'completed', 'cancelled'],
  sessionId: String (unique, indexed),
  notes: String,
  completedAt: Date,
  cancelledAt: Date,
  cancelledBy: String,
  cancelReason: String,
}
```

### API Endpoints

#### Pusher Authentication
- **POST** `/api/pusher/auth`
- Validates session participant membership
- Authorizes private and presence channels

#### Sessions
- **GET** `/api/mentoring/sessions` - List user's sessions
- **POST** `/api/mentoring/sessions` - Create new session
- **GET** `/api/mentoring/sessions/[sessionId]` - Get session details
- **PATCH** `/api/mentoring/sessions/[sessionId]` - Update notes or cancel

#### Discovery
- **GET** `/api/mentoring/discover` - Search mentors with filters

### WebRTC Flow

1. **Mentor** joins session first
   - Requests camera/microphone permissions
   - Creates RTCPeerConnection
   - Subscribes to `private-session-{sessionId}`
   - Creates offer
   - Sends offer via Pusher

2. **Mentee** joins session
   - Requests camera/microphone permissions
   - Creates RTCPeerConnection
   - Subscribes to `private-session-{sessionId}`
   - Receives offer
   - Creates answer
   - Sends answer via Pusher

3. **ICE Candidate Exchange**
   - Both peers exchange ICE candidates via Pusher
   - STUN servers: Google public STUN (stun.l.google.com)

4. **Connection Established**
   - Peer-to-peer media streams flowing
   - Chat uses `presence-session-{sessionId}` channel
   - Notes auto-save to MongoDB

### Security Model

#### Authentication
- All routes protected via `app/(mentoring)/layout.tsx`
- NextAuth session validation on every request

#### Authorization
- Session access verified via MongoDB query
- Pusher channels require server-side authorization
- Only session participants can join video room

#### Input Validation
- Client-side: React Hook Form + Zod
- Server-side: Zod schemas on all API endpoints

#### Data Privacy
- Session IDs are unpredictable (nanoid)
- Notes visible only to participants
- Profile visibility controlled by user

### Performance Considerations

#### Database Indexes
```javascript
// MentorSession indexes
{ mentorEmail: 1, scheduledAt: -1 }
{ menteeEmail: 1, scheduledAt: -1 }
{ sessionId: 1 }

// Profile indexes
{ 'mentoring.enabled': 1 }
{ 'mentoring.expertise': 1 }
```

#### Query Limits
- Discovery: 50 mentors max
- Sessions dashboard: 20 sessions per type (upcoming/past)

#### Optimizations
- Debounced auto-save for session notes (1s)
- MongoDB `.lean()` for faster queries
- Pusher for efficient real-time updates

### Known Limitations

1. **TURN Servers**: Not configured - users behind strict firewalls may fail to connect
2. **Session Recording**: Not implemented
3. **Screen Sharing**: Not implemented
4. **Availability Schedule**: Database model exists, UI not built
5. **Profile Update API**: Frontend form needs backend endpoint

### Configuration Requirements

#### Environment Variables
```env
# Pusher (required)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# MongoDB (required)
MONGODB_URI=

# NextAuth (required)
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

#### Pusher App Settings
- Client events: **Enabled** (required for WebRTC signaling)
- Private channels: **Enabled**
- Presence channels: **Enabled**

#### Production Requirements
- **HTTPS**: Required for getUserMedia API
- **MongoDB Atlas**: Recommended for production
- **Rate Limiting**: Recommended (not implemented)

### Testing

See `docs/TESTING_CHECKLIST.md` for comprehensive test cases covering:
- Authentication/authorization
- Profile management
- Session booking
- WebRTC video sessions
- Real-time chat and notes
- Security verification

### Documentation

- **User Guide**: `docs/MENTORING.md`
- **Security Audit**: `docs/SECURITY_AUDIT.md`
- **Testing Checklist**: `docs/TESTING_CHECKLIST.md`

### Future Enhancements

1. **Availability Calendar**: UI for setting recurring availability
2. **TURN Servers**: Configure for users behind strict NAT/firewalls
3. **Session Recording**: Record and store sessions with consent
4. **Screen Sharing**: Add screen share capability
5. **Rate Limiting**: Add to API endpoints
6. **Automated Tests**: Jest unit tests, Playwright E2E tests
7. **Analytics**: Track session completion rates, user engagement
8. **Notifications**: Email/push notifications for session reminders
9. **Ratings & Reviews**: Mentor rating system
10. **Payment Integration**: Stripe for paid mentoring sessions

