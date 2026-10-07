/**
 * /api/social/groups/topics
 *
 * GET - The topics groups have actually used, with how many use each.
 *
 * A sibling of the search route rather than a query string on it, because it
 * answers a different question. Search asks "which groups match this?" and
 * returns group rows; this asks "what is there to look for at all?" and
 * returns a vocabulary. Folding it into one endpoint would mean every search
 * carried a facet aggregation it did not need.
 *
 * Unauthenticated for the same reason the search route is: browsing is open,
 * and a chip row that only appeared for signed-in visitors would make the
 * landing page look empty to exactly the people being pitched to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listGroupTopics } from '@/lib/server/group-search';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');

  // Clamped inside listGroupTopics, so junk falls back to the default rather
  // than 400-ing a landing page over a malformed query string.
  const limit = limitParam ? Number(limitParam) : undefined;

  const topics = await listGroupTopics(limit);

  return NextResponse.json({ success: true, data: { topics } });
}
