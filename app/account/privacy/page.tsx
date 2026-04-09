'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, FileText, Eye, Trash2, Loader2 } from 'lucide-react';

// =============================================================================
// Privacy Settings Page — Phase 3 consent infrastructure
//
// Lets users:
//   - View their active consent receipts (document + module + version + date)
//   - See whether GPC was detected at time of consent
//   - Withdraw module-level consent (hard-deletes the receipt)
//   - Link to full terms and privacy policy
//   - Future: exercise data rights (access, deletion, portability)
//
// Top-level terms consent cannot be withdrawn here — withdrawing requires
// account deletion (see Phase 5).
// =============================================================================

interface ConsentReceipt {
  id: string;
  document: string;
  module: string | null;
  version: string;
  majorVersion: number;
  gpcDetected: boolean;
  createdAt: string;
}

const MODULE_LABELS: Record<string, string> = {
  profiles: 'Profiles',
  articles: 'Articles',
  social: 'Social Timeline',
  mentoring: 'Mentoring',
  events: 'Events',
  uploads: 'Uploads',
  payments: 'Payments',
  community: 'Community',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PrivacySettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [receipts, setReceipts] = useState<ConsentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/signin?callbackUrl=/account/privacy');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchReceipts = async () => {
      try {
        const res = await fetch('/api/consent/list');
        if (res.ok) {
          const data = await res.json();
          setReceipts(data.receipts);
        }
      } catch {
        // Fail silently — page still renders without receipts
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, [status]);

  const handleWithdraw = async (receipt: ConsentReceipt) => {
    // Top-level terms consent cannot be withdrawn — must delete account
    if (!receipt.module) return;

    setWithdrawing(receipt.id);
    try {
      await fetch(`/api/consent/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId: receipt.id }),
      });
      setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
    } catch {
      // Fail silently
    } finally {
      setWithdrawing(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (status !== 'authenticated') return null;

  const topLevelReceipts = receipts.filter((r) => !r.module);
  const moduleReceipts = receipts.filter((r) => r.module);
  const anyGpcDetected = receipts.some((r) => r.gpcDetected);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Privacy Settings</h1>

      {/* GPC status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Global Privacy Control (GPC)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {anyGpcDetected ? (
            <p className="text-sm">
              Your browser sent a <strong>Global Privacy Control</strong> signal
              when you last consented. We recorded this preference. Panamia does
              not sell or share your personal data with third parties for
              advertising.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              No GPC signal was detected from your browser. If you enable GPC in
              your browser settings, it will be recorded with your next consent.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top-level terms consent */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Terms of Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topLevelReceipts.length > 0 ? (
            <div className="space-y-2">
              {topLevelReceipts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    Accepted {r.document} v{r.version} on{' '}
                    {formatDate(r.createdAt)}
                  </span>
                </div>
              ))}
              <p className="text-muted-foreground text-xs">
                To withdraw consent to the core terms, you must{' '}
                <Link href="/account/user/edit" className="underline">
                  delete your account
                </Link>
                .
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No top-level consent recorded yet. Consent is captured when you
              complete directory enrollment.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Module consents */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5" />
            Feature Consents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {moduleReceipts.length > 0 ? (
            <div className="space-y-3">
              {moduleReceipts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {r.module
                        ? MODULE_LABELS[r.module] || r.module
                        : r.document}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      v{r.version} — {formatDate(r.createdAt)}
                      {r.gpcDetected && ' — GPC detected'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleWithdraw(r)}
                    disabled={withdrawing === r.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {withdrawing === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="ml-1">Withdraw</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No feature consents recorded yet. These are captured as you use
              platform features for the first time.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data rights — future enhancement */}
      {/* Phase 5: Add data export, deletion request, and portability buttons
          here. These should link to the account deletion flow when built. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Data Rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">
            You have the right to access, correct, delete, and port your data.
            See our{' '}
            <Link href="/legal/privacy" className="underline">
              Privacy Policy
            </Link>{' '}
            for details.
          </p>
          <p className="text-muted-foreground text-sm">
            To exercise these rights, contact{' '}
            <a href="mailto:hola@panamia.club" className="underline">
              hola@panamia.club
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
