import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ScopePage } from '../_components/scope-page';
import {
  SCOPE_BLURB,
  SCOPE_LABEL,
  scopeFromSegment,
  scopePath,
} from '@/lib/directory-scopes';

/**
 * Query-form scoped search: /directory/events?q=salsa, and the bare
 * /directory/events browse view.
 *
 * Exists for the same reason /directory/search does alongside its [q] sibling:
 * a `<form method="get">` with scripting off can only produce this shape, so
 * it is the no-JS landing point. A term arriving here is redirected to the
 * canonical path form, which keeps one URL per search in the index rather
 * than two spellings of it.
 */
interface PageProps {
  params: Promise<{ scope: string }>;
  searchParams: Promise<{ q?: string; p?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { scope: segment } = await params;
  const scope = scopeFromSegment(segment);
  if (!scope) return {};

  return {
    title: `${SCOPE_LABEL[scope]} | Pana Mia Directory`,
    description: SCOPE_BLURB[scope],
    alternates: { canonical: `/directory/${segment}` },
    robots: scope === 'pana' ? { index: false, follow: false } : undefined,
  };
}

export default async function DirectoryScopePage({
  params,
  searchParams,
}: PageProps) {
  const { scope: segment } = await params;
  const scope = scopeFromSegment(segment);
  if (!scope) notFound();

  const { q, p } = await searchParams;
  const term = (q ?? '').trim();
  if (term) redirect(scopePath(scope, term));

  return <ScopePage scope={scope} term="" page={pageNumber(p)} />;
}

function pageNumber(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
