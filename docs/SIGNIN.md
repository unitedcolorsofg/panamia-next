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
const existingUser = await user.findOne({ email }); // Finds Alice's user
userId = existingUser._id.toString(); // Same userId!

// Check if account link already exists
const existingAccount = await db.collection('nextauth_accounts').findOne({
  userId,
  provider: 'wikimedia',
  providerAccountId: 'wikimedia-id-789',
});

if (!existingAccount) {
  // Create NEW account link for Wikimedia
  await db.collection('nextauth_accounts').insertOne({
    userId, // Same userId as Google!
    type: 'oauth',
    provider: 'wikimedia',
    providerAccountId: 'wikimedia-id-789',
  });
}
```

#### 3. Result: Alice now has TWO account links, ONE user

**User record:**

```javascript
{
  _id: "abc123",
  email: "alice@example.com",
  emailVerified: ISODate("2025-01-01T00:00:00Z")
}
```

**Account links:**

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

### nextauth_users collection

```javascript
{
  _id: "abc123",
  email: "alice@example.com",
  emailVerified: ISODate("2025-01-01T00:00:00Z")
}
```

### nextauth_accounts collection

```javascript
[
  {
    userId: 'abc123',
    type: 'oauth',
    provider: 'google',
    providerAccountId: 'google-id-456',
  },
  {
    userId: 'abc123',
    type: 'oauth',
    provider: 'wikimedia',
    providerAccountId: 'wikimedia-id-789',
  },
  {
    userId: 'abc123',
    type: 'email', // If they also use magic link
    provider: 'email',
    providerAccountId: 'alice@example.com',
  },
];
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

**Code reference:** `/app/api/oauth/complete-verification/route.ts:54-82`

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
