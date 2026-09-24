/**
 * POST /api/social/groups - Create a group
 *
 * Creating a group mints an actor, so the caller must already have one of
 * their own: a group needs a founding admin, and an admin is an actor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { createGroup } from '@/lib/federation';
import type {
  SocialGroupJoinPolicy,
  SocialGroupVisibility,
} from '@/lib/schema';

const VISIBILITIES: SocialGroupVisibility[] = ['public', 'private'];
const JOIN_POLICIES: SocialGroupJoinPolicy[] = ['open', 'request', 'invite'];

interface CreateGroupBody {
  handle?: unknown;
  name?: unknown;
  summary?: unknown;
  topics?: unknown;
  rules?: unknown;
  visibility?: unknown;
  joinPolicy?: unknown;
}

function asStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === 'string')) return null;
  return value as string[];
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);

  if (!profile?.socialActor) {
    return NextResponse.json(
      { success: false, error: 'You must enable social features first' },
      { status: 403 }
    );
  }

  let body: CreateGroupBody;
  try {
    body = (await request.json()) as CreateGroupBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof body.handle !== 'string' || typeof body.name !== 'string') {
    return NextResponse.json(
      { success: false, error: 'A handle and a name are required' },
      { status: 400 }
    );
  }

  if (body.summary !== undefined && typeof body.summary !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Description must be text' },
      { status: 400 }
    );
  }

  const topics = asStringArray(body.topics);
  const rules = asStringArray(body.rules);

  if (topics === null || rules === null) {
    return NextResponse.json(
      { success: false, error: 'Topics and rules must be lists of text' },
      { status: 400 }
    );
  }

  // Checked against the enum rather than cast, so an unknown value is a 400
  // here instead of a Postgres error further down.
  const visibility = body.visibility ?? 'public';
  const joinPolicy = body.joinPolicy ?? 'open';

  if (!VISIBILITIES.includes(visibility as SocialGroupVisibility)) {
    return NextResponse.json(
      { success: false, error: 'Unknown visibility' },
      { status: 400 }
    );
  }

  if (!JOIN_POLICIES.includes(joinPolicy as SocialGroupJoinPolicy)) {
    return NextResponse.json(
      { success: false, error: 'Unknown join policy' },
      { status: 400 }
    );
  }

  const result = await createGroup({
    handle: body.handle,
    name: body.name,
    summary: body.summary,
    topics,
    rules,
    visibility: visibility as SocialGroupVisibility,
    joinPolicy: joinPolicy as SocialGroupJoinPolicy,
    createdByProfileId: profile.id,
    founderActorId: profile.socialActor.id,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: { group: result.group, actor: result.actor },
    },
    { status: 201 }
  );
}
