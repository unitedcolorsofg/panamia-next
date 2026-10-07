import Link from 'next/link';

import { AdminEyebrow } from '@/components/Admin/eyebrow';
import { AdminMockBar } from '@/components/Admin/mock-bar';
import {
  MockButton,
  MockInput,
  MockSelect,
  MockTag,
} from '@/components/mock-controls';
import { Panel, StatBand } from '@/components/Admin/parts';
import { ADMIN_CHROME } from '@/lib/admin/theme';
import {
  ACCOUNTS,
  ACCOUNT_TYPE_LABEL,
  ADMIN_HOLDERS,
  USER_FLAG_LABEL,
  USER_FLAG_NOTE,
  type AccountUser,
  attentionOrder,
  joinedLabel,
  userStats,
} from '@/lib/admin/fixtures-users';

/**
 * Accounts.
 *
 * ## What this replaces
 *
 * A page that listed name, email and two timestamps, sixteen at a time, with
 * Previous and Next. It is still there — `/admin/users/live` — because it is
 * the only screen that reads real user rows and deleting a working tool to
 * make room for a drawing of a better one is a bad trade.
 *
 * What it could not do is the point. There is no search, so finding one person
 * means paging until you see them. There is no account type, so you cannot
 * tell a business from a member. There is no link to anything, so having found
 * someone you still cannot reach their profile. And there is no action of any
 * kind, so the answer to "this person is abusing the relay" is to go and write
 * some SQL.
 *
 * ## The three findings this screen is really making
 *
 * Shaped by what is actually true in the schema rather than invented:
 *
 * 1. **`users.locked_at` exists and nothing sets it.** The column has been
 *    there since the initial schema. `getSessionUser` and `saveSessionUser`
 *    both read it out as `locked`. No code path anywhere writes it. So the
 *    product has a concept of a locked account, and no way to lock one.
 * 2. **Admin has two tiers.** `isAdmin` is the union of an environment
 *    variable and a column: `enrichUserFields()` compares the signed-in
 *    address against `ADMIN_EMAILS`, then ORs in `profiles.roles.admin`.
 *    Only the env tier can grant admin to anyone else, so a founder can mint
 *    admins and an admin cannot. The env tier can also name an address that
 *    has no account behind it, which is what makes it the recovery path.
 *    Granting is done on the live list, not here.
 * 3. **Locking someone takes their listings with them.** `administers` is the
 *    `profile_owners` join. Three of the rows below run a listing; one runs
 *    two. That has to be on screen *before* the button, not discovered after.
 *
 * ## Mock
 *
 * Every control is inert. Lock in particular is a write nobody has designed
 * yet — there is no unlock flow, no audit row, and no answer to what happens
 * to a locked owner's live listings — and shipping the button before those
 * exist would be shipping the question, not the answer.
 */

export const metadata = {
  title: 'Users | Pana Admin',
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  const rows = attentionOrder(ACCOUNTS);
  const needsAttention = rows.filter((row) => row.flags.length > 0).length;

  return (
    <>
      <AdminMockBar />

      <header className="pb-6">
        <AdminEyebrow>Community</AdminEyebrow>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
          Users
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-pana-ink/70">
          Every account on the site. Flagged ones first, because an account
          nobody has questioned does not need to be looked at.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <StatBand stats={userStats()} />

        <section
          className={`rounded-xl border-2 border-dashed ${ADMIN_CHROME.BORDER} bg-pana-cream p-5`}
        >
          <h2 className="text-sm font-extrabold uppercase tracking-wide">
            A column that exists and does nothing
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pana-ink/70">
            <code className="text-pana-ink/60">users.locked_at</code> has been
            in the schema since the first migration and is read back by two
            endpoints. Nothing in the product ever writes it, so there is a
            concept of a locked account and no way to lock one. Admin is a
            different shape: <code className="text-pana-ink/60">isAdmin</code>{' '}
            is the union of the{' '}
            <code className="text-pana-ink/60">ADMIN_EMAILS</code> environment
            variable and a <code className="text-pana-ink/60">roles.admin</code>{' '}
            flag on the profile, recomputed on every request. Both are shown
            below as what they are rather than quietly left off the screen.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-pana-ink/70">
            The list this replaces is still at{' '}
            <Link
              href="/admin/users/live"
              className="font-bold underline underline-offset-4"
            >
              /admin/users/live
            </Link>{' '}
            and reads real rows.
          </p>
        </section>

        <Panel
          title={`Accounts — ${needsAttention} of ${rows.length} flagged`}
          action={<MockTag />}
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MockInput label="Search" placeholder="Name, handle or email" />
              <MockSelect
                label="Account type"
                placeholder="All types"
                options={Object.values(ACCOUNT_TYPE_LABEL)}
              />
              <MockSelect
                label="State"
                placeholder="Any state"
                options={[
                  'Flagged only',
                  'Email unconfirmed',
                  'Locked',
                  'Runs a listing',
                  'Holds admin',
                ]}
              />
              <MockSelect
                label="Joined"
                placeholder="Any time"
                options={['Last 7 days', 'Last 30 days', 'This year']}
              />
            </div>
            <p className="text-xs leading-relaxed text-pana-ink/60">
              Search is the whole point of this screen. The list it replaces has
              none, so finding one person among twelve hundred means paging
              until they appear.
            </p>
          </div>

          <ul className="mt-5 flex flex-col gap-3">
            {rows.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ul>
        </Panel>

        <Panel title="Who holds admin">
          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-pana-ink/70">
            Two tiers. Founders come from{' '}
            <code className="text-pana-ink/60">ADMIN_EMAILS</code>, which is set
            on the deployment and not in the database — changing that list is an
            environment change, and it is the only tier that can grant admin to
            anyone else. Everyone else is granted on the{' '}
            <Link
              href="/admin/users/live"
              className="font-bold underline underline-offset-4"
            >
              live list
            </Link>
            , takes effect on their next page load, and can be revoked the same
            way. Splitting it this way means a compromised admin account cannot
            create more admins.
          </p>

          <ul
            className={`divide-y-2 ${ADMIN_CHROME.DIVIDE} border-t-2 ${ADMIN_CHROME.RULE}`}
          >
            {ADMIN_HOLDERS.map((holder) => (
              <li
                key={holder.email}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="min-w-[12rem] font-bold leading-snug">
                  {holder.name ?? (
                    <span className="font-normal italic text-pana-ink/60">
                      No matching account
                    </span>
                  )}
                </span>
                <code className="text-sm text-pana-ink/70">{holder.email}</code>
                {holder.note && (
                  <span className="flex-1 text-sm leading-relaxed text-pana-ink/60">
                    {holder.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

/**
 * One account.
 *
 * A row rather than a table cell grid, for the reason the listings queue uses
 * cards: the useful facts about an account are uneven. Most people have a
 * handle, an email and nothing else to say; a few run two listings, hold
 * admin, and have three flags. Columns sized for the second kind leave acres
 * of white space on the first.
 */
function AccountRow({ account }: { account: AccountUser }) {
  const locked = account.lockedAt !== null;

  return (
    <li
      className={`rounded-xl border-2 p-4 ${
        locked ? 'border-pana-red bg-pana-red/[0.04]' : 'border-pana-ink'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-lg font-extrabold leading-tight">
              {account.name}
            </h3>
            {account.screenname ? (
              <span className="text-sm text-pana-ink/60">
                @{account.screenname}
              </span>
            ) : (
              <span className="text-sm italic text-pana-ink/60">
                no handle yet
              </span>
            )}
            {account.isAdmin && (
              <span
                className={`rounded-full border-2 border-pana-ink px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider ${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL}`}
              >
                Admin
              </span>
            )}
            {account.connector && (
              <span className="rounded-full border-2 border-pana-indigo bg-pana-indigo px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-cream">
                Connector
              </span>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-pana-ink/70">
            <span>{account.email}</span>
            {!account.emailVerified && (
              <span className={`font-extrabold ${ADMIN_CHROME.ACCENT}`}>
                · unconfirmed
              </span>
            )}
          </p>

          {account.alternateEmails.length > 0 && (
            <p className="mt-0.5 text-xs text-pana-ink/60">
              Also {account.alternateEmails.join(', ')}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-sm font-extrabold text-pana-ink/70">
            {ACCOUNT_TYPE_LABEL[account.accountType]}
          </p>
          <p className="mt-0.5 text-xs text-pana-ink/60">
            Joined {joinedLabel(account.createdAt)}
          </p>
          {locked && (
            <p className="mt-0.5 text-xs font-extrabold uppercase tracking-wider text-pana-ink">
              Locked {joinedLabel(account.lockedAt as Date)}
            </p>
          )}
        </div>
      </div>

      {account.administers.length > 0 && (
        <p className="mt-2 text-sm leading-relaxed text-pana-ink/80">
          <span className="font-bold">Runs</span>{' '}
          {account.administers.join(' · ')}
          <span className="text-pana-ink/70">
            {' '}
            — locking this account takes{' '}
            {account.administers.length === 1
              ? 'that listing'
              : 'those listings'}{' '}
            down too.
          </span>
        </p>
      )}

      {account.flags.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t-2 border-dashed border-pana-ink/20 pt-2.5">
          {account.flags.map((flag) => (
            <li key={flag} className="flex flex-wrap gap-x-2 text-xs leading-relaxed">
              <span
                className={`font-extrabold uppercase tracking-wider ${ADMIN_CHROME.ACCENT}`}
              >
                {USER_FLAG_LABEL[flag]}
              </span>
              <span className="text-pana-ink/60">{USER_FLAG_NOTE[flag]}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <MockButton>Open profile</MockButton>
        {account.lastScreennameChange && (
          <MockButton>Clear handle cooldown</MockButton>
        )}
        {locked ? (
          <MockButton>Unlock</MockButton>
        ) : (
          <MockButton tone="danger">Lock account</MockButton>
        )}
      </div>
    </li>
  );
}
