# SMS Login Roadmap

Panas have asked whether they can sign in by text, alongside the existing magic
link. The short answer is yes, and better-auth already ships the plugin — but
the obvious version of the feature ("type your number, get a code, you're in")
collides with three load-bearing assumptions in this codebase, and the
interesting part of this document is what to build instead.

## Recommendation

**Bind a phone to an existing email-backed account. Do not make the phone an
identity.**

A pana signs in once the way they already do (magic link or OAuth), adds their
number in account settings, verifies it with a texted code, and from then on can
sign in with a code instead of an email. The phone becomes a second door into
the same account, never a second account.

Deliver it through **Twilio Verify** rather than raw SMS, which removes the
entire A2P 10DLC registration workstream (see
[Carrier compliance](#carrier-compliance-use-verify-skip-10dlc)).

Everything below is the argument for that shape.

## Why not phone-as-identity

Three blockers, in descending order of how hard they are to move.

### 1. Profile claiming is email-keyed, end to end

This is the real one. `claimProfileForUser()` (`auth.ts:691`) opens with:

```ts
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  columns: { email: true },
});
if (!user?.email) return;
const email = user.email.toLowerCase();

const unclaimedProfile = await db.query.profiles.findFirst({
  where: and(eq(profiles.email, email), isNull(profiles.userId), notBusinessListing),
});
```

It is invoked from both `databaseHooks.account.create.after` and
`databaseHooks.session.create.after` (`auth.ts:1025`, `auth.ts:1033`), so it runs
on every sign-in path including magic links. The same function gates the GHL
contact link.

A phone-only user reaches the end of sign-in with **no claimed profile, no
directory listing, and no CRM contact** — and nothing in the UI would explain
why. Their pana profile, which was created from an intake form keyed on their
email, simply never attaches. Fixing this means teaching profile claiming a
second identity key, which touches profile ownership, the business-listing
exclusion, and GHL sync all at once.

### 2. `users.email` is `NOT NULL UNIQUE`

`lib/schema/index.ts:513`:

```ts
email: text('email').notNull().unique(),
```

Phone-only signup fails at the database constraint, not merely at the
application guard. There is also an explicit application guard
(`auth.ts:990`) that blocks it earlier:

```ts
user: {
  create: {
    before: async (user) => {
      if (!user.email) {
        console.error('Sign-in blocked: No email provided', { userId: user.id });
        return false;
      }
    },
  },
},
```

### 3. better-auth's auto-signup mints synthetic emails

The plugin's `signUpOnVerification` option requires a `getTempEmail(phoneNumber)`
function and writes its result into `users.email`. That satisfies the constraint
above only by inventing addresses like `+13055550123@panamia.club` — which then
sit in the same column the `magicLink` plugin treats as a deliverable address,
and in the same column profile claiming matches on. We would be manufacturing
rows that look like members with email but aren't.

**Binding a phone to an already-claimed account sidesteps all three.** The user
row already has a real, verified email; the profile is already claimed; nothing
synthetic is created.

## The shape that works

better-auth's `verify` endpoint has a documented account-linking mode that is
exactly this flow.

```ts
await authClient.phoneNumber.verify({
  phoneNumber,
  code,
  updatePhoneNumber: true, // ← binds to the *session* user
});
```

With `updatePhoneNumber: true` the endpoint requires an active session (401
`USER_NOT_FOUND` otherwise), checks that no other user holds the number
(`PHONE_NUMBER_EXIST`), sets `phoneNumber` + `phoneNumberVerified` on the
session user, and returns the existing session token. No user is created.

Then on later sign-ins, the plain `verify` call (without `updatePhoneNumber`)
finds the user by phone number and issues a session.

There is a second benefit that is easy to miss: **requiring a session to enroll
is also the strongest anti-pumping control available.** Twilio's own toll-fraud
guidance recommends confirming an email address before enrolling a phone,
precisely because it breaks automated enrollment. We get that for free, because
magic link already proved the email.

### Note: `/sign-in/phone-number` is not our endpoint

The plugin also exposes `authClient.signIn.phoneNumber({ phoneNumber, password })`.
That is phone-as-username with a **password**, and this app has no passwords —
`emailAndPassword` is not configured, and `accounts.password` is documented at
`lib/schema/index.ts:570` as declared-but-never-written. Our sign-in path is
`phoneNumber.sendOtp` → `phoneNumber.verify`, both under `/phone-number/*`.

## Plugin specifics (better-auth v1.7.6)

Verified against the `v1.7.6` source tag, not just the docs page.

```ts
import { phoneNumber } from 'better-auth/plugins';          // server
import { phoneNumberClient } from 'better-auth/client/plugins'; // client
```

### Options

| Option | Type | Default |
| --- | --- | --- |
| `sendOTP` | `({ phoneNumber, code }, ctx?) => Awaitable<void>` | required at runtime |
| `otpLength` | `number` | `6` |
| `expiresIn` | `number` (seconds) | `300` |
| `allowedAttempts` | `number` | `3` |
| `requireVerification` | `boolean` | `false` |
| `verifyOTP` | `({ phoneNumber, code }, ctx?) => Awaitable<boolean>` | — |
| `phoneNumberValidator` | `(phoneNumber: string) => Awaitable<boolean>` | — |
| `callbackOnVerification` | `({ phoneNumber, user }, ctx?) => Awaitable<void>` | — |
| `signUpOnVerification` | `{ getTempEmail, getTempName? }` | — (leave unset) |

`sendOTP` is typed optional but returns **501 `SEND_OTP_NOT_IMPLEMENTED`** at
runtime if missing. Setting `verifyOTP` (which we will, for Twilio Verify)
**replaces internal verification entirely and bypasses `allowedAttempts`** — we
inherit the provider's throttling instead. The docs carry an explicit warning
about this.

### Schema impact: two columns, no new table

```ts
user: {
  fields: {
    phoneNumber:         { type: 'string',  required: false, unique: true, ... },
    phoneNumberVerified: { type: 'boolean', required: false, input: false },
  },
}
```

Two things follow for our Drizzle schema:

- `phoneNumber` carries a **UNIQUE** constraint. The migration must create the
  unique index or concurrent claims of the same number won't be caught.
- **OTPs reuse the existing `verification_tokens` table**
  (`lib/schema/index.ts:605`). The plugin writes `value: \`${code}:0\``, where the
  `:0` suffix is the failed-attempt counter. No OTP table is added.

Watch the naming collision: `profiles.phone_number` **already exists**
(`lib/schema/index.ts:758`). It is self-entered on the intake forms, never
verified, and **must never be auto-promoted to `users.phoneNumber`** — doing so
would let anyone who typed a number into a public form receive sign-in codes for
it. Pre-filling the enrollment input with it is fine; trusting it is not.

### Re-binding is locked down, correctly

`/update-user` rejects any non-null `phoneNumber` with 400
`PHONE_NUMBER_CANNOT_BE_UPDATED`. Only an OTP-verified `verify()` can set one.
Setting `phoneNumber: null` is allowed and an `init()` hook atomically resets
`phoneNumberVerified`, releasing the number. This matches NIST's requirement
that changing a registered phone number is the binding of a new authenticator.

## Three gotchas in the 1.7.6 source

These are a reading of the control flow, **not documented behaviour** — confirm
each at runtime before building on them.

1. **Unknown number without `signUpOnVerification` throws a 500.** The handler
   falls through to `APIError.from('INTERNAL_SERVER_ERROR', FAILED_TO_UPDATE_USER)`
   rather than returning a clean 4xx. Since we deliberately leave
   `signUpOnVerification` unset, *every* sign-in attempt from a number we don't
   know hits this. We need a `before` hook that pre-checks existence and returns
   a real "we don't recognise that number" error.

2. **The built-in rate limit is thin.** `{ pathMatcher: path.startsWith('/phone-number'), window: 60, max: 10 }`.
   Ten texts per minute per IP is far too permissive when each one costs money.
   Worse, better-auth's limiter is **IP-based and in-memory by default**, which
   on Cloudflare Workers is per-isolate and therefore close to meaningless. We
   must configure durable storage (KV or a Durable Object) and tighten the
   window.

3. **Requesting a new OTP resets the failed-attempt counter.** Each `send-otp`
   writes a fresh row with the counter back at `:0`, so three-guesses-then-resend
   loops indefinitely. This diverges from a NIST **SHALL** (see
   [Security posture](#security-posture)) and needs a per-number counter of our
   own that survives regeneration.

## Carrier compliance: use Verify, skip 10DLC

US carriers require A2P 10DLC brand + campaign registration for business SMS,
and campaign approval runs **up to four weeks**. But Twilio documents, in two
separate places, that this does not apply to Verify:

> If you're only using 10DLC numbers to send user verification text messages,
> you can use Twilio Verify rather than registering for A2P 10DLC.

> Are you seeking to register your Brand solely in the service of an OTP […] or
> any other type of 2-Factor Authentication (2FA) use case? […] With Verify you
> do not need to worry about A2P registration (Brand or Campaign) or any other
> aspect of sender provisioning.

For a small collective shipping SMS login, that removes the whole workstream.

Fees we would be avoiding, for reference (verified from Twilio's fee table,
2026-10-05):

| Item | Cost |
| --- | --- |
| Brand registration (Sole Proprietor / Low-Volume Standard) | $4.50 one-time |
| Brand registration (Standard, incl. secondary vetting) | $46 one-time |
| Standard vetting | $41.50 per vetting |
| Campaign use-case vetting | $15 |
| Campaign monthly — Standard | $10/mo |
| Campaign monthly — Low-volume mixed | $1.50/mo |
| **Campaign monthly — Special: Charity / 501(c)(3) Nonprofit** | **$3/mo** |

Unregistered traffic is not merely discouraged: Twilio applies surcharges and
carriers filter it aggressively.

### The 501(c)(3) position, confirmed

Pana MIA is a registered 501(c)(3) with an EIN. That turns the direct path from
an expensive fallback into something genuinely cheap at scale. Verified against
Twilio's Special Use Cases tables, 2026-10-05:

| | Charity / 501(c)(3) Nonprofit |
| --- | --- |
| Campaign registration | **$3/month** |
| AT&T SMS carrier fee (outbound) | **$0.0000** |
| AT&T MMS carrier fee (outbound) | **$0.0000** |
| T-Mobile SMS carrier fee (in/outbound) | **$0.0000** |
| T-Mobile MMS carrier fee (in/outbound) | **$0.0000** |
| AT&T throughput | 40 MPS |
| T-Mobile daily cap | none listed |
| Volume minimum | none |

It is the **only** use case in that table that is zero across all four
carrier-fee columns; every other category pays $0.002–0.010 per message.
T-Mobile's waiver has applied automatically since 2022-02-01, is no longer
limited to fundraising, and needs no special business review. Outbound fees are
waived at source; inbound fees still appear on the bill and are credited back at
month end.

Eligibility is verified automatically — at brand registration Twilio vets the
brand against IRS tax-exempt records in the background, with no extra action
from us. Success is observable two ways: Charity / 501(c)(3) appears in the
campaign type list, and the brand's `tax_exempt_status` attribute reads `501c3`.

Two caveats matter before anyone treats this as free money.

**We would not get to choose a different use case.** Twilio is explicit that
vetted 501(c)(3)s "will *only* qualify for the Charity / 501(c)(3) Nonprofit and
Emergency special use cases." The standard 2FA/OTP use case would be closed to
us.

**And the Charity use case is not obviously an OTP use case.** Twilio defines it
as "communications from a registered Charity / 501(c)(3) Nonprofit aimed at
providing help and raising money for those in need," illustrated with a food
bank sending appointment reminders. A sign-in code is neither. We would be
registering authentication traffic under a charitable-messaging campaign because
it is the only door open to us. That is a question for Twilio support **before**
committing to the direct path, not after a campaign rejection.

Both caveats disappear under Verify, which needs no brand, no campaign, and no
use-case classification at all.

## Cost

| Path | Unit cost |
| --- | --- |
| **Twilio Verify** | **$0.05 per successful verification** |
| Direct, as a 501(c)(3) | $0.0083/segment + ~$0.002 blended carrier ≈ **$0.010** |
| Direct, standard brand (for contrast) | $0.0083 + ~$0.0035–0.005 ≈ $0.012 |
| Telnyx (comparison) | from $0.004/part + carrier ≈ $0.0078 |

The nonprofit waiver moves the per-message number less than you would expect —
from ~$0.012 to ~$0.010. AT&T and T-Mobile go to zero, but Verizon's $0.005 is
not waived and still lands on roughly a third of US traffic. The real saving is
fixed: a $3/mo campaign instead of $10, and no per-message carrier drag on two
of the three major networks.

Annualized, the direct path for us is roughly **$50/year fixed** ($3/mo campaign
plus ~$1.15/mo for the long code — that number is from Twilio's console pricing
and was not independently re-verified here), plus **$19.50–61 one-time** (brand
registration at $4.50 low-volume or $46 standard, plus $15 campaign use-case
vetting), plus $0.010 per message.

That puts the fee-only crossover far lower than it first appears:

| Verifications/year | Verify @ $0.05 | Direct, 501(c)(3) | Difference |
| --- | --- | --- | --- |
| 1,000 | $50 | $60 | Verify cheaper by $10 |
| 2,500 | $125 | $75 | Direct cheaper by $50 |
| 5,000 | $250 | $100 | Direct cheaper by $150 |
| 10,000 | $500 | $150 | Direct cheaper by $350 |
| 25,000 | $1,250 | $300 | Direct cheaper by $950 |

**Breakeven is ~1,250 verifications/year** (~100/month) in steady state, ~1,700
in year one once registration is amortized. An earlier draft of this doc put it
near 20k; that was written before nonprofit status was confirmed and was wrong.

**The recommendation is still Verify**, but the reasoning is now about what the
premium buys rather than about raw cost:

- **Fraud Guard and rate limiting are included.** Gotchas 2 and 3 above are
  precisely the controls we would otherwise have to build and operate ourselves
  — on Cloudflare Workers, where better-auth's in-memory limiter is per-isolate
  and close to meaningless. At 5,000 verifications/year the entire premium is
  $150, well under the cost of building that once, never mind maintaining it.
- **No four-to-six week campaign lead time**, so Phase 1 is not gated on carrier
  approval.
- **No use-case classification risk** — see the two caveats above.

So: ship on Verify. Revisit the direct path when sustained volume clears roughly
**10k verifications/year**, where the gap starts to exceed a few hundred dollars
and the fixed engineering cost of running our own throttling begins to amortize.
Because Verify and direct sending share the same better-auth seam (`sendOTP` /
`verifyOTP`), that migration is a transport swap, not a redesign.

Verify also happens to be the better Cloudflare fit: it is a single `fetch()`
against `POST https://verify.twilio.com/v2/Services/{ServiceSid}/Verifications`,
with no SDK, no Node built-ins, and no `compatibility_date` coupling. We
implement **both** `sendOTP` (create Verification) and `verifyOTP`
(VerificationCheck).

## Abuse: SMS pumping

The attack: a fraudster drives OTP sends to blocks of adjacent numbers on an
operator they have a revenue-share with, and collects a cut. The tell is a spike
of sends with **near-zero completed verifications** — that ratio is the alarm
worth building.

Cost exposure is real even without leaving the US rate card: published
per-message rates to some carriers run ~40× the domestic average. An unthrottled
public send endpoint reaches four figures a day with a modest botnet.

Controls, in descending order of leverage:

1. **Geo-allowlist `+1` only.** Highest leverage, lowest effort. Pana MIA is a
   Miami network; there is no reason to text anywhere else. Twilio Verify Geo
   Permissions does this provider-side.
2. **Session-gate enrollment.** Already true by design (above).
3. **Verify Fraud Guard at the Basic level** — Twilio's own recommendation for
   senders with a primarily North American footprint.
4. **Turnstile on the send step.** We already have this
   (`components/Turnstile`, used at `app/signin/_components/signin-view.tsx:160`
   with an `'email_signin'` action tag). An `'sms_signin'` tag drops in
   alongside.
5. **Resend cooldown with exponential backoff**, plus the durable per-number
   failed-attempt counter from gotcha 3.
6. **Alert on verification conversion rate**, per country.

### One thing to fix in the existing Turnstile pattern

Today the magic-link form verifies Turnstile from the client against
`/api/auth/verify-turnstile` and *then* separately calls `signIn()`
(`signin-view.tsx:266-284`). Those are two independent requests — a script can
skip the first and call the second. For magic link the downside is a wasted
email. **For SMS it is money**, so the Turnstile check has to move server-side
into the send path itself, not sit beside it.

## Consent

Texting members is governed by TCPA, and we already have both primitives:

- **`consent_receipts`** (`lib/schema/index.ts:631`) — record a receipt at phone
  enrollment, capturing version and IP, exactly as we do for terms and privacy.
- **GHL DND channels** (`lib/ghl.ts:105`) already model an `SMS` channel with
  active/inactive status and `user_unsubscribe` / `user_resubscribe` codes
  (`lib/ghl.ts:585`, `lib/ghl.ts:641`). Honour it: a member who is DND for SMS in
  the CRM should not be offered SMS login.

Transactional OTPs sit in a different consent bucket than marketing, but the
enrollment screen still needs explicit, logged opt-in language, plus STOP/HELP
handling.

## Security posture

The instinct is that SMS is a downgrade from magic link. Under the current
standard that is harder to argue than it sounds.

**NIST SP 800-63B Rev 4 is final (July 2025).** It designates SMS/PSTN
out-of-band as **restricted — not deprecated, not prohibited**. Using a
restricted authenticator obligates four things, and we already satisfy the
expensive one:

1. Offer a non-restricted alternative at the same AAL — ✅ magic link + four
   OAuth providers stay exactly as they are.
2. Give users meaningful notice of the risks — a UI copy task.
3. Cover the added risk in the risk assessment — a doc task.
4. Maintain a migration plan — a doc task.

The counterintuitive part is worth stating plainly, because it reframes the
whole question: **Rev 4 prohibits email as an out-of-band authenticator
outright** (§3.1.3.1), on the grounds that mailboxes may be reachable with only
a password and that mail can be intercepted or rerouted. It carves out codes
sent to *validate* an address or as recovery codes — but a magic link used as
primary sign-in is squarely in contested territory, while SMS OTP is explicitly
permitted-with-conditions. Adding SMS is not a step down from where we are.

Both are equally phishing-vulnerable, and neither is phishing-resistant: §3.2.5
excludes any manually-entered authenticator output, because entry doesn't bind
the secret to the session. Only WebAuthn/FIDO2 clears that bar. (A caveat worth
keeping honest: 800-63B binds federal CSPs. For us it is a well-reasoned
benchmark, not a mandate.)

### better-auth defaults vs. NIST

| Requirement | v1.7.6 default | |
| --- | --- | --- |
| Valid ≤ 10 minutes | `expiresIn: 300` | ✅ |
| ≥ 6 decimal digits, approved RNG | `otpLength: 6` | ✅ |
| Single use / replay-resistant | record deleted on use | ✅ |
| Rate-limit failed attempts | `allowedAttempts: 3` | ✅ |
| Non-restricted alternative offered | magic link + OAuth retained | ✅ |
| **New secret SHALL NOT reset failed-attempt count** | resend resets to `:0` | ❌ |

That last row is the one genuine spec divergence, and it is the same fix as
gotcha 3.

NIST also asks verifiers to **consider SIM-swap / port-out / device-change
signals** before sending (§3.1.3.3, SHOULD), which carrier Lookup APIs expose —
a Phase 2 item.

## Who this is for

The case for doing this at all is access, and the numbers are specific.

From Pew's Mobile Fact Sheet (NPORS, 5,022 US adults, fielded Feb–Jun 2025):

- **7%** of US adults own a cellphone but **not** a smartphone. Among adults
  **65+ that is 16%**; at household income **under $30k it is 13%**; with a high
  school education or less, **13%**.
- **16%** of US adults are smartphone-only internet users, with no home
  broadband — a figure that has not meaningfully shrunk since 2018.

Feature-phone owners can receive a text. They cannot practically open a magic
link. For them this isn't convenience, it's the only working door.

And the distribution matters for *this* network specifically:

| Smartphone-dependent (no home broadband), 2025 | |
| --- | --- |
| **Hispanic** | **28%** |
| Black | 19% |
| White | 13% |

**Miami-Dade is majority Hispanic.** The group most likely to be mobile-only is
the group most likely to be our core membership — Hispanic adults are more than
twice as likely as White adults to be smartphone-dependent, and that figure rose
from 22% to 28% between 2024 and 2025.

Two honest counterweights:

- NIST flags the inverse exclusion: members in areas with poor phone coverage
  can't use PSTN delivery. Keeping magic link as the default, not replacing it,
  covers this.
- Lower-income members disproportionately use prepaid plans with **higher number
  churn**. A recycled number reaching a new person is a real account-recovery
  hazard. The `UNIQUE` constraint prevents one number silently serving two
  accounts, and the `phoneNumber: null` release path exists — but we should set
  an inactivity policy rather than assume a number is forever.

### Bonus: this fixes native app sign-in

`docs/SIGNIN.md` records that the iOS and Android apps offer **magic link only**,
because Google returns `disallowed_useragent` for OAuth in an embedded WebView
and the other providers would each need a native SDK.

SMS OTP has no such problem. It is a *code the user types*, not a redirect, so it
works identically in a WebView. This would be the **first additional sign-in
method the native apps can actually offer** — and it is the one best suited to a
phone in the first place.

## Phases

### Phase 1 — bind and sign in

- Migration: `users.phone_number` (unique) + `users.phone_number_verified`.
- `phoneNumber` plugin in `auth.ts`, `sendOTP`/`verifyOTP` via Twilio Verify REST.
- `before` hook returning a clean error for unknown numbers (gotcha 1).
- Enrollment UI in `/account/user/edit`, session-gated, Turnstile + consent
  receipt.
- Sign-in UI: phone option on `app/signin`, behind the same Turnstile pattern
  but server-verified.
- Durable rate-limit storage; tighten the window well below 10/min.
- EN + ES copy, including the NIST "meaningful notice" language.

### Phase 2 — hardening

- Per-number failed-attempt counter surviving OTP regeneration (gotcha 3 / NIST).
- Resend cooldown with exponential backoff.
- Verification conversion-rate alarm.
- Lookup line-type check (mobile only) and SIM-swap signals.
- Number-inactivity / recycling policy.

### Phase 3 — phone-first signup (deferred)

Explicitly **not** planned. It requires dropping `users.email`'s `NOT NULL`,
teaching `claimProfileForUser()` a second identity key, and reworking GHL
linking. Revisit only if a measured number of prospective members are bouncing
off signup for lack of an email address — not before.

## Decisions needed

1. **Verify vs. direct.** Recommendation is Verify; confirm the volume
   assumption and the ~10k/year trigger to revisit. (Entity status is settled:
   Pana MIA is a 501(c)(3) with an EIN, so the direct path would be the
   Charity / 501(c)(3) campaign at $3/mo with AT&T and T-Mobile fees waived.)
2. **Before any direct-path work**, ask Twilio support whether authentication
   OTPs are acceptable under the Charity / 501(c)(3) campaign type, given that
   vetted 501(c)(3)s cannot register the standard 2FA use case.
3. **Does SMS login appear in the native apps at launch?** It is the only
   provider besides magic link that can work there.
4. **Number-recycling policy** — how long before an unused number is unbound.

## Verification

1. Migration applies; `users.phone_number` has a unique index.
2. A signed-in magic-link user enrolls a number, receives a code, and
   `phoneNumberVerified` flips true with **no new user row created**.
3. That user signs out, signs in by phone, and lands in the **same** account —
   same profile, same screenname, same GHL contact.
4. Enrolling a number already held by another user returns `PHONE_NUMBER_EXIST`,
   not a 500.
5. An unknown number at sign-in returns a clean "number not recognised", not a
   500 (gotcha 1).
6. Three wrong codes → `TOO_MANY_ATTEMPTS`; requesting a new code does **not**
   restore the attempt budget (gotcha 3).
7. A send request without a valid Turnstile token is rejected **server-side**,
   with no SMS billed.
8. A non-`+1` number is refused before any send.
9. A consent receipt row exists for the enrollment.
10. Sign-in by phone works inside the iOS and Android WebView.

## Related

- `auth.ts` — plugin registration (`auth.ts:913`), `claimProfileForUser`
  (`auth.ts:691`), user/account/session hooks (`auth.ts:987`).
- `lib/schema/index.ts` — `users` (`:509`), `verification_tokens` (`:605`),
  `consent_receipts` (`:631`), `profiles.phone_number` (`:758`).
- `lib/auth-client.ts` — client plugin list and the `signIn()` compat shim.
- `app/signin/_components/signin-view.tsx` — existing Turnstile + magic-link form.
- `lib/ghl.ts` — SMS DND channel model (`:105`, `:585`, `:641`).
- [SIGNIN.md](./SIGNIN.md) — account linking, and why the native apps are
  magic-link-only.
- [MOBILE-ROADMAP.md](./MOBILE-ROADMAP.md), [PRIVACY-ROADMAP.md](./PRIVACY-ROADMAP.md).

### External references

- better-auth phone number plugin — https://www.better-auth.com/docs/plugins/phone-number
- Twilio A2P 10DLC — https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Twilio A2P fees — https://help.twilio.com/articles/1260803965530
- Twilio A2P special use cases (Charity / 501(c)(3) tier, fee waivers,
  throughput) — https://help.twilio.com/articles/4402972441243
- Twilio nonprofit & government 10DLC guide — https://help.twilio.com/articles/4405850570267
- Twilio Verify pricing — https://www.twilio.com/en-us/verify/pricing
- Twilio toll-fraud prevention — https://www.twilio.com/docs/verify/preventing-toll-fraud
- NIST SP 800-63B Rev 4 — https://pages.nist.gov/800-63-4/sp800-63b.html
- Pew Mobile Fact Sheet — https://www.pewresearch.org/internet/fact-sheet/mobile/
