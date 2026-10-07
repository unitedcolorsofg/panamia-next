'use client';

import { useAdminGate } from '@/components/Admin/gate';
import { useSession } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ShieldCheck, User } from 'lucide-react';
import PageMeta from '@/components/PageMeta';
import { UserInterface, Pagination } from '@/lib/interfaces';
import { standardizeDateTime } from '@/lib/standardized';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The live user list, and the one screen that grants admin.
 *
 * This is the original `/admin/users` page, moved here rather than deleted
 * when that path became the mock. It is the only screen in the product that
 * reads real `users` rows, so removing it to make room for a design would have
 * taken away a working tool to show a picture of a better one.
 *
 * It is off the sidebar. `/admin/users` links down to it.
 *
 * Three bugs were fixed across the move, all pre-existing:
 *
 * - `new URLSearchParams().append(...)` returns `undefined`, not the params
 *   object, so this requested `?undefined` and the page number was never sent.
 * - The caller sent `page` while /api/getUserList read `page_number`, so even
 *   after the above was fixed every page still showed the first twenty rows.
 *   The route now reads either spelling; this sends the canonical one.
 * - The avatar icon was `text-white` on a white card.
 */

/** A row as /api/getUserList returns it — the base record plus the admin tiers. */
type AdminUserRow = UserInterface & {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  grantedAdmin?: boolean;
  hasProfile?: boolean;
};

export default function AdminUsersLivePage() {
  const { gate } = useAdminGate();
  const { data: session } = useSession();
  const canGrant = session?.user?.isSuperAdmin ?? false;

  const [page_number, setPageNumber] = useState(1);
  const [submissions_list, setSubmissionsList] = useState<AdminUserRow[]>([]);
  const [pagination, setPagination] = useState({} as Pagination);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string }>();

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.append('page_number', page_number.toString());
    axios
      .get(`/api/getUserList?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      .then((resp) => {
        setSubmissionsList(resp.data.data);
        setPagination(resp.data.pagination);
        return resp;
      })
      .catch((error) => {
        console.log(error);
        return [];
      });
  }, [page_number]);

  useEffect(() => {
    load();
  }, [load]);

  async function setAdmin(row: AdminUserRow, admin: boolean) {
    const who = row.name || row.screenname || row.email;
    const question = admin
      ? `Give ${who} admin access? They will be able to use every admin screen.`
      : `Remove admin access from ${who}?`;
    if (!window.confirm(question)) return;

    setBusyId(row._id);
    setRowError(undefined);
    try {
      await axios.post('/api/admin/users/admin-role', {
        userId: row._id,
        admin,
      });
      // Re-read rather than patching state locally: the server is the only
      // thing that knows whether the write actually landed, and a local flip
      // would show success even if the row had changed underneath.
      load();
    } catch (error) {
      const message =
        (axios.isAxiosError(error) && error.response?.data?.error) ||
        'Could not change admin access.';
      setRowError({ id: row._id, message });
    } finally {
      setBusyId(null);
    }
  }

  function adminControl(item: AdminUserRow) {
    if (!canGrant) return null;

    // Both disabled cases are rendered rather than hidden. A missing button is
    // indistinguishable from a bug, and the reason is the useful part.
    if (item.isSuperAdmin) {
      return (
        <p className="text-xs text-pana-ink/70">
          Managed in <code>ADMIN_EMAILS</code> — not changeable here.
        </p>
      );
    }
    if (!item.hasProfile) {
      return (
        <p className="text-xs text-pana-ink/70">
          No profile yet, so there is nowhere to record a grant.
        </p>
      );
    }
    return (
      <Button
        variant={item.grantedAdmin ? 'outline' : 'default'}
        onClick={() => setAdmin(item, !item.grantedAdmin)}
        disabled={busyId === item._id}
      >
        {busyId === item._id
          ? 'Saving…'
          : item.grantedAdmin
            ? 'Remove admin'
            : 'Make admin'}
      </Button>
    );
  }

  function createListElements() {
    return submissions_list.map((item: AdminUserRow, index) => (
      <Card key={index}>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <User className="h-5 w-5 text-pana-ink/60" />
              </div>
              <div className="text-sm">
                Created: {standardizeDateTime(item?.createdAt)}
              </div>
              <div className="text-sm">
                Updated: {standardizeDateTime(item?.updatedAt)}
              </div>
              {item.isAdmin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pana-indigo px-2.5 py-1 text-xs font-bold text-white">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {item.isSuperAdmin ? 'Admin · founder' : 'Admin'}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <div>
                <span className="font-semibold">Name:</span> {item?.name}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {item?.email}
              </div>
            </div>
            {adminControl(item) ? (
              <div className="border-t border-pana-ink/10 pt-3">
                {adminControl(item)}
                {rowError?.id === item._id ? (
                  <p className="mt-2 text-xs font-semibold text-pana-red">
                    {rowError.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    ));
  }

  if (gate) return gate;

  return (
    <>
      <PageMeta title="Users — live list | Admin" desc="" />
      <div>
        <h2 className="mb-2 text-3xl font-bold">Users — live list</h2>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-pana-ink/70">
          Real rows from the database. This is the list as it exists today;{' '}
          <Link
            href="/admin/users"
            className="font-bold underline underline-offset-4"
          >
            the proposed screen
          </Link>{' '}
          is the mock.
        </p>
        <div className="mb-6 max-w-2xl rounded-xl border border-pana-ink/10 bg-pana-butter/30 p-4 text-sm leading-relaxed text-pana-ink/80">
          {canGrant ? (
            <>
              <strong className="font-bold">You can grant admin.</strong> A
              grant takes effect on their next page load — no sign-out needed.
              Accounts listed in <code>ADMIN_EMAILS</code> are marked{' '}
              <em>founder</em> and can only be changed by editing that secret.
            </>
          ) : (
            <>
              <strong className="font-bold">Read-only.</strong> Granting admin
              is limited to accounts in <code>ADMIN_EMAILS</code>, so that a
              compromised admin account cannot create more admins.
            </>
          )}
        </div>
        <div className="space-y-6">
          <div className="space-y-4">{createListElements()}</div>
          <div className="flex items-center gap-4">
            <small>Page: {pagination?.page_number}</small>
            <Button
              onClick={() => setPageNumber(page_number - 1)}
              disabled={pagination?.page_number == 1}
            >
              Previous
            </Button>
            <Button
              onClick={() => setPageNumber(page_number + 1)}
              disabled={pagination?.page_number == pagination.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
