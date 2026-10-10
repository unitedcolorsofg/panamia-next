'use client';

/**
 * The report dialog, opened from the overflow menu on a post or a profile.
 *
 * This is the "mechanism for users to flag objectionable content" that App
 * Store Review Guideline 1.2 requires of any app with user-generated content.
 * Block and mute already existed; flagging did not, and relay_reports only
 * ever covered Nostr events arriving from outside clients.
 *
 * Two things shape the design, both of them about the person reporting:
 *
 * 1. They are usually upset. So the reason list is plain language, the details
 *    box is optional, and submitting twice is a success rather than a scolding
 *    error — see the route.
 * 2. Reporting and blocking are different wishes. Reporting asks us to look;
 *    blocking makes it go away now. Most people want both, but doing the
 *    second one implicitly would be a surprise, so the confirmation step
 *    offers it instead.
 *
 * Hardcoded English, like BlockMenu and the rest of the safety surface.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useBlockActor, useReportContent } from '@/lib/query/social';
import {
  SOCIAL_REPORT_REASONS,
  SOCIAL_REPORT_REASON_HINTS,
  SOCIAL_REPORT_REASON_LABELS,
  type SocialReportReason,
} from '@/lib/social-report-reasons';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';

const DETAILS_MAX = 2000;

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Handle of the account being reported, or the author of the post. */
  username: string;
  displayName?: string | null;
  /** Present when reporting a single post rather than the whole account. */
  statusId?: string;
  /** Hidden when the viewer has already blocked them. */
  canBlock?: boolean;
}

export function ReportDialog({
  open,
  onOpenChange,
  username,
  displayName,
  statusId,
  canBlock = true,
}: ReportDialogProps) {
  const [reason, setReason] = useState<SocialReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const reportContent = useReportContent();
  const blockActor = useBlockActor();

  const who = displayName || `@${username}`;
  const subject = statusId ? 'post' : 'account';

  // Reset on close rather than on open, so the fields do not visibly clear
  // while the dialog is still animating away.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setReason(null);
      setDetails('');
      setSubmitted(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleSubmit = async () => {
    if (!reason) return;
    try {
      await reportContent.mutateAsync({
        ...(statusId ? { statusId } : { username }),
        reason,
        details: details.trim() || undefined,
      });
      setSubmitted(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';
      toast({
        title: 'Could not send that report',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleBlock = async () => {
    try {
      await blockActor.mutateAsync({ username, kind: 'block' });
      toast({
        title: `Blocked ${who}`,
        description:
          'They can no longer follow you or see your posts, and you will not see theirs.',
      });
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';
      toast({
        title: 'Something went wrong',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Thanks for telling us
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 pt-1 text-sm">
                  <p>
                    Our team will review this {subject}. We do not tell {who}{' '}
                    who reported them.
                  </p>
                  {canBlock && (
                    <p>
                      Reporting does not hide anything on its own. If you would
                      rather not see {who} at all, you can block them now.
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              {canBlock && (
                <Button
                  variant="outline"
                  onClick={handleBlock}
                  disabled={blockActor.isPending}
                >
                  {blockActor.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Block {who}
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report {statusId ? 'this post' : who}</DialogTitle>
              <DialogDescription>
                What is going on? This goes to our moderators, not to {who}.
              </DialogDescription>
            </DialogHeader>

            <RadioGroup
              value={reason ?? undefined}
              onValueChange={(value) => setReason(value as SocialReportReason)}
              className="gap-1"
            >
              {SOCIAL_REPORT_REASONS.map((value) => (
                <Label
                  key={value}
                  htmlFor={`report-reason-${value}`}
                  className="hover:bg-muted/60 has-[:checked]:bg-muted flex cursor-pointer items-start gap-3 rounded-md p-2 font-normal"
                >
                  <RadioGroupItem
                    value={value}
                    id={`report-reason-${value}`}
                    className="mt-1"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      {SOCIAL_REPORT_REASON_LABELS[value]}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {SOCIAL_REPORT_REASON_HINTS[value]}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            <div className="space-y-1.5">
              <Label htmlFor="report-details" className="text-sm">
                Anything else?{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="report-details"
                value={details}
                maxLength={DETAILS_MAX}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Context helps us act faster, but it is not required."
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={reportContent.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!reason || reportContent.isPending}
              >
                {reportContent.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit report
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
