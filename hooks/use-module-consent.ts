'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// useModuleConsent — client-side hook for Phase 3 consent infrastructure
//
// Checks whether the current user has consented to a specific module's terms
// at the current major version. If not, exposes state to trigger the
// ConsentModal and a handler to record consent via API.
//
// Usage:
//   const { needsConsent, recordConsent, isLoading } = useModuleConsent({
//     document: 'terms',
//     module: 'articles',
//   });
//
//   <ConsentModal open={needsConsent} onConsent={recordConsent} ... />
//
// The hook calls GET /api/consent/check and POST /api/consent/record. The
// policy version is the single source of truth in policy.json and is resolved
// server-side — callers never pass a version.
// =============================================================================

interface UseModuleConsentOptions {
  document: string;
  module: string | null;
  /** Skip the consent check entirely (e.g., for admin users) */
  skip?: boolean;
}

interface UseModuleConsentResult {
  /** True if the user has NOT yet consented and the modal should be shown */
  needsConsent: boolean;
  /** Call this from ConsentModal's onConsent to record the receipt */
  recordConsent: () => Promise<void>;
  /** True while the initial check is in flight */
  isLoading: boolean;
}

export function useModuleConsent({
  document,
  module,
  skip = false,
}: UseModuleConsentOptions): UseModuleConsentResult {
  const [needsConsent, setNeedsConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(!skip);

  // Check consent status on mount
  useEffect(() => {
    if (skip) return;

    const checkConsent = async () => {
      try {
        // No version param — the server resolves the current one from
        // policy.json for this document + module.
        const params = new URLSearchParams({ document });
        if (module) params.set('module', module);

        const res = await fetch(`/api/consent/check?${params}`);
        if (res.ok) {
          const data = await res.json();
          setNeedsConsent(!data.consented);
        }
      } catch {
        // On error, don't block the user — fail open
        setNeedsConsent(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkConsent();
  }, [document, module, skip]);

  const recordConsent = useCallback(async () => {
    try {
      // The server derives the version from policy.json and records IP + GPC
      // from the request headers — the client only sends document + module.
      await fetch('/api/consent/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document, module }),
      });
      setNeedsConsent(false);
    } catch {
      // Still dismiss — don't trap the user on a network error
      setNeedsConsent(false);
    }
  }, [document, module]);

  return { needsConsent, recordConsent, isLoading };
}
