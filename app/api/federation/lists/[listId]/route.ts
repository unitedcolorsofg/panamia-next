/**
 * ActivityPub representation of a Recommendation List.
 *
 * Served from /api/federation/ while the advertised AS2 `id` points at
 * /p/{handle}/lists/{slug} on the federation domain — the same split
 * app/api/federation/events/[slug]/route.ts uses, and for the same reason
 * documented in lib/federation/domain.ts: the identity URI must track the
 * federation domain, not whichever host happens to serve the web UI. Keeping
 * the JSON-LD here also means this feature adds no files under app/p/.
 *
 * Public lists only. `unlisted` is a web-surface affordance — reachable if you
 * hold the link — and quietly promoting that to a federated object that
 * remote servers cache and redistribute is not the bargain the author made.
 * Private is obviously excluded.
 *
 * Addressing only, no push delivery: there is no outbound delivery pipeline in
 * this codebase yet, for lists or for statuses. See
 * lib/federation/wrappers/status.ts and SOCIAL-ROADMAP Phase 6.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getListById,
  getListItems,
  getOwnerHandle,
  serializeListAsCollection,
} from '@/lib/federation/wrappers/recommendation-list';
import { corsHeaders } from '@/lib/federation/cors';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

const AP_CONTENT_TYPE = 'application/activity+json; charset=utf-8';

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const list = await getListById(listId);

    if (!list || list.visibility !== 'public') {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: corsHeaders('GET', 'OPTIONS') }
      );
    }

    const handle = await getOwnerHandle(list.ownerUserId);
    if (!handle) {
      // No handle means no actor, so there is nothing coherent to attribute
      // the collection to. Better a 404 than an object pointing at an actor
      // URI that does not resolve.
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: corsHeaders('GET', 'OPTIONS') }
      );
    }

    const items = await getListItems(listId);
    const collection = serializeListAsCollection(list, items, handle);

    return new NextResponse(JSON.stringify(collection), {
      status: 200,
      headers: {
        'Content-Type': AP_CONTENT_TYPE,
        ...corsHeaders('GET', 'OPTIONS'),
      },
    });
  } catch (error) {
    console.error('Error serving recommendation list collection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders('GET', 'OPTIONS') }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders('GET', 'OPTIONS'),
  });
}
