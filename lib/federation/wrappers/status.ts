/**
 * Status Management
 *
 * High-level functions for creating and managing SocialStatuses.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import {
  socialStatuses,
  socialActors,
  socialAttachments,
  socialLikes,
} from '@/lib/schema';
import type { SocialStatus, SocialActor } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { marked } from 'marked';
import { canPost, GateResult } from '../gates';
import { socialConfig, getFollowersUrl } from '../index';
import type { PostVisibility } from '@/lib/utils/getVisibility';
import type { JsonValue } from '@/lib/types';

// Configure marked to add safety attributes to links
marked.use({
  renderer: {
    link({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr} rel="noopener noreferrer ugc" target="_blank">${text}</a>`;
    },
  },
});

export type CreateStatusResult =
  | { success: true; status: SocialStatus }
  | { success: false; error: string; gateResult?: GateResult };

export type StatusWithActor = SocialStatus & {
  actor: SocialActor;
};

/**
 * Generate a status URI for local statuses
 */
export function generateStatusUri(username: string, statusId: string): string {
  return `https://${socialConfig.domain}/p/${username}/statuses/${statusId}`;
}

// Direct messages expire after 7 days (soft delete via query filter)
const DM_EXPIRY_DAYS = 7;

/**
 * Returns a Drizzle WHERE condition to exclude expired statuses.
 */
function notExpiredCondition() {
  return sql`(${socialStatuses.expiresAt} IS NULL OR ${socialStatuses.expiresAt} > NOW())`;
}

/** Location object for ActivityPub Place */
export interface StatusLocation {
  type: 'Place';
  latitude?: number;
  longitude?: number;
  name?: string;
  precision?: 'precise' | 'general';
}

/**
 * Create a new status (post)
 */
export async function createStatus(
  actorId: string,
  content: string,
  contentWarning?: string,
  inReplyToId?: string,
  visibility: PostVisibility = 'unlisted',
  attachments?: Array<{
    type: string;
    mediaType: string;
    url: string;
    name?: string;
    peaks?: number[];
  }>,
  recipientActorIds?: string[],
  location?: StatusLocation
): Promise<CreateStatusResult> {
  // Fetch the actor with profile
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorId),
    with: { profile: true },
  });

  if (!actor) {
    return { success: false, error: 'Actor not found' };
  }

  // Check gate (profile must exist for local actors)
  if (actor.profile) {
    const gateResult = canPost(actor.profile);
    if (!gateResult.allowed) {
      return {
        success: false,
        error: 'Not eligible to post',
        gateResult,
      };
    }
  }

  // Validate content
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Content cannot be empty' };
  }

  if (content.length > 5000) {
    return { success: false, error: 'Content exceeds maximum length' };
  }

  // Convert markdown to HTML
  const htmlContent = (
    await marked.parse(content.trim(), { gfm: true })
  ).trim();

  // If replying, validate the parent exists
  let inReplyToUri: string | undefined;
  if (inReplyToId) {
    const parent = await db.query.socialStatuses.findFirst({
      where: eq(socialStatuses.id, inReplyToId),
    });
    if (!parent) {
      return { success: false, error: 'Parent status not found' };
    }
    inReplyToUri = parent.uri;
  }

  // Create the status with placeholder URI
  const [status] = await db
    .insert(socialStatuses)
    .values({
      actorId,
      content: htmlContent,
      contentWarning: contentWarning || null,
      type: 'Note',
      published: new Date(),
      isDraft: false,
      inReplyToId: inReplyToId || null,
      inReplyToUri: inReplyToUri || null,
      uri: '',
      url: '',
    })
    .returning();

  // Update with proper URI now that we have the ID
  const uri = generateStatusUri(actor.username, status.id);
  const url = `https://${socialConfig.domain}/p/${actor.username}/${status.id}`;

  // Compute ActivityPub recipients
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
  const followersUrl = getFollowersUrl(actor.username);

  let recipientTo: string[];
  let recipientCc: string[];
  let expiresAt: Date | null = null;

  switch (visibility) {
    case 'public':
      recipientTo = [PUBLIC];
      recipientCc = [followersUrl];
      break;
    case 'private':
      recipientTo = [followersUrl];
      recipientCc = [];
      break;
    case 'direct': {
      if (!recipientActorIds || recipientActorIds.length === 0) {
        return {
          success: false,
          error: 'Direct messages require at least one recipient',
        };
      }
      if (recipientActorIds.length > 8) {
        return {
          success: false,
          error: 'Direct messages can have at most 8 recipients',
        };
      }
      const recipientActorsRows = await db
        .select({ uri: socialActors.uri })
        .from(socialActors)
        .where(
          sql`${socialActors.id} = ANY(ARRAY[${sql.join(
            recipientActorIds.map((id) => sql`${id}`),
            sql`, `
          )}]::text[])`
        );
      if (recipientActorsRows.length !== recipientActorIds.length) {
        return { success: false, error: 'One or more recipients not found' };
      }
      recipientTo = recipientActorsRows.map((r) => r.uri);
      recipientCc = [];
      expiresAt = new Date(Date.now() + DM_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      break;
    }
    case 'unlisted':
    default:
      recipientTo = [followersUrl];
      recipientCc = [PUBLIC];
      break;
  }

  const [updatedStatus] = await db
    .update(socialStatuses)
    .set({
      uri,
      url,
      recipientTo,
      recipientCc,
      expiresAt,
      location: location ? (location as unknown as JsonValue) : null,
    })
    .where(eq(socialStatuses.id, status.id))
    .returning();

  // Create attachment records if provided
  if (attachments && attachments.length > 0) {
    await db.insert(socialAttachments).values(
      attachments.map((att) => ({
        statusId: status.id,
        type: att.type,
        mediaType: att.mediaType,
        url: att.url,
        name: att.name || null,
        peaks: att.peaks ? (att.peaks as JsonValue) : null,
      }))
    );
  }

  // Update actor's status count
  await db
    .update(socialActors)
    .set({ statusCount: sql`${socialActors.statusCount} + 1` })
    .where(eq(socialActors.id, actorId));

  // If this is a reply, increment parent's reply count
  if (inReplyToId) {
    await db
      .update(socialStatuses)
      .set({ repliesCount: sql`${socialStatuses.repliesCount} + 1` })
      .where(eq(socialStatuses.id, inReplyToId));
  }

  return { success: true, status: updatedStatus };
}

/**
 * Get a status by ID with actor information
 */
export async function getStatus(
  statusId: string
): Promise<StatusWithActor | null> {
  return (
    (await db.query.socialStatuses.findFirst({
      where: eq(socialStatuses.id, statusId),
      with: { actor: true },
    })) ?? null
  );
}

/**
 * Get a status by URI
 */
export async function getStatusByUri(
  uri: string
): Promise<StatusWithActor | null> {
  return (
    (await db.query.socialStatuses.findFirst({
      where: eq(socialStatuses.uri, uri),
      with: { actor: true },
    })) ?? null
  );
}

/**
 * Delete a status (only author can delete)
 */
export async function deleteStatus(
  statusId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  const status = await db.query.socialStatuses.findFirst({
    where: eq(socialStatuses.id, statusId),
  });

  if (!status) {
    return { success: false, error: 'Status not found' };
  }

  if (status.actorId !== actorId) {
    return { success: false, error: 'Not authorized to delete this status' };
  }

  await db.delete(socialStatuses).where(eq(socialStatuses.id, statusId));

  // Decrement actor's status count
  await db
    .update(socialActors)
    .set({ statusCount: sql`${socialActors.statusCount} - 1` })
    .where(eq(socialActors.id, actorId));

  // If this was a reply, decrement parent's reply count
  if (status.inReplyToId) {
    await db
      .update(socialStatuses)
      .set({ repliesCount: sql`${socialStatuses.repliesCount} - 1` })
      .where(eq(socialStatuses.id, status.inReplyToId));
  }

  return { success: true };
}

/**
 * Get replies to a status
 */
export async function getStatusReplies(
  statusId: string,
  cursor?: string,
  limit: number = 20
): Promise<{ replies: StatusWithActor[]; nextCursor: string | null }> {
  const replies = await db.query.socialStatuses.findMany({
    where: (s, { and, eq, isNotNull, gt }) =>
      and(
        eq(s.inReplyToId, statusId),
        isNotNull(s.published),
        cursor ? gt(s.id, cursor) : undefined,
        sql`(${socialStatuses.expiresAt} IS NULL OR ${socialStatuses.expiresAt} > NOW())`
      ),
    with: { actor: true, attachments: true },
    orderBy: (s, { asc }) => [asc(s.published), asc(s.id)],
    limit: limit + 1,
  });

  const hasMore = replies.length > limit;
  const items = hasMore ? replies.slice(0, limit) : replies;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { replies: items as StatusWithActor[], nextCursor };
}

/**
 * Like a status
 */
export async function likeStatus(
  actorId: string,
  statusId: string
): Promise<{
  success: boolean;
  liked: boolean;
  likesCount: number;
  error?: string;
}> {
  const status = await db.query.socialStatuses.findFirst({
    where: eq(socialStatuses.id, statusId),
  });

  if (!status) {
    return {
      success: false,
      liked: false,
      likesCount: 0,
      error: 'Status not found',
    };
  }

  // Check if already liked
  const existingLike = await db.query.socialLikes.findFirst({
    where: and(
      eq(socialLikes.actorId, actorId),
      eq(socialLikes.statusId, statusId)
    ),
  });

  if (existingLike) {
    return { success: true, liked: true, likesCount: status.likesCount };
  }

  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorId),
  });

  if (!actor) {
    return {
      success: false,
      liked: false,
      likesCount: 0,
      error: 'Actor not found',
    };
  }

  const likeUri = `https://${socialConfig.domain}/p/${actor.username}/likes/${statusId}`;

  await db.insert(socialLikes).values({
    actorId,
    statusId,
    uri: likeUri,
  });

  const [updatedStatus] = await db
    .update(socialStatuses)
    .set({ likesCount: sql`${socialStatuses.likesCount} + 1` })
    .where(eq(socialStatuses.id, statusId))
    .returning();

  return {
    success: true,
    liked: true,
    likesCount: updatedStatus?.likesCount ?? status.likesCount + 1,
  };
}

/**
 * Unlike a status
 */
export async function unlikeStatus(
  actorId: string,
  statusId: string
): Promise<{
  success: boolean;
  liked: boolean;
  likesCount: number;
  error?: string;
}> {
  const status = await db.query.socialStatuses.findFirst({
    where: eq(socialStatuses.id, statusId),
  });

  if (!status) {
    return {
      success: false,
      liked: false,
      likesCount: 0,
      error: 'Status not found',
    };
  }

  const existingLike = await db.query.socialLikes.findFirst({
    where: and(
      eq(socialLikes.actorId, actorId),
      eq(socialLikes.statusId, statusId)
    ),
  });

  if (!existingLike) {
    return { success: true, liked: false, likesCount: status.likesCount };
  }

  await db.delete(socialLikes).where(eq(socialLikes.id, existingLike.id));

  const [updatedStatus] = await db
    .update(socialStatuses)
    .set({ likesCount: sql`${socialStatuses.likesCount} - 1` })
    .where(eq(socialStatuses.id, statusId))
    .returning();

  return {
    success: true,
    liked: false,
    likesCount: updatedStatus?.likesCount ?? Math.max(0, status.likesCount - 1),
  };
}
