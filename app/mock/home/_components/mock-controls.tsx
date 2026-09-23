'use client';

import { FlaskConical, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Scaffolding, not design — same bar the other mocks carry.
 *
 * There is nothing to toggle on this page: it is signed-out, has no viewer
 * states, and everything interactive (the notes, the pillar panels) is
 * reachable by using the page the way a visitor would. So the bar carries the
 * one thing a reviewer actually needs, which is a way to put this side by side
 * with the page it is arguing against.
 */
export function MockControls() {
  return (
    <div className="bizprofile-mockbar">
      <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase opacity-70">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Design mock · Homepage
        </span>

        <Link href="/" className="mock-toolbar-link">
          Compare with the live homepage
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>

        <span className="ml-auto hidden text-xs font-semibold opacity-55 lg:inline">
          Open the notes and switch the pillars — both are live.
        </span>
      </div>
    </div>
  );
}
