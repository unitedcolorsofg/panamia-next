'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreflightData {
  canDelete: boolean;
  blockers: string[];
  summary: {
    articles: { total: number; archived: number; preArchive: number };
    socialPosts: { total: number };
    events: {
      hosted: number;
      organized: number;
      attended: number;
      archived: number;
    };
    eventPhotos: { total: number; archived: number };
    mentorSessions: { completed: number; pending: number };
    mediaFiles: number;
    thirdParty: {
      stripe: boolean;
      ghl: boolean;
      google: boolean;
      apple: boolean;
    };
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeleteAccountForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activePage, setActivePage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preflight data
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // Form state
  const [attributionChoice, setAttributionChoice] = useState<
    'keep' | 'anonymize'
  >('keep');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmUnderstand, setConfirmUnderstand] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Page refs
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);
  const page4Ref = useRef<HTMLDivElement>(null);
  const page5Ref = useRef<HTMLDivElement>(null);
  const page6Ref = useRef<HTMLDivElement>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/form/delete-account');
    }
  }, [status, router]);

  // Load preflight data
  useEffect(() => {
    if (status !== 'authenticated') return;
    setPreflightLoading(true);
    axios
      .get('/api/account/delete-preflight')
      .then((res) => {
        setPreflight(res.data);
        setPreflightError(null);
      })
      .catch((err) => {
        setPreflightError(
          err.response?.data?.error ?? 'Failed to load account data'
        );
      })
      .finally(() => setPreflightLoading(false));
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (status !== 'authenticated' && activePage < 6) {
    return null;
  }

  const scrollToPage = (pageNum: number) => {
    const refs = [
      null,
      page1Ref,
      page2Ref,
      page3Ref,
      page4Ref,
      page5Ref,
      page6Ref,
    ];
    refs[pageNum]?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const hasArchivedContent =
    preflight &&
    (preflight.summary.articles.archived > 0 ||
      preflight.summary.events.archived > 0 ||
      preflight.summary.eventPhotos.archived > 0);

  // Total pages: skip page 2 (attribution) if no archived content
  const totalPages = hasArchivedContent ? 5 : 4;
  const effectivePage =
    !hasArchivedContent && activePage >= 2 ? activePage - 1 : activePage;
  const progress =
    activePage <= 5 ? Math.trunc((effectivePage / totalPages) * 100) : 100;

  const goNext = () => {
    let next = activePage + 1;
    // Skip attribution page if no archived content
    if (next === 2 && !hasArchivedContent) next = 3;
    setActivePage(next);
    scrollToPage(next);
  };

  const goPrev = () => {
    let prev = activePage - 1;
    // Skip attribution page if no archived content
    if (prev === 2 && !hasArchivedContent) prev = 1;
    setActivePage(prev);
    scrollToPage(prev);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setDeleteError(null);
    try {
      const res = await axios.post('/api/account/delete', {
        attributionChoice: hasArchivedContent ? attributionChoice : 'anonymize',
        confirmEmail,
      });
      if (res.data.success) {
        // TODO(GHL): Trigger GoHighLevel flow email "Account Deleted"
        await signOut({ redirect: false });
        setActivePage(6);
        scrollToPage(6);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setDeleteError(
          err.response?.data?.error ?? 'Deletion failed. Please try again.'
        );
      } else {
        setDeleteError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const thirdPartyServices: string[] = [];
  if (preflight) {
    const tp = preflight.summary.thirdParty;
    if (tp.stripe) thirdPartyServices.push('Stripe (payment/subscriptions)');
    if (tp.ghl) thirdPartyServices.push('GoHighLevel (CRM)');
    if (tp.google) thirdPartyServices.push('Google (OAuth connection)');
    if (tp.apple) thirdPartyServices.push('Apple (OAuth connection)');
  }

  return (
    <div className="flex min-h-screen flex-col py-8 md:py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <Image
              src="/logos/pana_logo_long_blue.png"
              alt="Pana MIA"
              width={400}
              height={100}
              className="h-auto max-w-full"
              priority
            />
          </div>

          <h1 className="text-center text-3xl font-bold md:text-4xl">
            Delete Your Account
          </h1>

          <Card>
            <CardContent className="p-6 md:p-8">
              {/* Progress Bar */}
              {activePage <= 5 && (
                <div className="mb-8">
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Page 1 — Warning + Data Summary */}
              {activePage === 1 && (
                <div ref={page1Ref} className="space-y-6">
                  <h2 className="text-2xl font-bold text-red-600">
                    This is permanent.
                  </h2>

                  <p className="text-lg">
                    Deleting your account will permanently remove your profile,
                    posts, and personal data. This action cannot be undone.
                  </p>

                  {/* Wellness note */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    If you&rsquo;re going through a difficult time, you&rsquo;re
                    not alone. The{' '}
                    <strong>988 Suicide &amp; Crisis Lifeline</strong> is
                    available 24/7 &mdash; call or text <strong>988</strong>.
                  </div>

                  {/* Preflight loading / error */}
                  {preflightLoading && (
                    <p className="text-muted-foreground">
                      Loading your account data...
                    </p>
                  )}
                  {preflightError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                      {preflightError}
                    </div>
                  )}

                  {/* Blockers */}
                  {preflight && !preflight.canDelete && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-red-600">
                        You cannot delete your account yet:
                      </h3>
                      {preflight.blockers.map((b, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700"
                        >
                          {b}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Data summary */}
                  {preflight && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Your account data:</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {preflight.summary.articles.total > 0 && (
                          <div className="rounded border p-3">
                            <div className="font-medium">Articles</div>
                            <div className="text-muted-foreground">
                              {preflight.summary.articles.total} total
                              {preflight.summary.articles.archived > 0 &&
                                ` (${preflight.summary.articles.archived} archived)`}
                            </div>
                          </div>
                        )}
                        {preflight.summary.socialPosts.total > 0 && (
                          <div className="rounded border p-3">
                            <div className="font-medium">Social Posts</div>
                            <div className="text-muted-foreground">
                              {preflight.summary.socialPosts.total} (all will be
                              deleted)
                            </div>
                          </div>
                        )}
                        {preflight.summary.events.hosted > 0 && (
                          <div className="rounded border p-3">
                            <div className="font-medium">Events Hosted</div>
                            <div className="text-muted-foreground">
                              {preflight.summary.events.hosted} total
                              {preflight.summary.events.archived > 0 &&
                                ` (${preflight.summary.events.archived} archived)`}
                            </div>
                          </div>
                        )}
                        {preflight.summary.eventPhotos.total > 0 && (
                          <div className="rounded border p-3">
                            <div className="font-medium">Event Photos</div>
                            <div className="text-muted-foreground">
                              {preflight.summary.eventPhotos.total} total
                            </div>
                          </div>
                        )}
                        {(preflight.summary.mentorSessions.completed > 0 ||
                          preflight.summary.mentorSessions.pending > 0) && (
                          <div className="rounded border p-3">
                            <div className="font-medium">Mentor Sessions</div>
                            <div className="text-muted-foreground">
                              {preflight.summary.mentorSessions.completed +
                                preflight.summary.mentorSessions.pending}{' '}
                              total
                            </div>
                          </div>
                        )}
                        {preflight.summary.mediaFiles > 0 && (
                          <div className="rounded border p-3">
                            <div className="font-medium">Media Files</div>
                            <div className="text-muted-foreground">
                              {preflight.summary.mediaFiles} file(s)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/settings')}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={goNext}
                      disabled={
                        preflightLoading ||
                        !!preflightError ||
                        (preflight != null && !preflight.canDelete)
                      }
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Page 2 — Attribution Choice */}
              {activePage === 2 && (
                <div ref={page2Ref} className="space-y-6">
                  <h2 className="text-2xl font-bold">Your Archived Content</h2>

                  <p>
                    Some of your content has been part of the community record
                    for over 3 months and is preserved under its Creative
                    Commons license. You can choose how your name appears on
                    this content:
                  </p>

                  <RadioGroup
                    value={attributionChoice}
                    onValueChange={(v) =>
                      setAttributionChoice(v as 'keep' | 'anonymize')
                    }
                    className="space-y-4"
                  >
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="keep" id="keep" className="mt-1" />
                      <div>
                        <Label htmlFor="keep" className="text-base font-medium">
                          Keep my name
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Your name stays on archived articles and events. Your
                          profile is cleared of personal data but kept as a
                          minimal attribution record.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem
                        value="anonymize"
                        id="anonymize"
                        className="mt-1"
                      />
                      <div>
                        <Label
                          htmlFor="anonymize"
                          className="text-base font-medium"
                        >
                          Anonymize (Former Member)
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          Your name is removed from all archived content. It
                          will show as authored by &ldquo;Former Member&rdquo;.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>

                  <div className="flex justify-between pt-6">
                    <Button variant="outline" onClick={goPrev}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={goNext}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Page 3 — Third-Party Services */}
              {activePage === 3 && (
                <div ref={page3Ref} className="space-y-6">
                  <h2 className="text-2xl font-bold">Third-Party Services</h2>

                  <p>
                    The following connected services will be cleaned up as part
                    of your account deletion:
                  </p>

                  {thirdPartyServices.length > 0 ? (
                    <ul className="list-inside list-disc space-y-2 text-sm">
                      {thirdPartyServices.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No third-party services are connected to your account.
                    </p>
                  )}

                  <p className="text-muted-foreground text-sm">
                    Active subscriptions will be cancelled. OAuth connections
                    will be revoked. Marketing contacts will be removed.
                  </p>

                  <div className="flex justify-between pt-6">
                    <Button variant="outline" onClick={goPrev}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={goNext}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Page 4 — Confirm Email */}
              {activePage === 4 && (
                <div ref={page4Ref} className="space-y-6">
                  <h2 className="text-2xl font-bold">Confirm Your Email</h2>

                  <p>
                    To proceed, please type your email address to confirm you
                    want to delete this account.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-email">
                      Email: <strong>{session?.user?.email}</strong>
                    </Label>
                    <Input
                      id="confirm-email"
                      type="email"
                      placeholder="Type your email address"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex justify-between pt-6">
                    <Button variant="outline" onClick={goPrev}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={goNext}
                      disabled={
                        confirmEmail.toLowerCase() !==
                        (session?.user?.email ?? '').toLowerCase()
                      }
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Page 5 — Final Confirmation */}
              {activePage === 5 && (
                <div ref={page5Ref} className="space-y-6">
                  <h2 className="text-2xl font-bold text-red-600">
                    Final Step
                  </h2>

                  <p>
                    You are about to permanently delete your account. All your
                    data will be removed and this cannot be reversed.
                  </p>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="confirm-understand"
                      checked={confirmUnderstand}
                      onCheckedChange={(checked) =>
                        setConfirmUnderstand(checked as boolean)
                      }
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="confirm-understand">
                      I understand this is permanent and cannot be undone.
                    </Label>
                  </div>

                  {deleteError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                      {deleteError}
                    </div>
                  )}

                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      onClick={goPrev}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={!confirmUnderstand || isSubmitting}
                      className="min-w-[180px]"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                          Deleting...
                        </span>
                      ) : (
                        'Delete My Account'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Page 6 — Done */}
              {activePage === 6 && (
                <div ref={page6Ref} className="space-y-6 text-center">
                  <h2 className="text-2xl font-bold">
                    Your account has been deleted.
                  </h2>

                  <p className="text-muted-foreground">
                    All your personal data has been removed. Thank you for being
                    part of the Pana MIA community.
                  </p>

                  <div className="pt-4">
                    <Link href="/">
                      <Button variant="outline">Go to Homepage</Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {activePage <= 5 && activePage !== 6 && (
            <p className="text-muted-foreground text-center text-sm">
              Changed your mind?{' '}
              <Link href="/settings" className="text-pana-blue underline">
                Return to Settings
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
