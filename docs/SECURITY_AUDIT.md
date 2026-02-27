# Security Audit

## OAuth Authentication Architecture

### Overview

The application uses better-auth for authentication with multiple OAuth providers and email magic links. Admin permissions are managed via environment variables, while user-level permissions and verification badges are stored in the PostgreSQL profile table.

### OAuth Providers

The application uses a tristate security model for OAuth providers based on email verification:

#### Configuration

OAuth provider security is configured via environment variables:

```env
# Values: trusted | verification-required | disabled
OAUTH_GOOGLE=trusted
OAUTH_APPLE=trusted
OAUTH_WIKIMEDIA=verification-required
OAUTH_MASTODON_SOCIAL=trusted
```

**Configuration Values:**

- `trusted` - Provider verifies email ownership (auto-claim enabled immediately)
- `verification-required` - Email verification required before sign-in (auto-claim after verification)
- `disabled` - Provider button greyed out on sign-in page

**Notes:**

- `OAUTH_EMAIL` is hardcoded to `trusted` (we send the magic link, confirming ownership)
- `OAUTH_MASTODON_SOCIAL` is an explicit reference to the mastodon.social instance, not a generic domain-matching pattern

#### Trusted Providers (Immediate Auto-Claim)

These providers verify email ownership before providing email addresses:

- **Google** - Email verified by Google
  - Scopes: `openid email profile https://www.googleapis.com/auth/calendar.events`
  - Calendar scope allows creating/editing mentoring session events
- **Apple** - Email verified by Apple
  - Scopes: `name email`
  - Note: Calendar API not available via OAuth
- **Email (Magic Link)** - Email verified by our system
  - We send the link to the email address, confirming ownership
- **mastodon.social** - Official Mastodon instance with verified email practices

**Behavior:**

1. User signs in with OAuth
2. Profile automatically claimed if email matches
3. No additional verification required

#### Verification-Required Providers (Email Verification Before Sign-In)

These providers may not reliably verify email ownership:

- **Wikimedia** - Emails are optional and may not be verified
  - Users can make emails private
  - Cannot rely on email verification
- **Self-hosted Mastodon** - Cannot verify instance email policies

**Behavior:**

1. User initiates OAuth sign-in
2. OAuth succeeds but sign-in is **blocked**
3. Verification email sent to OAuth-provided email address (5-minute expiration)
4. User clicks verification link
5. Email ownership confirmed
6. better-auth account created
7. Profile automatically claimed if email matches
8. User can now sign in normally via OAuth

**Security Rationale:**

- Prevents profile hijacking via unverified OAuth emails
- Ensures email ownership before granting access
- Allows auto-claiming for all providers after verification
- Consistent security model across all providers

#### Disabled Providers

Providers set to `disabled` will show greyed-out buttons on the sign-in page and reject authentication attempts.

### Email Migration Security

Users can change their account email address through a verified migration process:

**Migration Flow:**

1. User requests email change from account settings
2. Verification email sent to new email address (5-minute expiration)
3. User clicks magic link in new email
4. Database transaction executes:
   - Update `users.email`
   - Update `profiles.email`
   - Delete all `sessions` (sign out all devices)
   - Delete migration record
5. Confirmation email sent to old address

**Security Features:**

- Magic link verification (5-minute expiration)
- Atomic database transaction (all-or-nothing)
- Session invalidation prevents hijacking
- Cannot migrate to email already in use
- Maximum 1 pending migration per user
- Audit trail via confirmation email

**Attack Prevention:**

- Attacker cannot claim profile via untrusted OAuth then migrate to their own email without detection
  - Attacker verifies alice@example.com via Wikimedia
  - Attacker claims Alice's profile (after email verification)
  - Attacker migrates email to attacker@evil.com (after verifying new email)
  - BUT: Alice receives confirmation email about change at alice@example.com
  - Alice can contact support to recover account

**Implementation:** `/lib/model/emailMigration.ts`, `/app/api/user/request-email-migration/route.ts`, `/app/api/user/complete-email-migration/route.ts`

### Admin Permission Model

**Environment Variable Based:**

```env
ADMIN_EMAILS=admin@example.com
```

**Implementation:**

- Admin status checked on every request via session
- Comma-separated list of admin email addresses
- Case-insensitive matching
- No database dependency for admin checks

**Security Benefits:**

- Immutable without server access (defense in depth)
- Simple to configure and audit
- No risk of database compromise affecting admin status
- Clear separation from profile data

**Admin Privileges:**

- Full system access via `session.user.isAdmin`
- Can grant verification badges
- Can assign user roles

### Profile Verification Badges

User verification status stored in profile collection:

```typescript
verification: {
  panaVerified: Boolean,        // Social verification (not identity)
  legalAgeVerified: Boolean,    // Legal age verification
  verifiedOn: Date,             // Date of verification
  verifiedBy: String            // Admin who verified
}
```

**Badge Types:**

- **Pana Verified**: Social verification badge (not legal identity verification)
- **Legal Age Verified**: Verified to be of legal age (18+)

**Granting Process:**

- Only admins can grant verification badges
- Audit trail via `verifiedOn` and `verifiedBy` fields
- Persistent in database

### User Roles

Scoped roles for context-specific permissions:

```typescript
roles: {
  mentoringModerator: Boolean,  // Moderator for mentoring section
  eventOrganizer: Boolean,      // Can organize events
  contentModerator: Boolean     // Can moderate content
}
```

**Role Assignment:**

- Granted by admins via profile updates
- Scoped to specific features (e.g., mentoring moderator ≠ global admin)
- Stored in profile collection

### Session Enrichment

The session object is enriched with permissions for fast access:

```typescript
session.user = {
  id: string,
  email: string,
  emailVerified: Date,

  // Admin role (from env var)
  isAdmin: boolean,

  // Verification badges (from profile)
  panaVerified: boolean,
  legalAgeVerified: boolean,

  // Scoped roles (from profile)
  isMentoringModerator: boolean,
  isEventOrganizer: boolean,
  isContentModerator: boolean,
};
```

**Performance:**

- Single database query per session fetch
- Cached in session (no query on each request)
- Updated on next session refresh

### Security Considerations

**Email Spoofing Prevention:**

- Only trusted OAuth providers allowed for auto-claim
- Mastodon instances individually whitelisted
- Wikimedia excluded due to optional emails

**Admin Account Protection:**

- Admin status from environment variable (immutable)
- No special auto-claim blocking needed (admin status independent of profile)
- Focus on MFA at email provider level

**Profile Data Security:**

- Verification badges require admin action
- Roles scoped to specific features
- Audit trail for all verifications

**Future Enhancements:**

- Audit logging for admin actions
- MFA enforcement for admin accounts
- Time-limited roles (temporary moderators)
- Fine-grained permissions system

---

## Mentoring Feature Security Audit

### Security Architecture Overview

The mentoring platform implements multiple layers of security to protect user data and prevent unauthorized access.

## Authentication Layer

### better-auth Implementation

- **Session Management**: Database sessions stored in PostgreSQL
- **Email Provider**: Passwordless authentication with magic links
- **Session Validation**: Server-side session checks on every protected route
- **Token Security**: better-auth handles token encryption and validation

### Protected Routes

All mentoring routes are protected via layout authentication:

```typescript
// app/m/layout.tsx
const session = await auth();
if (!session?.user) {
  redirect('/api/auth/signin');
}
```

**Status**: Implemented and secure

## Authorization Layer

### Session Access Control

Sessions are restricted to authorized participants only:

**Database Query Pattern**:

```typescript
await db.query.mentorSessions.findFirst({
  where: and(
    eq(mentorSessions.sessionId, params.sessionId),
    or(
      eq(mentorSessions.mentorEmail, session.user.email),
      eq(mentorSessions.menteeEmail, session.user.email)
    )
  ),
});
```

**API Endpoints**: All session endpoints verify participant membership
**Video Sessions**: Page-level checks before rendering VideoRoom component

**Status**: Implemented correctly

### Pusher Channel Authorization

**Channel Naming Convention**:

- Private channels: `private-session-{sessionId}`
- Presence channels: `presence-session-{sessionId}`

**Authorization Flow**:

1. Client requests channel subscription
2. Pusher sends auth request to `/api/pusher/auth`
3. Server validates:
   - User is authenticated (better-auth session)
   - User is participant in session (database query)
4. Server authorizes channel or denies access

**Code Location**: `app/api/pusher/auth/route.ts`

**Status**: Properly secured with database validation

## Input Validation

### Zod Schema Validation

All user inputs validated before processing:

**Profile Data**:

- Expertise: 1-10 items, strings only
- Languages: 1+ items, strings only
- Bio: 10-500 characters
- Video URL: Valid URL format or empty
- Hourly rate: Non-negative number

**Session Data**:

- Email: Valid email format
- DateTime: ISO 8601 format
- Duration: 15-120 minutes
- Topic: 5-200 characters

**Implementation**: Client-side (React Hook Form) and server-side (API routes)

**Status**: Comprehensive validation

## Data Security

### Sensitive Data Handling

**What's Protected**:

- User emails (only visible to session participants)
- Session notes (private to participants)
- Profile information (visibility controlled)

**What's Exposed**:

- Session IDs (unpredictable nanoid, 16 characters)
- Mentor public profiles (intentional for discovery)

**Pusher Payloads**:

- Minimized personal identifiers
- Only email (required for identification)
- No passwords or sensitive credentials

**Status**: Appropriate data exposure

### Database Query Security

**Parameterized Queries**: All queries use Drizzle ORM
**Injection Prevention**: Drizzle + postgres.js handle parameterization
**Field Selection**: `select` used to limit exposed fields

Example:

```typescript
await db.query.profiles.findMany({
  where: query,
  columns: {
    name: true,
    email: true,
    mentoring: true,
    availability: true,
    slug: true,
    primaryImageCdn: true,
  },
  take: 50,
});
```

**Status**: Protected against SQL injection

## Transport Security

### HTTPS Requirements

**Development**: HTTP acceptable (localhost)
**Production**: HTTPS required for:

- getUserMedia API (camera/microphone access)
- Secure WebSocket connections (Pusher)
- Cookie security (better-auth sessions)

**Configuration**: Next.js automatically handles secure headers in production

**Status**: [!] Requires HTTPS in production (standard practice)

### WebRTC Security (Prototype Feature)

> **Note**: The WebRTC peer-to-peer video feature is currently in **prototype stage** and not production-ready.

**Signaling**: Encrypted via Pusher (TLS/WSS)
**Media Streams**: Peer-to-peer, encrypted (DTLS-SRTP)
**STUN Servers**: Google public STUN (no credentials exposed)
**TURN Servers**: Not configured (future enhancement)

**Limitations**:

- No TURN servers means connectivity issues in restrictive networks
- May not work behind symmetric NATs or strict firewalls
- Suitable for testing and development only

**Status**: [!] Prototype - Standard WebRTC security model, but connectivity not guaranteed

## API Security

### Endpoint Protection

All mentoring API routes protected:

```typescript
const session = await auth();
if (!session?.user?.email) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Rate Limiting**: Not implemented (recommended for production)

**Status**: Authentication enforced, [!] rate limiting recommended

### CORS Configuration

**Default**: Next.js restricts cross-origin requests
**Pusher**: Configured with specific auth endpoint

**Status**: Secure defaults

## Client-Side Security

### XSS Prevention

**React**: Auto-escapes rendered content
**User Input**: Never dangerouslySetInnerHTML used
**URLs**: Validated before rendering (Zod schemas)

**Status**: Protected

### CSRF Protection

**better-auth**: Built-in CSRF protection
**API Routes**: Uses HTTP-only cookies

**Status**: Protected

## Database Security

### Connection Security

**PostgreSQL URL**: Stored in environment variables
**Connection String**: Not committed to git (.env.local gitignored)
**Authentication**: Username/password via connection string
**SSL**: Required for production (Neon enforces TLS)

**Status**: Credentials secured

### Data Validation

**Drizzle Schema**: Enforces data types and relations
**Required Fields**: Validated at schema level
**Foreign Keys**: Enforce referential integrity
**Indexes**: Optimize queries and enforce uniqueness

**Status**: Schema validation enforced

## Environment Variables

### Required Secrets

```env
# better-auth
BETTER_AUTH_SECRET=     # 32+ character random string
BETTER_AUTH_URL=        # Application URL

# PostgreSQL
POSTGRES_URL=           # Connection string with credentials

# Pusher
PUSHER_APP_ID=          # App ID
PUSHER_KEY=             # Public key (safe in client)
PUSHER_SECRET=          # Secret key (server-only)
PUSHER_CLUSTER=         # Cluster (safe in client)
```

**Status**: Secrets in .env.local (gitignored)

## Known Security Considerations

### 1. Rate Limiting (Recommended)

**Risk**: Users can spam API endpoints
**Mitigation**: Implement rate limiting middleware
**Priority**: Medium
**Effort**: Low (use next-rate-limit package)

### 2. TURN Server Configuration (Optional)

**Risk**: Users behind strict firewalls cannot connect
**Mitigation**: Configure TURN servers with credentials
**Priority**: Low (only affects small percentage)
**Effort**: Medium (requires infrastructure)

### 3. Session Recording (Privacy)

**Current**: Sessions not recorded
**Consideration**: If recording added, need:

- User consent
- Secure storage
- Retention policy
- GDPR compliance

### 4. Profile Update API (TODO)

**Current**: Frontend form has placeholder API call
**Required**: Implement PATCH /api/mentoring/profile
**Security**: Must validate user owns profile

### 5. Availability Schedule (Incomplete)

**Current**: Database model exists, UI not built
**Security**: No concerns (public information)

## Recommendations

### Immediate Actions

1. All authentication/authorization implemented
2. Input validation comprehensive
3. Pusher channels secured
4. [!] Add rate limiting to production

### Before Production Deployment

1. Enable HTTPS (required)
2. Set secure NEXTAUTH_SECRET (32+ chars)
3. Configure Pusher production app
4. Add rate limiting middleware
5. Set up PostgreSQL with secure connection
6. Configure monitoring/logging

### Future Enhancements

1. Add automated security tests
2. Implement session timeout warnings
3. Add two-factor authentication option
4. Configure TURN servers for NAT traversal
5. Add audit logging for sensitive actions

## Security Checklist for Production

- [ ] HTTPS enabled and enforced
- [ ] All environment variables set correctly
- [ ] Pusher app configured with client events
- [ ] PostgreSQL with authentication
- [ ] BETTER_AUTH_SECRET is strong (32+ characters)
- [ ] Rate limiting middleware added
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured (but not logging secrets)
- [ ] CORS properly configured
- [ ] Security headers configured (Next.js defaults)
- [ ] Dependencies updated (npm audit)
- [ ] Database migrations applied
- [ ] Backup strategy in place

## Vulnerability Disclosure

If you discover a security vulnerability, please [contact us](https://www.panamia.club/form/contact-us/) with the subject line "SECURITY VULNERABILITY" or email directly if you have our contact information.

**Do not** create public GitHub issues for security vulnerabilities.

## Compliance Considerations

### GDPR (EU Users)

- User data: Email, profile info, session notes
- Right to access: Implement data export
- Right to deletion: Implement account deletion
- Consent: Required for profile visibility

### COPPA (US Users Under 13)

- Not applicable: Platform for professional mentoring
- Age verification: Recommended to add

### Accessibility

- WCAG 2.1 compliance recommended
- Screen reader support for video controls
- Keyboard navigation for all features

## Security Testing Results

**Last Updated**: 2025-12-04

### Automated Scans

- [ ] npm audit (no high/critical vulnerabilities)
- [ ] OWASP ZAP scan
- [ ] Dependency check

### Manual Testing

- [x] Authentication bypass attempts (failed )
- [x] Authorization bypass attempts (failed )
- [x] XSS injection attempts (blocked )
- [x] SQL/NoSQL injection attempts (blocked )
- [x] CSRF attacks (protected )
- [ ] Pusher channel hijacking (to be tested)

### Penetration Testing

- [ ] Professional security audit (recommended before launch)

## Conclusion

The mentoring platform implements industry-standard security practices for authentication, authorization, and data protection. The main areas for improvement are:

1. Adding rate limiting (medium priority)
2. Configuring HTTPS for production (critical)
3. Professional security audit (recommended)

Overall Security Posture: **Strong**

The implementation follows security best practices and is ready for controlled beta testing. Production deployment should include the recommended enhancements above.
