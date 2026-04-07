'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// =============================================================================
// ConsentModal — Phase 3 consent infrastructure
//
// Two modes driven by policy.json consent.type:
//   - gate:   Blocks the action until the user accepts. No close button,
//             no dismiss. "I understand and agree to these policies."
//   - notice: Informational. User clicks "OK, got it!" to dismiss.
//             Does not block the action, but records a receipt.
//
// Usage:
//   <ConsentModal
//     open={!hasConsent}
//     type="gate"
//     module="articles"
//     title="Articles Terms"
//     description="Articles are published under a CC license..."
//     policyUrl="/legal/terms/modules/articles"
//     onConsent={async () => { await recordConsent(...); }}
//   />
// =============================================================================

interface ConsentModalProps {
  open: boolean;
  type: 'gate' | 'notice';
  module: string;
  title: string;
  description: string;
  policyUrl: string;
  onConsent: () => void | Promise<void>;
}

export function ConsentModal({
  open,
  type,
  module,
  title,
  description,
  policyUrl,
  onConsent,
}: ConsentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConsent = async () => {
    setIsSubmitting(true);
    try {
      await onConsent();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gate modals cannot be dismissed — no close button, no click-outside,
  // no escape key. Notice modals also require acknowledgment before dismiss.
  const isGate = type === 'gate';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      {/* Explicit bg-white / dark:bg-zinc-900 to guarantee an opaque modal
          regardless of theme — works around a known issue where bg-background
          can appear transparent in some theme configurations. */}
      <DialogContent
        className="bg-white sm:max-w-md dark:bg-zinc-900 [&>button:last-child]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-2 text-sm">
          <Link
            href={policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Read the full {module} terms
          </Link>
        </div>

        <DialogFooter>
          <Button
            onClick={handleConsent}
            disabled={isSubmitting}
            className={
              isGate ? 'bg-pana-pink hover:bg-pana-pink/90 w-full' : 'w-full'
            }
          >
            {isSubmitting
              ? 'Saving...'
              : isGate
                ? 'I understand and agree to these policies'
                : 'OK, got it!'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
