import type { ReactNode } from 'react';

import AdminNav from '@/components/Admin/nav';

/**
 * Chrome for every staff tool.
 *
 * This wraps real pages as well as the two mocked ones, so it deliberately
 * carries nothing that makes a claim about the content: no "MOCK" banner, no
 * counts, no headings. `AdminMockBar` stays inside the two mocked pages that
 * have fixture data in them, because putting it here would stamp "every number
 * below is a fixture" across the live CSV export and the approval links that
 * arrive in staff email.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-pana-cream text-pana-ink">
      <div className="container mx-auto flex flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-10">
        <AdminNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
