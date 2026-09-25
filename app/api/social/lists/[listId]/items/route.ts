/**
 * Add an entry to a Recommendation List.
 *
 * Appends to the end of the running order. The businesses-only rule and the
 * duplicate guard both live in the wrapper, so this route's only job is auth,
 * shape validation, and translating failures into status codes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  addItem,
  getListItems,
  serializeListItem,
} from '@/lib/federation/wrappers/recommendation-list';
import { createRecommendationListItemSchema } from '@/lib/validations/recommendation-list';
import { handleListError } from '@/lib/server/recommendation-list-errors';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createRecommendationListItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
        { status: 400 }
      );
    }

    const created = await addItem(listId, session.user.id, parsed.data);
    // Re-read through the join so the response carries the same shape the
    // profile page gets on a list fetch, rather than a thinner insert result.
    const items = await getListItems(listId);
    const item = items.find((row) => row.id === created.id);

    return NextResponse.json(
      {
        success: true,
        data: { item: item ? serializeListItem(item) : null },
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error adding recommendation list item:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to add item' },
        { status: 500 }
      );
    }
  }
}
