/**
 * Status Management
 *
 * High-level functions for creating and managing SocialStatuses.
 * Handles posts, replies, and content warnings.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { getPrisma } from '@/lib/prisma';
import { SocialStatus, SocialActor } from '@prisma/client';
import { marked } from 'marked';
import { canPost, GateResult } from '../gates';
import { socialConfig, getFollowersUrl } from '../index';
import type { PostVisibility } from '@/lib/utils/getVisibility';

// Configure marked to add safety attributes to links (noopener, noreferrer, ugc)
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
  return `https://${socialConfig.domain}/users/${username}/statuses/${statusId}`;
}

/**
 * Create a new status (post)
 *
 * @param actorId - The actor creating the status
 * @param content - HTML content of the status
 * @param contentWarning - Optional content warning
 * @param inReplyToId - Optional status ID this is replying to
 * @param visibility - Post visibility: 'public' | 'unlisted' | 'private' (default: 'unlisted')
 * @param attachments - Optional array of uploaded media metadata
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
  }>
): Promise<CreateStatusResult> {
  const prisma = await getPrisma();

  // Fetch the actor with profile
  const actor = await prisma.socialActor.findUnique({
    where: { id: actorId },
    include: { profile: true },
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

  // Convert markdown to HTML for ActivityPub federation compatibility
  const htmlContent = (
    await marked.parse(content.trim(), { gfm: true })
  ).trim();

  // If replying, validate the parent exists
  let inReplyToUri: string | undefined;
  if (inReplyToId) {
    const parent = await prisma.socialStatus.findUnique({
      where: { id: inReplyToId },
    });
    if (!parent) {
      return { success: false, error: 'Parent status not found' };
    }
    inReplyToUri = parent.uri;
  }

  // Create the status (store HTML-converted content for AP federation)
  const status = await prisma.socialStatus.create({
    data: {
      actorId,
      content: htmlContent,
      contentWarning: contentWarning || null,
      type: 'Note',
      published: new Date(),
      isDraft: false,
      inReplyToId: inReplyToId || null,
      inReplyToUri: inReplyToUri || null,
      // URI will be set after we have the ID
      uri: '',
      url: '',
    },
  });

  // Update with proper URI now that we have the ID
  const uri = generateStatusUri(actor.username, status.id);
  const url = `https://${socialConfig.domain}/p/${actor.username}/${status.id}`;

  // Compute ActivityPub recipients based on visibility
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
  const followersUrl = getFollowersUrl(actor.username);

  let recipientTo: string[];
  let recipientCc: string[];

  switch (visibility) {
    case 'public':
      recipientTo = [PUBLIC];
      recipientCc = [followersUrl];
      break;
    case 'private':
      recipientTo = [followersUrl];
      recipientCc = [];
      break;
    case 'unlisted':
    default:
      recipientTo = [followersUrl];
      recipientCc = [PUBLIC];
      break;
  }

  const updatedStatus = await prisma.socialStatus.update({
    where: { id: status.id },
    data: { uri, url, recipientTo, recipientCc },
  });

  // Create attachment records if provided
  if (attachments && attachments.length > 0) {
    await prisma.socialAttachment.createMany({
      data: attachments.map((att) => ({
        statusId: status.id,
        type: att.type,
        mediaType: att.mediaType,
        url: att.url,
        name: att.name || null,
      })),
    });
  }

  // Update actor's status count
  await prisma.socialActor.update({
    where: { id: actorId },
    data: { statusCount: { increment: 1 } },
  });

  // If this is a reply, increment parent's reply count
  if (inReplyToId) {
    await prisma.socialStatus.update({
      where: { id: inReplyToId },
      data: { repliesCount: { increment: 1 } },
    });
  }

  return { success: true, status: updatedStatus };
}

/**
 * Get a status by ID with actor information
 */
export async function getStatus(
  statusId: string
): Promise<StatusWithActor | null> {
  const prisma = await getPrisma();

  return prisma.socialStatus.findUnique({
    where: { id: statusId },
    include: { actor: true },
  });
}

/**
 * Get a status by URI
 */
export async function getStatusByUri(
  uri: string
): Promise<StatusWithActor | null> {
  const prisma = await getPrisma();

  return prisma.socialStatus.findUnique({
    where: { uri },
    include: { actor: true },
  });
}

/**
 * Delete a status (only author can delete)
 */
export async function deleteStatus(
  statusId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  const prisma = await getPrisma();

  const status = await prisma.socialStatus.findUnique({
    where: { id: statusId },
  });

  if (!status) {
    return { success: false, error: 'Status not found' };
  }

  if (status.actorId !== actorId) {
    return { success: false, error: 'Not authorized to delete this status' };
  }

  // Delete the status (cascades to attachments, tags, likes)
  await prisma.socialStatus.delete({
    where: { id: statusId },
  });

  // Decrement actor's status count
  await prisma.socialActor.update({
    where: { id: actorId },
    data: { statusCount: { decrement: 1 } },
  });

  // If this was a reply, decrement parent's reply count
  if (status.inReplyToId) {
    await prisma.socialStatus.update({
      where: { id: status.inReplyToId },
      data: { repliesCount: { decrement: 1 } },
    });
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
  const prisma = await getPrisma();

  const replies = await prisma.socialStatus.findMany({
    where: {
      inReplyToId: statusId,
      published: { not: null },
    },
    include: { actor: true, attachments: true },
    orderBy: { published: 'asc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = replies.length > limit;
  const items = hasMore ? replies.slice(0, limit) : replies;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { replies: items, nextCursor };
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
  const prisma = await getPrisma();

  const status = await prisma.socialStatus.findUnique({
    where: { id: statusId },
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
  const existingLike = await prisma.socialLike.findUnique({
    where: {
      actorId_statusId: {
        actorId,
        statusId,
      },
    },
  });

  if (existingLike) {
    return { success: true, liked: true, likesCount: status.likesCount };
  }

  // Create like
  const actor = await prisma.socialActor.findUnique({
    where: { id: actorId },
  });

  if (!actor) {
    return {
      success: false,
      liked: false,
      likesCount: 0,
      error: 'Actor not found',
    };
  }

  const likeUri = `https://${socialConfig.domain}/users/${actor.username}/likes/${statusId}`;

  await prisma.socialLike.create({
    data: {
      actorId,
      statusId,
      uri: likeUri,
    },
  });

  // Increment likes count
  const updatedStatus = await prisma.socialStatus.update({
    where: { id: statusId },
    data: { likesCount: { increment: 1 } },
  });

  return { success: true, liked: true, likesCount: updatedStatus.likesCount };
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
  const prisma = await getPrisma();

  const status = await prisma.socialStatus.findUnique({
    where: { id: statusId },
  });

  if (!status) {
    return {
      success: false,
      liked: false,
      likesCount: 0,
      error: 'Status not found',
    };
  }

  // Check if liked
  const existingLike = await prisma.socialLike.findUnique({
    where: {
      actorId_statusId: {
        actorId,
        statusId,
      },
    },
  });

  if (!existingLike) {
    return { success: true, liked: false, likesCount: status.likesCount };
  }

  // Delete like
  await prisma.socialLike.delete({
    where: { id: existingLike.id },
  });

  // Decrement likes count
  const updatedStatus = await prisma.socialStatus.update({
    where: { id: statusId },
    data: { likesCount: { decrement: 1 } },
  });

  return { success: true, liked: false, likesCount: updatedStatus.likesCount };
}
