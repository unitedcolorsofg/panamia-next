/**
 * NodeInfo 2.0 Endpoint
 *
 * UPSTREAM REFERENCE: external/activities.next/app/api/well-known/nodeinfo/2.0/route.ts
 * Returns real database stats instead of hardcoded mock data (upstream #477).
 * Queries user, session, and status tables for total/active user counts and
 * local post count.
 *
 * @see https://nodeinfo.diaspora.software/schema/2.0
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, socialStatuses, socialActors } from '@/lib/schema';
import { count, countDistinct, gte, eq, isNotNull } from 'drizzle-orm';
import { socialConfig } from '@/lib/federation';
import { corsHeaders } from '@/lib/federation/cors';

export async function GET() {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const [totalResult, activeMonthResult, activeHalfyearResult, postsResult] =
    await Promise.all([
      // Total users with social actors (i.e. federation-enabled)
      db
        .select({ total: count() })
        .from(socialActors)
        .where(isNotNull(socialActors.profileId)),

      // Active users in last 30 days (distinct users with recent sessions)
      db
        .select({ total: countDistinct(sessions.userId) })
        .from(sessions)
        .where(gte(sessions.updatedAt, oneMonthAgo)),

      // Active users in last 6 months
      db
        .select({ total: countDistinct(sessions.userId) })
        .from(sessions)
        .where(gte(sessions.updatedAt, sixMonthsAgo)),

      // Local posts (statuses from local actors, not drafts)
      db
        .select({ total: count() })
        .from(socialStatuses)
        .where(eq(socialStatuses.isDraft, false)),
    ]);

  return NextResponse.json(
    {
      version: '2.0',
      software: {
        name: 'panamia-club',
        version: process.env.npm_package_version || '0.1.0',
      },
      protocols: ['activitypub'],
      services: {
        outbound: [],
        inbound: [],
      },
      usage: {
        users: {
          total: Number(totalResult[0].total),
          activeMonth: Number(activeMonthResult[0].total),
          activeHalfyear: Number(activeHalfyearResult[0].total),
        },
        localPosts: Number(postsResult[0].total),
      },
      openRegistrations: false,
      metadata: {
        nodeName: socialConfig.instanceName,
        nodeDescription: socialConfig.instanceDescription || '',
      },
    },
    {
      headers: {
        ...corsHeaders('GET'),
        'Cache-Control': 'max-age=1800',
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders('GET', 'OPTIONS'),
  });
}
