# Sign-In System Documentation

## Seamless Provider Switching

### Can users freely change between sign-in methods?

**YES - Seamless provider switching, with one caveat**

Users with the same email address registered with multiple OAuth providers can freely switch between sign-in methods for a seamless UX.

### How it works

**Scenario: Alice has `alice@example.com` and uses multiple providers**

#### 1. First sign-in with Google (trusted provider)

- NextAuth creates user record with `alice@example.com`
- Creates account link: `{userId: "abc123", provider: "google", providerAccountId: "google-id-456"}`
- Profile auto-claimed immediately

#### 2. Later sign-in with Wikimedia (verification-required provider)

- Alice authenticates with Wikimedia OAuth → provides `alice@example.com`
- Sign-in blocked, verification email sent
- Alice clicks magic link
- `/api/oauth/complete-verification` executes:

```typescript
const existingUser = await tx.user.findUnique({ where: { email } }); // Finds Alice's user
userId = existingUser.id; // Same userId!

// Check if account link already exists
const existingAccount = await tx.account.findUnique({
  where: {
    provider_providerAccountId: {
      provider: 'wikimedia',
      providerAccountId: 'wikimedia-id-789',
    },
  },
});

if (!existingAccount) {
  // Create NEW account link for Wikimedia
  await tx.account.create({
    data: {
      userId, // Same userId as Google!
      type: 'oauth',
      provider: 'wikimedia',
      providerAccountId: 'wikimedia-id-789',
    },
  });
}
```

#### 3. Result: Alice now has TWO account links, ONE user

**User record (PostgreSQL `users` table):**

```json
{
  "id": "abc123",
  "email": "alice@example.com",
  "emailVerified": "2025-01-01T00:00:00Z"
}
```

**Account links (PostgreSQL `accounts` table):**

- Account 1: `{userId: "abc123", provider: "google", providerAccountId: "google-id-456"}`
- Account 2: `{userId: "abc123", provider: "wikimedia", providerAccountId: "wikimedia-id-789"}`

#### 4. Subsequent sign-ins

- Alice can use **either** Google or Wikimedia
- Both authenticate to the **same user record**
- Same sessions, same profile, seamless switching

## The One Caveat

**First-time verification-required providers need one-time email verification**

- If Alice's **first** sign-in is Wikimedia → requires verification
- If Alice's **first** sign-in is Google → immediate access
- After both are linked → completely seamless

## Data Structure

### PostgreSQL `users` table

```json
{
  "id": "abc123",
  "email": "alice@example.com",
  "emailVerified": "2025-01-01T00:00:00Z"
}
```

### PostgreSQL `accounts` table

```json
[
  {
    "userId": "abc123",
    "type": "oauth",
    "provider": "google",
    "providerAccountId": "google-id-456"
  },
  {
    "userId": "abc123",
    "type": "oauth",
    "provider": "wikimedia",
    "providerAccountId": "wikimedia-id-789"
  },
  {
    "userId": "abc123",
    "type": "email",
    "provider": "email",
    "providerAccountId": "alice@example.com"
  }
]
```

## Security Note

This is a **feature** of NextAuth called "account linking" and it's secure because:

- Each provider independently verified the email address
- The linking happens at the `userId` level (identified by email)
- User has one identity, multiple authentication methods
- No UX friction after initial verification

## Implementation Details

### Account Linking for Trusted Providers

Trusted providers (Google, Apple, Email, mastodon.social) create account links automatically through NextAuth's default flow.

### Account Linking for Verification-Required Providers

Verification-required providers (Wikimedia, self-hosted Mastodon) create account links after email verification:

1. OAuth authentication succeeds
2. Sign-in blocked, verification email sent
3. User clicks magic link
4. `/api/oauth/complete-verification` checks for existing user by email
5. If user exists: creates new account link to existing user
6. If user doesn't exist: creates new user + account link
7. Profile auto-claimed (if unclaimed)
8. User can now sign in with this provider

**Code reference:** `/app/api/oauth/complete-verification/route.ts:51-101`

---

## Developer Scripts

### Create a sign-in link

```bash
npx tsx scripts/create-signin-link.ts <email>
```

Creates a magic link that can be used to sign in as any user. Useful for testing.

### Check sign-in token status

```bash
npx tsx scripts/get-signin-link.ts <email>
```

Shows if there are pending verification tokens for an email. Note: tokens are stored hashed, so URLs cannot be reconstructed. Use `create-signin-link.ts` to create new links.

### Delete a user

```bash
npx tsx scripts/delete-user.ts <email>
```

Completely removes a user from both PostgreSQL (auth) and MongoDB (profile).

---

## TODO: Account Settings Enhancements

### Active Sessions Display

Add to `/account/user/edit` or a new `/account/security` page:

- Show all actively signed-in sessions
- Display for each session:
  - Last login location (city/country from IP geolocation)
  - IP address
  - Web browser / User agent
  - Last activity timestamp
- Allow users to revoke other sessions ("Sign out everywhere else")
