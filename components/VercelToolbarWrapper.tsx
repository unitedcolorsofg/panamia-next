'use client';

import { useState, useEffect } from 'react';
import { VercelToolbar } from '@vercel/toolbar/next';

const ALLOWED_DOMAIN = 'panamia-webrtc.vercel.app';

/**
 * Conditionally renders the Vercel Toolbar only on the staging domain.
 * This allows all users to see the toolbar for feedback/comments
 * but only on the specific Vercel preview deployment.
 */
export function VercelToolbarWrapper() {
  const [isAllowedDomain, setIsAllowedDomain] = useState(false);

  useEffect(() => {
    // Check domain on mount - this runs only on client
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAllowedDomain(window.location.host === ALLOWED_DOMAIN);
  }, []);

  if (!isAllowedDomain) {
    return null;
  }

  return <VercelToolbar />;
}
