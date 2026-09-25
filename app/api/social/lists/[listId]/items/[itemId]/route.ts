/**
 * One entry on a Recommendation List.
 *
 *   PATCH  — rewrite the note. The recommended business is not editable:
 *            changing it would silently re-point an existing note at a
 *            different place, which reads as the author saying something they
 *            did not say. Remove the entry and add the other one.
 *   DELETE — remove the entry and close the gap in the running order.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  removeItem,
  updateItem,
} from '@/lib/federation/wrappers/recommendation-list';
import { updateRecommendationListItemSchema } from '@/lib/validations/recommendation-list';
import { handleListError } from '@/lib/server/recommendation-list-errors';

interface RouteParams {
  params: Promise<{ listId: string; itemId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { listId, itemId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateRecommendationListItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
        { status: 400 }
      );
    }

    const item = await updateItem(listId, itemId, session.user.id, parsed.data);
    return NextResponse.json({
      success: true,
      data: { item: { id: item.id, note: item.note, position: item.position } },
    });
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error updating recommendation list item:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update item' },
        { status: 500 }
      );
    }
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { listId, itemId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await removeItem(listId, itemId, session.user.id);
    return NextResponse.json({ success: true, message: 'Item removed' });
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error removing recommendation list item:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to remove item' },
        { status: 500 }
      );
    }
  }
}
