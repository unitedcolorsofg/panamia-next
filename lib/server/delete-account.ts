/**
 * Account Deletion Executor
 *
 * Orchestrates permanent deletion of a user account, cleaning up all data,
 * third-party services, R2 media, and ActivityPub federation records.
 *
 * Content that has passed its archive threshold becomes part of the community
 * record under CC license — users choose to keep attribution or anonymize.
 * Social posts are always fully deleted.
 */

import { db } from '@/lib/db';
import { eq, and, or, inArray, gt, sql } from 'drizzle-orm';
import {
  users,
  profiles,
  accounts,
  sessions,
  verification,
  articles,
  notifications,
  consentReceipts,
  mentorSessions,
  intakeForms,
  emailMigrations,
  interactions,
  socialActors,
  socialStatuses,
  socialFollows,
  socialLikes,
  socialAttachments,
  socialTags,
  articleAnnouncements,
  deletionLogs,
  events,
  eventOrganizers,
  eventAttendees,
  eventNotes,
  eventPhotos,
  venues,
} from '@/lib/schema';
import { createId } from '@paralleldrive/cuid2';
import { deleteFile } from '@/lib/blob/api';
import { revokeAllOAuthTokens } from '@/lib/oauth-revoke';
import { signedHeaders } from '@/lib/federation/crypto/sign';
import { GhlClient } from '@/lib/ghl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeleteAccountOptions {
  attributionChoice: 'keep' | 'anonymize';
  ip?: string;
}

export interface DeleteAccountResult {
  success: boolean;
  deletionLogId: string;
  error?: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THREE_MONTHS_AGO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d;
};

async function safeDelete(
  label: string,
  fn: () => Promise<{ length?: number } | unknown[]>,
  counts: Record<string, number>,
  warnings: string[]
): Promise<number> {
  try {
    const result = await fn();
    const count = Array.isArray(result) ? result.length : 0;
    counts[label] = (counts[label] ?? 0) + count;
    return count;
  } catch (error) {
    const msg = `Failed to delete ${label}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`delete-account:${label}:error`, error);
    warnings.push(msg);
    return 0;
  }
}

function collectMediaUrls(obj: unknown): string[] {
  if (!obj) return [];
  const urls: string[] = [];
  if (typeof obj === 'string' && obj.startsWith('http')) {
    urls.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      urls.push(...collectMediaUrls(item));
    }
  } else if (typeof obj === 'object') {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      urls.push(...collectMediaUrls(val));
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function deleteAccount(
  userId: string,
  options: DeleteAccountOptions
): Promise<DeleteAccountResult> {
  const warnings: string[] = [];
  const deletedTables: Record<string, number> = {};
  const thirdPartyResults: Record<string, boolean> = {};
  const archivedContentIds: string[] = [];
  const logId = createId();

  // -----------------------------------------------------------------------
  // 1. Load context
  // -----------------------------------------------------------------------
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      accounts: true,
      profile: {
        with: { socialActor: true },
      },
    },
  });

  if (!user) {
    return {
      success: false,
      deletionLogId: logId,
      error: 'User not found',
      warnings,
    };
  }

  const profile = user.profile;
  const socialActor = profile?.socialActor ?? null;

  // -----------------------------------------------------------------------
  // 2. Pre-flight blockers
  // -----------------------------------------------------------------------
  const blockers: string[] = [];

  if (profile) {
    // Future events hosted
    const futureHosted = await db.query.events.findMany({
      where: and(
        eq(events.hostProfileId, profile.id),
        eq(events.status, 'published'),
        gt(events.startsAt, new Date())
      ),
      columns: { id: true, title: true },
    });
    if (futureHosted.length > 0) {
      blockers.push(
        `You are hosting ${futureHosted.length} upcoming event(s). Cancel or transfer them first.`
      );
    }

    // Venues with future events
    const operatedVenues = await db.query.venues.findMany({
      where: eq(venues.operatorProfileId, profile.id),
      columns: { id: true },
      with: {
        events: {
          where: and(
            eq(events.status, 'published'),
            gt(events.startsAt, new Date())
          ),
          columns: { id: true },
        },
      },
    });
    const venuesWithFutureEvents = operatedVenues.filter(
      (v) => v.events.length > 0
    );
    if (venuesWithFutureEvents.length > 0) {
      blockers.push(
        `You operate ${venuesWithFutureEvents.length} venue(s) with upcoming events.`
      );
    }
  }

  // Pending mentor sessions
  const pendingSessions = await db.query.mentorSessions.findMany({
    where: and(
      or(
        eq(mentorSessions.mentorUserId, userId),
        eq(mentorSessions.menteeUserId, userId)
      ),
      inArray(mentorSessions.status, ['pending', 'scheduled'])
    ),
    columns: { id: true },
  });
  if (pendingSessions.length > 0) {
    blockers.push(
      `You have ${pendingSessions.length} pending/scheduled mentoring session(s). Complete or cancel them first.`
    );
  }

  if (blockers.length > 0) {
    return {
      success: false,
      deletionLogId: logId,
      error: blockers.join(' '),
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // 3. Create deletion log (audit trail even if process fails partway)
  // -----------------------------------------------------------------------
  await db.insert(deletionLogs).values({
    id: logId,
    userId,
    email: user.email,
    screenname: user.screenname ?? null,
    attributionChoice: options.attributionChoice,
    ip: options.ip ?? null,
  });

  try {
    // -------------------------------------------------------------------
    // 4. Classify archive thresholds
    // -------------------------------------------------------------------
    const threeMonthsAgo = THREE_MONTHS_AGO();

    // Articles by this user
    const userArticles = await db.query.articles.findMany({
      where: eq(articles.authorId, userId),
      columns: { id: true, publishedAt: true, coverImage: true, status: true },
    });
    const archivedArticles = userArticles.filter(
      (a) => a.publishedAt && a.publishedAt < threeMonthsAgo
    );
    const preArchiveArticles = userArticles.filter(
      (a) => !a.publishedAt || a.publishedAt >= threeMonthsAgo
    );

    // Events hosted by this profile
    let allHostedEvents: {
      id: string;
      status: string;
      startsAt: Date;
      coverImage: string | null;
    }[] = [];
    let archivedEvents: typeof allHostedEvents = [];
    let preArchiveEvents: typeof allHostedEvents = [];

    if (profile) {
      allHostedEvents = await db.query.events.findMany({
        where: eq(events.hostProfileId, profile.id),
        columns: { id: true, status: true, startsAt: true, coverImage: true },
      });
      archivedEvents = allHostedEvents.filter((e) => e.status === 'completed');
      preArchiveEvents = allHostedEvents.filter(
        (e) => e.status !== 'completed'
      );
    }

    // Event photos by this profile
    let allPhotos: { id: string; url: string; eventId: string }[] = [];
    let archivedPhotos: typeof allPhotos = [];
    let preArchivePhotos: typeof allPhotos = [];

    if (profile) {
      allPhotos = (await db.query.eventPhotos.findMany({
        where: eq(eventPhotos.uploaderProfileId, profile.id),
        columns: { id: true, url: true, eventId: true },
        with: {
          event: { columns: { startsAt: true } },
        },
      })) as ((typeof allPhotos)[0] & { event: { startsAt: Date } })[];
      archivedPhotos = (
        allPhotos as ((typeof allPhotos)[0] & { event: { startsAt: Date } })[]
      ).filter((p) => p.event.startsAt < threeMonthsAgo);
      preArchivePhotos = (
        allPhotos as ((typeof allPhotos)[0] & { event: { startsAt: Date } })[]
      ).filter((p) => p.event.startsAt >= threeMonthsAgo);
    }

    // -------------------------------------------------------------------
    // 5. Handle archived content based on attribution choice
    // -------------------------------------------------------------------
    if (options.attributionChoice === 'anonymize') {
      // Anonymize archived articles
      if (archivedArticles.length > 0) {
        const ids = archivedArticles.map((a) => a.id);
        await db
          .update(articles)
          .set({ authorId: null })
          .where(inArray(articles.id, ids));
        archivedContentIds.push(...ids);
      }

      // Anonymize archived events
      if (archivedEvents.length > 0 && profile) {
        const ids = archivedEvents.map((e) => e.id);
        await db
          .update(events)
          .set({ hostProfileId: null })
          .where(inArray(events.id, ids));
        archivedContentIds.push(...ids);
      }

      // Anonymize archived photos
      if (archivedPhotos.length > 0) {
        const ids = archivedPhotos.map((p) => p.id);
        await db
          .update(eventPhotos)
          .set({ uploaderProfileId: null })
          .where(inArray(eventPhotos.id, ids));
        archivedContentIds.push(...ids);
      }
    } else {
      // 'keep' — leave content as-is, just record what was preserved
      archivedContentIds.push(
        ...archivedArticles.map((a) => a.id),
        ...archivedEvents.map((e) => e.id),
        ...archivedPhotos.map((p) => p.id)
      );
    }

    // -------------------------------------------------------------------
    // 6. Delete pre-archive content
    // -------------------------------------------------------------------
    // Pre-archive articles
    if (preArchiveArticles.length > 0) {
      const ids = preArchiveArticles.map((a) => a.id);
      // Delete announcements for these articles
      await safeDelete(
        'articleAnnouncements',
        () =>
          db
            .delete(articleAnnouncements)
            .where(inArray(articleAnnouncements.articleId, ids))
            .returning({ id: articleAnnouncements.id }),
        deletedTables,
        warnings
      );
      // Delete social statuses linked to these articles
      const linkedStatuses = await db.query.socialStatuses.findMany({
        where: inArray(socialStatuses.articleId, ids),
        columns: { id: true },
      });
      if (linkedStatuses.length > 0) {
        const statusIds = linkedStatuses.map((s) => s.id);
        await safeDelete(
          'socialTags',
          () =>
            db
              .delete(socialTags)
              .where(inArray(socialTags.statusId, statusIds))
              .returning({ id: socialTags.id }),
          deletedTables,
          warnings
        );
        await safeDelete(
          'socialAttachments',
          () =>
            db
              .delete(socialAttachments)
              .where(inArray(socialAttachments.statusId, statusIds))
              .returning({ id: socialAttachments.id }),
          deletedTables,
          warnings
        );
        await safeDelete(
          'socialLikes',
          () =>
            db
              .delete(socialLikes)
              .where(inArray(socialLikes.statusId, statusIds))
              .returning({ id: socialLikes.id }),
          deletedTables,
          warnings
        );
        await safeDelete(
          'socialStatuses',
          () =>
            db
              .delete(socialStatuses)
              .where(inArray(socialStatuses.id, statusIds))
              .returning({ id: socialStatuses.id }),
          deletedTables,
          warnings
        );
      }
      await safeDelete(
        'articles',
        () =>
          db
            .delete(articles)
            .where(inArray(articles.id, ids))
            .returning({ id: articles.id }),
        deletedTables,
        warnings
      );
    }

    // Pre-archive events: delete attendees, organizers, notes, photos first
    if (preArchiveEvents.length > 0 && profile) {
      const ids = preArchiveEvents.map((e) => e.id);
      await safeDelete(
        'eventNotes',
        () =>
          db
            .delete(eventNotes)
            .where(inArray(eventNotes.eventId, ids))
            .returning({ id: eventNotes.id }),
        deletedTables,
        warnings
      );
      await safeDelete(
        'eventAttendees',
        () =>
          db
            .delete(eventAttendees)
            .where(inArray(eventAttendees.eventId, ids))
            .returning({ id: eventAttendees.id }),
        deletedTables,
        warnings
      );
      await safeDelete(
        'eventOrganizers',
        () =>
          db
            .delete(eventOrganizers)
            .where(inArray(eventOrganizers.eventId, ids))
            .returning({ id: eventOrganizers.id }),
        deletedTables,
        warnings
      );
      // Delete event photos for pre-archive events
      const prEventPhotos = await db.query.eventPhotos.findMany({
        where: inArray(eventPhotos.eventId, ids),
        columns: { id: true, url: true },
      });
      if (prEventPhotos.length > 0) {
        await safeDelete(
          'eventPhotos',
          () =>
            db
              .delete(eventPhotos)
              .where(inArray(eventPhotos.eventId, ids))
              .returning({ id: eventPhotos.id }),
          deletedTables,
          warnings
        );
      }
      await safeDelete(
        'events',
        () =>
          db
            .delete(events)
            .where(inArray(events.id, ids))
            .returning({ id: events.id }),
        deletedTables,
        warnings
      );
    }

    // Delete pre-archive photos (uploaded to other people's events)
    if (preArchivePhotos.length > 0) {
      const ids = preArchivePhotos.map((p) => p.id);
      await safeDelete(
        'eventPhotos',
        () =>
          db
            .delete(eventPhotos)
            .where(inArray(eventPhotos.id, ids))
            .returning({ id: eventPhotos.id }),
        deletedTables,
        warnings
      );
    }

    // -------------------------------------------------------------------
    // 7. Update co-author references
    // -------------------------------------------------------------------
    try {
      // Find articles by other users that mention this user in coAuthors
      const coAuthoredArticles = await db
        .select({ id: articles.id, coAuthors: articles.coAuthors })
        .from(articles)
        .where(sql`${articles.coAuthors}::text LIKE ${'%' + userId + '%'}`);
      for (const article of coAuthoredArticles) {
        if (!Array.isArray(article.coAuthors)) continue;
        const updated = (
          article.coAuthors as {
            userId: string | null;
            screenname: string;
            status: string;
          }[]
        ).map((ca) =>
          ca.userId === userId
            ? {
                userId: null,
                screenname: 'Previous Member',
                status: 'removed',
              }
            : ca
        );
        await db
          .update(articles)
          .set({ coAuthors: updated })
          .where(eq(articles.id, article.id));
      }
    } catch (error) {
      warnings.push(
        `Failed to update co-author references: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // -------------------------------------------------------------------
    // 8. Delete social data (always fully deleted)
    // -------------------------------------------------------------------
    if (socialActor) {
      // Get all status IDs for this actor
      const actorStatuses = await db.query.socialStatuses.findMany({
        where: eq(socialStatuses.actorId, socialActor.id),
        columns: { id: true, uri: true },
        with: { attachments: { columns: { id: true, url: true } } },
      });
      const statusIds = actorStatuses.map((s) => s.id);

      if (statusIds.length > 0) {
        // Delete attachments
        await safeDelete(
          'socialAttachments',
          () =>
            db
              .delete(socialAttachments)
              .where(inArray(socialAttachments.statusId, statusIds))
              .returning({ id: socialAttachments.id }),
          deletedTables,
          warnings
        );
        // Delete tags
        await safeDelete(
          'socialTags',
          () =>
            db
              .delete(socialTags)
              .where(inArray(socialTags.statusId, statusIds))
              .returning({ id: socialTags.id }),
          deletedTables,
          warnings
        );
        // Delete likes ON these statuses (from other users)
        await safeDelete(
          'socialLikes(received)',
          () =>
            db
              .delete(socialLikes)
              .where(inArray(socialLikes.statusId, statusIds))
              .returning({ id: socialLikes.id }),
          deletedTables,
          warnings
        );
      }

      // Delete likes BY this actor
      await safeDelete(
        'socialLikes(given)',
        () =>
          db
            .delete(socialLikes)
            .where(eq(socialLikes.actorId, socialActor.id))
            .returning({ id: socialLikes.id }),
        deletedTables,
        warnings
      );

      // Delete follows (both directions)
      await safeDelete(
        'socialFollows(outgoing)',
        () =>
          db
            .delete(socialFollows)
            .where(eq(socialFollows.actorId, socialActor.id))
            .returning({ id: socialFollows.id }),
        deletedTables,
        warnings
      );
      await safeDelete(
        'socialFollows(incoming)',
        () =>
          db
            .delete(socialFollows)
            .where(eq(socialFollows.targetActorId, socialActor.id))
            .returning({ id: socialFollows.id }),
        deletedTables,
        warnings
      );

      // Delete article announcements by this actor
      await safeDelete(
        'articleAnnouncements',
        () =>
          db
            .delete(articleAnnouncements)
            .where(eq(articleAnnouncements.actorId, socialActor.id))
            .returning({ id: articleAnnouncements.id }),
        deletedTables,
        warnings
      );

      // Delete statuses
      if (statusIds.length > 0) {
        await safeDelete(
          'socialStatuses',
          () =>
            db
              .delete(socialStatuses)
              .where(inArray(socialStatuses.id, statusIds))
              .returning({ id: socialStatuses.id }),
          deletedTables,
          warnings
        );
      }

      // Delete social actor
      await safeDelete(
        'socialActors',
        () =>
          db
            .delete(socialActors)
            .where(eq(socialActors.id, socialActor.id))
            .returning({ id: socialActors.id }),
        deletedTables,
        warnings
      );
    }

    // -------------------------------------------------------------------
    // 9. Delete always-deletable data
    // -------------------------------------------------------------------
    await safeDelete(
      'notifications(sent)',
      () =>
        db
          .delete(notifications)
          .where(eq(notifications.actor, userId))
          .returning({ id: notifications.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'notifications(received)',
      () =>
        db
          .delete(notifications)
          .where(eq(notifications.target, userId))
          .returning({ id: notifications.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'consentReceipts',
      () =>
        db
          .delete(consentReceipts)
          .where(eq(consentReceipts.userId, userId))
          .returning({ id: consentReceipts.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'mentorSessions',
      () =>
        db
          .delete(mentorSessions)
          .where(
            or(
              eq(mentorSessions.mentorUserId, userId),
              eq(mentorSessions.menteeUserId, userId)
            )
          )
          .returning({ id: mentorSessions.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'intakeForms',
      () =>
        db
          .delete(intakeForms)
          .where(eq(intakeForms.email, user.email))
          .returning({ id: intakeForms.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'emailMigrations',
      () =>
        db
          .delete(emailMigrations)
          .where(eq(emailMigrations.userId, userId))
          .returning({ id: emailMigrations.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'interactions',
      () =>
        db
          .delete(interactions)
          .where(eq(interactions.email, user.email))
          .returning({ id: interactions.id }),
      deletedTables,
      warnings
    );

    // Remaining event organizer/attendee/note rows for this profile
    if (profile) {
      await safeDelete(
        'eventOrganizers',
        () =>
          db
            .delete(eventOrganizers)
            .where(eq(eventOrganizers.profileId, profile.id))
            .returning({ id: eventOrganizers.id }),
        deletedTables,
        warnings
      );
      await safeDelete(
        'eventAttendees',
        () =>
          db
            .delete(eventAttendees)
            .where(eq(eventAttendees.profileId, profile.id))
            .returning({ id: eventAttendees.id }),
        deletedTables,
        warnings
      );
      await safeDelete(
        'eventNotes',
        () =>
          db
            .delete(eventNotes)
            .where(eq(eventNotes.authorProfileId, profile.id))
            .returning({ id: eventNotes.id }),
        deletedTables,
        warnings
      );
    }

    // Article announcements by author (userId)
    await safeDelete(
      'articleAnnouncements(author)',
      () =>
        db
          .delete(articleAnnouncements)
          .where(eq(articleAnnouncements.authorId, userId))
          .returning({ id: articleAnnouncements.id }),
      deletedTables,
      warnings
    );

    // -------------------------------------------------------------------
    // 10. Third-party cleanup (best-effort)
    // -------------------------------------------------------------------

    // Stripe
    if (profile?.stripeCustomerId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
          apiVersion: '2026-03-25.dahlia',
        });
        // Cancel active subscriptions
        const subs = await stripe.subscriptions.list({
          customer: profile.stripeCustomerId,
          status: 'active',
        });
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
        await stripe.customers.del(profile.stripeCustomerId);
        thirdPartyResults.stripe = true;
      } catch (error) {
        console.error('delete-account:stripe:error', error);
        thirdPartyResults.stripe = false;
        warnings.push('Stripe cleanup failed');
      }
    }

    // GHL
    if (profile?.ghlContactId) {
      try {
        const ghl = GhlClient.create();
        if (ghl) {
          await ghl.deleteContact(profile.ghlContactId);
          thirdPartyResults.ghl = true;
        }
      } catch (error) {
        console.error('delete-account:ghl:error', error);
        thirdPartyResults.ghl = false;
        warnings.push('GHL cleanup failed');
      }
      // TODO(GHL): Trigger GoHighLevel flow email "Your account has been deleted"
    }

    // OAuth revocation
    try {
      const oauthResults = await revokeAllOAuthTokens(user.accounts);
      Object.assign(thirdPartyResults, oauthResults);
    } catch (error) {
      console.error('delete-account:oauth:error', error);
      warnings.push('OAuth token revocation failed');
    }

    // -------------------------------------------------------------------
    // 11. R2 media cleanup
    // -------------------------------------------------------------------
    const mediaUrls: string[] = [];
    if (profile) {
      if (profile.primaryImageCdn) mediaUrls.push(profile.primaryImageCdn);
      mediaUrls.push(...collectMediaUrls(profile.galleryImages));
    }
    for (const a of preArchiveArticles) {
      if (a.coverImage) mediaUrls.push(a.coverImage);
    }
    for (const e of preArchiveEvents) {
      if (e.coverImage) mediaUrls.push(e.coverImage);
    }
    for (const p of preArchivePhotos) {
      if (p.url) mediaUrls.push(p.url);
    }
    if (socialActor) {
      const actorStatuses = await db.query.socialStatuses
        .findMany({
          where: eq(socialStatuses.actorId, socialActor.id),
          with: { attachments: { columns: { url: true } } },
        })
        .catch(() => []);
      for (const s of actorStatuses) {
        for (const att of s.attachments) {
          if (att.url) mediaUrls.push(att.url);
        }
      }
    }

    for (const url of mediaUrls) {
      try {
        await deleteFile(url);
      } catch {
        warnings.push(`Failed to delete media: ${url}`);
      }
    }

    // -------------------------------------------------------------------
    // 12. ActivityPub cleanup
    // -------------------------------------------------------------------
    if (socialActor?.privateKey && socialActor.uri) {
      try {
        // Get followers to notify
        const followers = await db.query.socialFollows
          .findMany({
            where: eq(socialFollows.targetActorId, socialActor.id),
            with: {
              actor: { columns: { inboxUrl: true, sharedInboxUrl: true } },
            },
          })
          .catch(() => []);

        const deleteActivity = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: `${socialActor.uri}#delete`,
          type: 'Delete',
          actor: socialActor.uri,
          to: ['https://www.w3.org/ns/activitystreams#Public'],
          object: socialActor.uri,
        };

        // Deduplicate inboxes
        const inboxes = new Set<string>();
        for (const f of followers) {
          const inbox = f.actor?.sharedInboxUrl ?? f.actor?.inboxUrl;
          if (inbox) inboxes.add(inbox);
        }

        for (const inboxUrl of inboxes) {
          try {
            const headers = signedHeaders(
              socialActor,
              'post',
              inboxUrl,
              deleteActivity
            );
            await fetch(inboxUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(deleteActivity),
            });
          } catch {
            // Best-effort — don't warn for each failed federation delivery
          }
        }
      } catch (error) {
        console.error('delete-account:activitypub:error', error);
        warnings.push('ActivityPub deletion notifications partially failed');
      }
    }

    // -------------------------------------------------------------------
    // 13. Delete profile
    // -------------------------------------------------------------------
    if (profile) {
      if (options.attributionChoice === 'keep') {
        // Tombstone: clear sensitive fields but keep name for attribution
        await db
          .update(profiles)
          .set({
            userId: null,
            phoneNumber: null,
            pronouns: null,
            primaryImageId: null,
            primaryImageCdn: null,
            addressName: null,
            addressLine1: null,
            addressLine2: null,
            addressLine3: null,
            addressLocality: null,
            addressRegion: null,
            addressPostalCode: null,
            addressCountry: null,
            addressLat: null,
            addressLng: null,
            addressGooglePlaceId: null,
            addressHours: null,
            active: false,
            socials: null,
            galleryImages: null,
            mentoring: null,
            availability: null,
            verification: null,
            roles: null,
            gentedepana: null,
            status: null,
            administrative: null,
            linkedProfiles: null,
            ghlContactId: null,
            stripeCustomerId: null,
            neighborhoods: null,
            verifiedZipCode: null,
          })
          .where(eq(profiles.id, profile.id));
        deletedTables['profiles(tombstoned)'] = 1;
      } else {
        // Full delete
        await safeDelete(
          'profiles',
          () =>
            db
              .delete(profiles)
              .where(eq(profiles.id, profile.id))
              .returning({ id: profiles.id }),
          deletedTables,
          warnings
        );
      }
    }

    // -------------------------------------------------------------------
    // 14. Delete auth records
    // -------------------------------------------------------------------
    await safeDelete(
      'verification',
      () =>
        db
          .delete(verification)
          .where(eq(verification.identifier, user.email))
          .returning({ id: verification.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'sessions',
      () =>
        db
          .delete(sessions)
          .where(eq(sessions.userId, userId))
          .returning({ id: sessions.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'accounts',
      () =>
        db
          .delete(accounts)
          .where(eq(accounts.userId, userId))
          .returning({ id: accounts.id }),
      deletedTables,
      warnings
    );
    await safeDelete(
      'users',
      () =>
        db
          .delete(users)
          .where(eq(users.id, userId))
          .returning({ id: users.id }),
      deletedTables,
      warnings
    );

    // -------------------------------------------------------------------
    // 15. Keep screennameHistory (federation 410 Gone continues working)
    // -------------------------------------------------------------------
    // No action needed — rows are intentionally preserved.

    // -------------------------------------------------------------------
    // 16. Finalize deletion log
    // -------------------------------------------------------------------
    await db
      .update(deletionLogs)
      .set({
        completedAt: new Date(),
        deletedTables,
        thirdPartyResults,
        archivedContentIds,
      })
      .where(eq(deletionLogs.id, logId));

    return { success: true, deletionLogId: logId, warnings };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('delete-account:fatal', error);

    // Update log with error
    await db
      .update(deletionLogs)
      .set({
        error: msg,
        deletedTables,
        thirdPartyResults,
        archivedContentIds,
      })
      .where(eq(deletionLogs.id, logId))
      .catch(() => {});

    return { success: false, deletionLogId: logId, error: msg, warnings };
  }
}
