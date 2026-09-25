/**
 * Rewrite a Recommendation List's running order.
 *
 * PUT rather than PATCH because the body is the complete order, not a delta.
 * The caller sends every item id in the sequence it wants and the server
 * derives positions from the array index, which makes "two things in third
 * place" and "forgot an item" unrepresentable rather than merely discouraged.
 *
 * The order matters to the product: the first cafe in "Cafecito crawl" is a
 * claim about where to start, not an accident of insertion time.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getListItems,
  reorderItems,
  serializeListItem,
} from '@/lib/federation/wrappers/recommendation-list';
import { reorderRecommendationListSchema } from '@/lib/validations/recommendation-list';
import { handleListError } from '@/lib/server/recommendation-list-errors';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const parsed = reorderRecommendationListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
        { status: 400 }
      );
    }

    await reorderItems(listId, session.user.id, parsed.data.itemIds);
    const items = await getListItems(listId);

    return NextResponse.json({
      success: true,
      data: { items: items.map(serializeListItem) },
    });
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error reordering recommendation list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to reorder list' },
        { status: 500 }
      );
    }
  }
}
