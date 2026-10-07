# Admin access

Who can reach the admin surface at `admin.pana.social`, who can grant that
access to somebody else, and why the second one is deliberately awkward.

## Two tiers

| Tier            | Source                 | Uses admin screens | Grants admin |
| --------------- | ---------------------- | ------------------ | ------------ |
| **Super admin** | `ADMIN_EMAILS` secret  | yes                | **yes**      |
| **Admin**       | `profiles.roles.admin` | yes                | no           |

`session.user.isAdmin` is the union of the two. `session.user.isSuperAdmin` is
the env tier alone and never reads the column. Both are computed in
`enrichUserFields()` in `auth.ts`, on every request.

Server-side gates live in `lib/server/admin-auth.ts`:

- `checkAdminAuth()` — ordinary admin work: reading a queue, working the
  inbox, exporting. Use this for almost everything.
- `checkSuperAdminAuth()` — anything that changes *who* is an admin. Use it
  for that and nothing else.

## Granting admin

From `/admin/users/live`, as a super admin. The toggle writes
`profiles.roles.admin` through `POST /api/admin/users/admin-role`.

A grant takes effect on the target's **next page load**. `enrichUserFields()`
re-reads `profiles` every request, so there is no sign-out step, no cache to
bust and no redeploy.

Three cases the route refuses rather than quietly accepting:

- **Revoking a super admin** returns 409. `isAdmin` is a union, so clearing the
  column on an `ADMIN_EMAILS` member would leave them an admin — writing it
  anyway would return success and leave you believing you had removed access
  the account still had. Remove them from the secret instead.
- **An account with no profile** returns 409. The grant rides
  `profiles.roles`, so an account with no profile row has nowhere to hold it.
  The person needs to finish signing up first.
- **A non-boolean payload** returns 400, so a missing field cannot read as a
  revoke and the string `"false"` cannot read as a grant.

The write merges into the existing `roles` object rather than replacing it —
that column also carries `mentoringModerator`, `eventOrganizer` and
`contentModerator`.

## Bootstrapping the first super admin

This is the one step that cannot happen inside the product, and it happens
**once**, not per admin.

```
npx wrangler secret put ADMIN_EMAILS
```

Paste the complete comma-separated list. Spacing does not matter; the parser
trims. There is a single Worker (`panamia-next`) with no named environments,
so no `--env` flag is needed. Secrets roll out as a new Worker version
immediately — no separate deploy. `adminEmailList()` reads `process.env` on
every call rather than caching at module load, so a rotation takes effect as
soon as the new version is live rather than whenever an isolate recycles.

Verify by loading `/api/admin/checkAdminStatus` while signed in. It returns
`{"data":{"admin_status":true}}` once you are in.

### The secret replaces, and cannot be read back

`wrangler secret put` overwrites the whole value, and Cloudflare will not
show you the current one. Writing only your own address therefore silently
drops every other admin **and** breaks two mail paths:

- `lib/email.ts` falls back to `ADMIN_EMAILS[0]` for Contact Us
- `lib/server/relay-reports.ts` fans abuse reports out to every entry

If the current list has been lost, it can be recovered without the secret:
whichever inbox receives Contact Us mail is `ADMIN_EMAILS[0]`
(`DEV_RECEIVER_EMAIL` is local-only, so the fallback applies in production),
and any abuse report that has ever been sent went to every entry.

## Why the website cannot do the bootstrap

Somebody has to be first, and there is nobody to authorize that grant. An
endpoint that could create the first admin without an existing admin is an
endpoint anyone who finds it can call.

## Why the grant power stays on the env var

If every admin could create admins, one compromised staff account would be
self-replicating and effectively permanent: revoking the original would not
revoke what it had already created, and there would be no tier left that the
attacker could not reach.

Keeping the grant power on the secret means the recovery path lives somewhere
a web session cannot touch. Recovering from a compromise requires access to
Cloudflare, not just a cookie.

## Rejected: calling the Cloudflare API from the site

Proposed, and declined on purpose. Record of the decision so it is not
re-litigated:

A token that can rewrite `ADMIN_EMAILS` can rewrite every other secret in the
same Worker — `BETTER_AUTH_SECRET`, `POSTGRES_URL`, the payment keys.
Cloudflare's scoping does not go finer than "edit this Worker", which is
equivalent to deploying arbitrary code. Holding that token on the site would
turn any XSS or auth bug on pana.social into full infrastructure takeover.

It is also self-defeating. The env tier is a usable recovery path *because* a
web session cannot reach it. Give the website that reach and there are no
longer two tiers — just one tier with extra moving parts and a very powerful
credential sitting inside the blast radius it was supposed to be outside of.

If the real need is "somebody other than the founder should be able to promote
people," the answer is a DB-backed super admin tier that super admins can
grant, keeping `ADMIN_EMAILS` purely as break-glass. That keeps the recovery
property and needs no Cloudflare credential on the site.

## Escalation paths that are closed

- **Claiming an unclaimed profile** adopts that row's `roles`. Harmless while
  the column held only scoped moderator flags; now that `roles.admin` grants
  the admin surface, an unclaimed row carrying it would hand admin to whoever
  proves control of the matching email address — a much weaker bar than the
  founder gate. Both claim paths (`auth.ts`, `lib/server/profile.ts`) strip it.
  No row can carry it today, since the only writer is the gated route, but
  seeded, imported and migrated data reach that column without passing it.
- **Deleting an account** clears `roles` (`lib/server/delete-account.ts`), so a
  grant cannot outlive the account. `profiles.userId` is also
  `onDelete: cascade`.
- **Profile edit endpoints** all write explicit column lists. None of them
  accept `roles` from a request body, and `crm/contact/copy-field` restricts
  itself to a two-field allow-list.

## Why `profiles.roles` and not a column

`users.role` was dropped in `drizzle/0021_drop_users_role.sql` as dead data, so
re-adding a column would reopen a settled decision. The JSONB needs no
migration, and `profiles.userId` is `UNIQUE`, so the identity profile is
strictly 1:1 with the account — there is no ambiguity about whose roles count.
Directory listings created through `/form/get-listed` leave `userId` NULL and
are administered through `profileOwners`, which is what lets one person run
several listings without any of them being their identity.
