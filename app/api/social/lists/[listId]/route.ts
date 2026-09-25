/**
 * A single Recommendation List.
 *
 *   GET    — the list and its entries in running order. Visibility is
 *            evaluated with `direct: true`, so an unlisted list is readable by
 *            anyone holding the link but never appears in an enumeration —
 *            the same bargain event_visibility.unlisted makes.
 *   PATCH  — retitle, re-blurb, or change visibility. Not the slug: it is
 *            carried in the federated id and frozen on first publish.
 *   DELETE — remove the list and, by FK cascade, its entries.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  canViewList,
  deleteList,
  getListById,
  getListItems,
  serializeList,
  updateList,
} from '@/lib/federation/wrappers/recommendation-list';
import { updateRecommendationListSchema } from '@/lib/validations/recommendation-list';
import { handleListError } from '@/lib/server/recommendation-list-errors';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const session = await auth();
    const viewerUserId = session?.user?.id ?? null;

    const list = await getListById(listId);
    // A private list that is not yours is indistinguishable from one that does
    // not exist. Answering 403 would confirm it is real.
    if (!list || !canViewList(list, viewerUserId, { direct: true })) {
      return NextResponse.json(
        { success: false, error: 'List not found' },
        { status: 404 }
      );
    }

    const items = await getListItems(listId);
    return NextResponse.json({
      success: true,
      data: { list: serializeList(list, items) },
    });
  } catch (error) {
    console.error('Error loading recommendation list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load list' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const parsed = updateRecommendationListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
        { status: 400 }
      );
    }

    const list = await updateList(listId, session.user.id, parsed.data);
    return NextResponse.json({
      success: true,
      data: { list: serializeList(list) },
    });
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error updating recommendation list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update list' },
        { status: 500 }
      );
    }
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await deleteList(listId, session.user.id);
    return NextResponse.json({ success: true, message: 'List deleted' });
  } catch (error) {
    try {
      return handleListError(error);
    } catch {
      console.error('Error deleting recommendation list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete list' },
        { status: 500 }
      );
    }
  }
}
