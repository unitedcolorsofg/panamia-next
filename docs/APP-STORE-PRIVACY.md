# App Store privacy labels

The answers to transcribe into **App Store Connect → App Privacy**, and the
evidence behind each one. The same analysis feeds Google Play's _Data safety_
form, which asks the same questions in a different order.

Derived from `app/legal/privacy/policy.json` and `lib/legal/data-inventory.ts`,
which are already kept honest against the schema by `scripts/check-data-inventory.ts`.
When a table is added, that check forces a privacy decision — **this file is the
third step, and it is manual.** Re-read it whenever a category is added.

## Why the whole site is in scope

The native app is a WebView pointed at `https://pana.social`; `mobile/www` holds
only `offline.html`. Apple's guidance is explicit:

> Your app has web views. Data collected via web traffic must be declared,
> unless you are enabling the user to navigate the open web.

So every category in `policy.json` is in scope, not just the native shell.
The one genuine exception is payment, which deliberately leaves the app
entirely — see _Not collected_ below.

Apple's definition of "collect" is the load-bearing one:

> transmitting data off the device in a way that allows you and/or your
> third-party partners to access it for a period longer than what is necessary
> to service the transmitted request in real time.

## Tracking

**No.** Answer "No" to the tracking question, and do not add `NSUserTrackingUsageDescription`.

There are no advertising SDKs, no analytics SDKs, and no data brokers. The only
third-party code in the app is the official Capacitor plugins. Nothing is linked
with third-party data for advertising, and nothing is sold.

## Data collected

Everything below is **Linked to the user** — this is an identity-based directory
and social network, so there is no de-identified collection to claim.

| Apple data type                        | Purposes                                                                         | What it actually is                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact Info › Name                    | App Functionality, Developer's Advertising or Marketing                          | `users.name`, OAuth profile, GoHighLevel contact. Marketing applies because of the newsletter.                                                                                                                    |
| Contact Info › Email Address           | App Functionality, Developer's Advertising or Marketing                          | Account, OAuth, CRM, contact form, deletion audit.                                                                                                                                                                |
| Contact Info › Phone Number            | App Functionality                                                                | `phone_number` on the listing contact form. Public by design.                                                                                                                                                     |
| Contact Info › Physical Address        | App Functionality                                                                | Business address on a directory listing. Public by design.                                                                                                                                                        |
| Location › Precise Location            | App Functionality                                                                | Optional geotag on a **voice memo** — the member opens the picker and chooses _Precise_. Stored in `social_statuses.location` and federated. Also `profiles.geo`, geocoded from the listing address.              |
| Location › Coarse Location             | App Functionality                                                                | The _General_ option in the same picker, fuzzed ±244m on the device before it is sent.                                                                                                                            |
| User Content › Audio Data              | App Functionality                                                                | Voice memos. Recorded with `getUserMedia`, transcoded to Opus, uploaded to R2 and attached to a post. Mentoring-session audio is peer-to-peer and never retained, but the voice memo path alone makes this a Yes. |
| Contacts                               | App Functionality, Product Personalization                                       | Apple's definition of Contacts explicitly includes "social graph": follows, followers, likes, group membership.                                                                                                   |
| User Content › Emails or Text Messages | App Functionality                                                                | In-app DMs. Apple requires this for any non-SMS private messaging.                                                                                                                                                |
| User Content › Photos or Videos        | App Functionality                                                                | Avatars, gallery images, post attachments.                                                                                                                                                                        |
| User Content › Customer Support        | App Functionality                                                                | `contact_submissions`.                                                                                                                                                                                            |
| User Content › Other User Content      | App Functionality, Product Personalization                                       | Posts, replies, bios, articles, recommendation lists, intake answers, report descriptions.                                                                                                                        |
| Identifiers › User ID                  | App Functionality, Product Personalization, Developer's Advertising or Marketing | Screenname, user id, Nostr pubkey, GoHighLevel contact id.                                                                                                                                                        |
| Identifiers › Device ID                | App Functionality                                                                | Push tokens in `device_tokens`, sent to Apple and Google on every delivery.                                                                                                                                       |
| Usage Data › Product Interaction       | App Functionality, Analytics                                                     | The `interactions` table — engagement actions and points.                                                                                                                                                         |
| Diagnostics › Other Diagnostic Data    | App Functionality                                                                | IP and user agent in Cloudflare logs; IP retained in consent receipts and the deletion audit. Apple asks you to declare IP by how it is used — here it is consent proof and abuse prevention.                     |

## Not collected, and why

Say "No" to these. Each one has a reason that survives a reviewer asking.

- **Payment Info.** Apple's own carve-out: _"If your app uses a payment service,
  the payment information is entered outside your app, and you as the developer
  never have access to the payment information, it is not collected and does not
  need to be disclosed."_ Removing `checkout.stripe.com` and `js.stripe.com`
  from `allowNavigation` is what makes this true — checkout opens in the system
  browser. Do not re-add them.
- **Purchase History.** Checkout happens outside the app and no transaction
  records are stored locally.
- **Sensitive Info.** No ethnicity, orientation, religion, or political fields
  anywhere in the schema. Free-form bios are excluded by Apple's guidance that
  you are not responsible for whatever a user types into a generic text field.
- **Search History.** Directory and social search run as queries; nothing
  writes the search term anywhere.
- **Browsing History, Advertising Data, Credit Info, Other Financial Info,
  Health, Fitness, Gameplay Content, Environment Scanning, Hands, Head.** None.

## Privacy links

- **Privacy Policy (required):** `https://pana.social/legal/privacy`
- **Privacy Choices (optional, worth filling in):** `https://pana.social/account/privacy`

## Verify before submitting

1. **`policy.json` does not mention location at all.** The `social_posts`
   category lists "posts, replies, tags, mentions" and `uploads` covers media
   generically, but nothing tells a member that a voice memo can carry their
   coordinates. That is the most sensitive thing a post holds, and the labels
   will declare Precise Location. Worth fixing before submission.
2. **`profiles.stripe_customer_id` is never written.** Harmless for the labels,
   but it means the `payments` category describes a column that holds nothing.
