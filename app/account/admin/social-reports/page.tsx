'use client';

/**
 * Admin queue for in-app abuse reports — the member-facing counterpart to
 * /account/admin/reports, which covers NIP-56 reports arriving from the relay.
 *
 * Two queues rather than one because the moderation lever differs: a relay
 * report is resolved by deleting an event from Nostr, an in-app report by
 * acting on our own rows (hiding a post, warning or suspending an account).
 * Merging them would mean every row grew a "which kind am I" branch.
 *
 * Nothing here destroys content, so unlike the relay queue every status is
 * revocable and there is no confirm dialog.
 */

import { useSession } from '@/lib/auth-client';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import PageMeta from '@/components/PageMeta';
import { standardizeDateTime } from '@/lib/standardized';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AdminMenu from '@/components/Admin/AdminHeader';
import { toast } from '@/hooks/use-toast';
import {
  SOCIAL_REPORT_REASON_LABELS,
  type SocialReportReason,
} from '@/lib/social-report-reasons';

interface SocialReport {
  id: string;
  createdAt: string;
  reporterHandle: string | null;
  targetHandle: string | null;
  targetStatusId: string | null;
  reason: SocialReportReason;
  details: string;
  reportedContent: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  moderationReason: string | null;
  lastModerationActionAt: string | null;
}

interface Pagination {
  page_number: number;
  total_pages: number;
}

const statusBadge: Record<SocialReport['status'], string> = {
  open: 'bg-yellow-100 text-yellow-800',
  actioned: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-500',
};

// Reasons that carry a legal or safety obligation beyond ordinary moderation,
// so they are visually impossible to skim past in a long queue. `csam` is a
// mandatory NCMEC report; `self_harm` may be somebody in danger right now.
const URGENT_REASONS = new Set<SocialReportReason>(['csam', 'self_harm']);

function Handle({ handle }: { handle: string | null }) {
  if (!handle) {
    // Denormalised handles go NULL only if they were never captured; a deleted
    // account keeps its handle on the row precisely so this stays readable.
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <a
      href={`/p/${handle}`}
      target="_blank"
      rel="noreferrer"
      className="font-medium underline underline-offset-2"
    >
      @{handle}
    </a>
  );
}

export default function AdminSocialReportsPage() {
  const { data: session } = useSession();
  const [page_number, setPageNumber] = useState(1);
  const [reports, setReports] = useState<SocialReport[]>([]);
  const [pagination, setPagination] = useState({} as Pagination);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Per-report moderation note drafts. Optional here — unlike the relay queue,
  // no action is destructive, so nothing is gated behind writing one.
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoadError(false);
    axios
      .get(`/api/admin/socialReports?page_number=${page_number}`, {
        headers: { Accept: 'application/json' },
      })
      .then((resp) => {
        setReports(resp.data.data);
        setPagination(resp.data.pagination);
        setLoaded(true);
      })
      .catch((error) => {
        if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') return;
        console.log(error);
        setLoadError(true);
        setLoaded(true);
        toast({
          title: 'Could not load reports',
          description: 'The request failed. Use Retry to try again.',
          variant: 'destructive',
        });
      });
  }, [page_number]);

  // Wait for the auth session before the first fetch so the request carries the
  // admin cookie — firing pre-session would 401 and wedge the page.
  useEffect(() => {
    if (!session?.user) return;
    load();
  }, [load, session?.user]);

  function updateStatus(id: string, status: SocialReport['status']) {
    axios
      .patch(
        '/api/admin/socialReports',
        { id, status, reason: reasons[id] ?? '' },
        { headers: { 'Content-Type': 'application/json' } }
      )
      .then(() => load())
      .catch((error) => {
        console.log(error);
        toast({
          title: 'Update failed',
          description: 'The report status could not be changed. Try again.',
          variant: 'destructive',
        });
      });
  }

  function reportCards() {
    return reports.map((item) => {
      const urgent = URGENT_REASONS.has(item.reason);
      return (
        <Card key={item.id}>
          <CardContent className="p-5">
            <div className="space-y-4">
              {/* Header: status pill + reason + when */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${statusBadge[item.status]}`}
                >
                  {item.status}
                </span>
                <span
                  className={`text-base font-semibold ${urgent ? 'text-red-700' : ''}`}
                >
                  {SOCIAL_REPORT_REASON_LABELS[item.reason] ?? item.reason}
                </span>
                {item.targetStatusId ? (
                  <span className="text-muted-foreground text-xs">· post</span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    · account
                  </span>
                )}
                <span className="text-muted-foreground ml-auto text-xs">
                  Reported {standardizeDateTime(new Date(item.createdAt))}
                </span>
              </div>

              {urgent && item.reason === 'csam' && (
                <div className="rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-2 text-sm text-red-800">
                  <span className="font-semibold">
                    Mandatory reporting applies.
                  </span>{' '}
                  Suspected sexual content involving a minor must be reported to
                  NCMEC&rsquo;s CyberTipline. Preserve the content and account
                  data; do not delete before reporting.
                </div>
              )}
              {urgent && item.reason === 'self_harm' && (
                <div className="rounded-md border-l-4 border-orange-500 bg-orange-50 px-4 py-2 text-sm text-orange-900">
                  <span className="font-semibold">Handle first.</span> Somebody
                  may be in immediate danger.
                </div>
              )}

              {/* Who reported whom */}
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-semibold">Reporter:</span>{' '}
                  <Handle handle={item.reporterHandle} />
                </div>
                <div>
                  <span className="font-semibold">Target:</span>{' '}
                  <Handle handle={item.targetHandle} />
                </div>
                {item.targetStatusId && (
                  <div className="sm:col-span-2">
                    <span className="font-semibold">Reported post:</span>{' '}
                    {item.targetHandle ? (
                      <a
                        href={`/p/${item.targetHandle}/${item.targetStatusId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        open post
                      </a>
                    ) : (
                      <code className="text-muted-foreground text-xs break-all">
                        {item.targetStatusId}
                      </code>
                    )}
                  </div>
                )}
              </div>

              {/* The reporter's own words */}
              {item.details && (
                <div className="text-sm">
                  <span className="font-semibold">
                    Reporter&rsquo;s context:
                  </span>{' '}
                  {item.details}
                </div>
              )}

              {/* Snapshot taken at report time. Kept even if the post is later
                  edited or deleted, which is the whole point of storing it. */}
              {item.reportedContent && (
                <div className="text-sm">
                  <div className="mb-1 font-semibold">
                    Reported content{' '}
                    <span className="text-muted-foreground font-normal">
                      (snapshot at report time)
                    </span>
                    :
                  </div>
                  <blockquote className="bg-muted/50 text-muted-foreground rounded-md border-l-4 border-pink-400 px-4 py-2 whitespace-pre-wrap">
                    {item.reportedContent}
                  </blockquote>
                </div>
              )}

              {item.moderationReason && (
                <div className="text-muted-foreground text-sm">
                  <span className="font-semibold">Moderator note:</span>{' '}
                  {item.moderationReason}
                  {item.lastModerationActionAt && (
                    <span className="ml-1 text-xs">
                      (
                      {standardizeDateTime(
                        new Date(item.lastModerationActionAt)
                      )}
                      )
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={reasons[item.id] ?? ''}
                    onChange={(e) =>
                      setReasons((r) => ({ ...r, [item.id]: e.target.value }))
                    }
                    placeholder="Moderator note (optional)"
                    className="border-input bg-background min-w-[16rem] flex-1 rounded-md border px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={item.status === 'actioned'}
                    onClick={() => updateStatus(item.id, 'actioned')}
                  >
                    Mark actioned
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={item.status === 'dismissed'}
                    onClick={() => updateStatus(item.id, 'dismissed')}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={item.status === 'open'}
                    onClick={() => updateStatus(item.id, 'open')}
                  >
                    Reopen
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });
  }

  if (!session) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <PageMeta title="Unauthorized" desc="" />
        <div>
          <h2 className="mb-6 text-3xl font-bold">UNAUTHORIZED</h2>
          <h3 className="text-xl">You must be logged in to view this page.</h3>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <PageMeta title="In-App Reports | Admin" desc="" />
      <AdminMenu />
      <div>
        <h2 className="mb-6 text-3xl font-bold">In-App Reports</h2>
        <div className="space-y-6">
          <div className="space-y-4">
            {!loaded ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : loadError ? (
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground">
                  Couldn&rsquo;t load reports.
                </p>
                <Button size="sm" variant="outline" onClick={() => load()}>
                  Retry
                </Button>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-muted-foreground">No reports.</p>
            ) : (
              reportCards()
            )}
          </div>
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
              disabled={pagination?.page_number == pagination?.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
