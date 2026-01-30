/**
 * GET /api/social/statuses/[statusId]/replies - Get replies to a status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStatusReplies } from '@/lib/federation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const { statusId } = await params;

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  const result = await getStatusReplies(statusId, cursor, limit);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
