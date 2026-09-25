/**
 * Recommendation Lists — collection.
 *
 *   GET  — the signed-in pana's own lists, every visibility included, because
 *          this is the authoring surface. Public reads go through
 *          /api/social/profiles/[handle]/lists instead.
 *   POST — create a list. Starts private by default: a list is written over
 *          time and publishing should be a decision, not the side effect of
 *          typing a title.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createList,
  getVisibleListsForOwner,
  serializeList,
} from '@/lib/federation/wrappers/recommendation-list';
import { createRecommendationListSchema } from '@/lib/validations/recommendation-list';
import { handleListError } from '@/lib/server/recommendation-list-errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Owner viewing their own shelf, so viewer and owner are the same id and
    // every visibility passes the filter.
    const lists = await getVisibleListsForOwner(
      session.user.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: { lists: lists.map((list) => serializeList(list)) },
    });
  } catch (error) {
    console.error('Error listing recommendation lists:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createRecommendationListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
        { status: 400 }
      );
    }

    const list = await createList(session.user.id, parsed.data);
    return NextResponse.json(
      { success: true, data: { list: serializeList(list) } },
      { status: 201 }
    );
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error creating recommendation list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create list' },
        { status: 500 }
      );
    }
  }
}
