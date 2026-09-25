/**
 * GET /api/social/groups/[handle] - Read a group
 *
 * Returns the group, its actor, and what the viewer is allowed to do with it.
 *
 * `canRead` is the single answer every later phase must ask before serving a
 * group's posts, roster or events. It is computed here, once, rather than
 * re-derived per endpoint, because private-group leakage is the highest
 * severity risk in the design and re-deriving a rule is how it ends up
 * subtly different in one place.
 *
 * Note what is NOT gated: a private group still returns its name, summary,
 * topics, rules, join policy and member count to a stranger. That is
 * deliberate and matches the mock -- a private group you cannot identify at
 * all is a dead end nobody would ever ask to join. What is withheld is the
 * content, and none of it lives on this endpoint.
 *
 * @see docs/GROUPS-ROADMAP.md
 * @see app/mock/group
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import {
  getGroupByHandle,
  getMembership,
  updateGroup,
  GROUP_VISIBILITIES,
  GROUP_JOIN_POLICIES,
} from '@/lib/federation';
import type { UpdateGroupInput } from '@/lib/federation';
import type {
  SocialGroupJoinPolicy,
  SocialGroupVisibility,
} from '@/lib/schema';
import { deleteGroup } from '@/lib/server/delete-group';

interface UpdateGroupBody {
  name?: unknown;
  summary?: unknown;
  topics?: unknown;
  rules?: unknown;
  visibility?: unknown;
  joinPolicy?: unknown;
}

/**
 * Accept a list of strings, or nothing.
 *
 * Returns null for anything else, which the caller turns into a 400 -- a
 * silently ignored malformed list would look like a save that worked.
 */
function asStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === 'string')) return null;
  return value as string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const found = await getGroupByHandle(handle);

  if (!found) {
    return NextResponse.json(
      { success: false, error: 'Group not found' },
      { status: 404 }
    );
  }

  const { group, actor } = found;

  // Unauthenticated readers are simply a viewer with no membership, not an
  // error -- a public group is readable by anyone, logged in or not.
  const session = await auth();
  const profile = session?.user?.id
    ? await getActiveProfileWithActor(session.user.id)
    : null;
  const viewerActorId = profile?.socialActor?.id ?? null;

  const membership = viewerActorId
    ? await getMembership(group.id, viewerActorId)
    : null;

  const isActiveMember = membership?.status === 'active';

  return NextResponse.json({
    success: true,
    data: {
      group,
      actor,
      viewer: {
        // A public group is readable by everyone. A private one is readable
        // only by an active member -- pending and banned are not members yet
        // and not members any more, and neither may read.
        canRead: group.visibility === 'public' || isActiveMember,
        canPost: isActiveMember,
        isMember: isActiveMember,
        isPending: membership?.status === 'pending',
        role: isActiveMember ? membership.role : null,
        // Null rather than false when signed out, so a client can tell "you
        // cannot join" apart from "we do not know who you are yet".
        canJoin: viewerActorId
          ? !membership && group.joinPolicy !== 'invite'
          : null,
      },
    },
  });
}

/**
 * Resolve the group and confirm the caller administers it.
 *
 * Shared by PATCH and DELETE. Both are admin-only and both have to answer the
 * same four questions in the same order -- signed in, group exists, caller is
 * an active member, caller is an admin. Written once so the two cannot answer
 * them differently.
 */
async function requireGroupAdmin(
  handle: string
): Promise<
  | { ok: true; group: Awaited<ReturnType<typeof getGroupByHandle>> & object }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const found = await getGroupByHandle(handle);
  if (!found) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      ),
    };
  }

  const profile = await getActiveProfileWithActor(session.user.id);
  const viewerActorId = profile?.socialActor?.id ?? null;
  const membership = viewerActorId
    ? await getMembership(found.group.id, viewerActorId)
    : null;

  if (membership?.status !== 'active' || membership.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Only an admin can change this group' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, group: found };
}

/**
 * PATCH /api/social/groups/[handle] - Edit a group
 *
 * Admin only. Moderators run the group day to day; changing what it *is* --
 * its name, its rules, who may read it -- is not that.
 *
 * Partial: only the fields present are changed. `topics` and `rules` are
 * whole-list replacements when sent, so `[]` clears them.
 *
 * The handle is not editable. It is the group's address and is shared with
 * the flat screenname namespace, so renaming is a migration rather than a
 * setting -- see `updateGroup`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const gate = await requireGroupAdmin(handle);
  if (!gate.ok) return gate.response;

  let body: UpdateGroupBody;
  try {
    body = (await request.json()) as UpdateGroupBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const input: UpdateGroupInput = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name must be text' },
        { status: 400 }
      );
    }
    input.name = body.name;
  }

  // Null is meaningful here -- it clears the description -- so it passes
  // through rather than being rejected as a non-string.
  if (body.summary !== undefined) {
    if (body.summary !== null && typeof body.summary !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Description must be text' },
        { status: 400 }
      );
    }
    input.summary = body.summary;
  }

  for (const field of ['topics', 'rules'] as const) {
    if (body[field] === undefined) continue;
    const list = asStringArray(body[field]);
    if (list === null) {
      return NextResponse.json(
        { success: false, error: 'Topics and rules must be lists of text' },
        { status: 400 }
      );
    }
    input[field] = list;
  }

  if (body.visibility !== undefined) {
    if (
      !GROUP_VISIBILITIES.includes(body.visibility as SocialGroupVisibility)
    ) {
      return NextResponse.json(
        { success: false, error: 'Unknown visibility' },
        { status: 400 }
      );
    }
    input.visibility = body.visibility as SocialGroupVisibility;
  }

  if (body.joinPolicy !== undefined) {
    if (
      !GROUP_JOIN_POLICIES.includes(body.joinPolicy as SocialGroupJoinPolicy)
    ) {
      return NextResponse.json(
        { success: false, error: 'Unknown join policy' },
        { status: 400 }
      );
    }
    input.joinPolicy = body.joinPolicy as SocialGroupJoinPolicy;
  }

  const result = await updateGroup(gate.group.group.id, input);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { group: result.group, actor: result.actor },
  });
}

/**
 * DELETE /api/social/groups/[handle] - Permanently delete a group
 *
 * Admin only. Moderators run the group day to day; ending it is not that.
 *
 * The handle must be repeated as `?confirm=`, matching how irreversible
 * actions are confirmed elsewhere: it makes the click deliberate, and it makes
 * a mis-aimed request from the wrong page fail instead of succeed. Passed as a
 * query param rather than a body because DELETE bodies are not reliably
 * forwarded by every client and proxy.
 *
 * Call GET /api/social/groups/[handle]/deletion-preview first -- it returns
 * what this destroys, which is mostly other people's posts.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const gate = await requireGroupAdmin(handle);
  if (!gate.ok) return gate.response;

  const confirm = request.nextUrl.searchParams.get('confirm');
  if (confirm?.toLowerCase() !== handle.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: 'Type the group handle to confirm' },
      { status: 400 }
    );
  }

  const result = await deleteGroup(gate.group.group.id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? 'Failed to delete group' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { deleted: result.deleted },
  });
}
