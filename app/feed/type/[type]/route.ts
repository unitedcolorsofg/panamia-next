/**
 * Article Type RSS Feed
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/timelines/
 * RSS feed of articles by type (business_update or community_commentary)
 */

import { NextRequest } from 'next/server';
import { Feed } from 'feed';
import { getPrisma } from '@/lib/prisma';

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL || 'https://panamia.club';

interface RouteParams {
  params: Promise<{ type: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  business_update: 'Business Updates',
  community_commentary: 'Community Commentary',
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!['business_update', 'community_commentary'].includes(type)) {
      return new Response('Invalid article type', { status: 400 });
    }

    const prisma = await getPrisma();

    const typeLabel = TYPE_LABELS[type] || type;

    const feed = new Feed({
      title: `Pana MIA ${typeLabel}`,
      description: `${typeLabel} from the South Florida community`,
      id: `${SITE_URL}/a?type=${type}`,
      link: `${SITE_URL}/a?type=${type}`,
      language: 'en',
      copyright: `All rights reserved ${new Date().getFullYear()}, Pana MIA`,
      feedLinks: {
        rss2: `${SITE_URL}/feed/type/${type}`,
      },
    });

    // Get articles of this type
    const articles = await prisma.article.findMany({
      where: { status: 'published', articleType: type as any },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    // Get author info
    const authorIds = [...new Set(articles.map((a) => a.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, screenname: true },
    });
    const authorMap = new Map(
      authors.map((a) => [a.id, { screenname: a.screenname }])
    );

    for (const art of articles) {
      const author = authorMap.get(art.authorId);
      const authorName = author?.screenname
        ? `@${author.screenname}`
        : 'Anonymous';

      feed.addItem({
        title: art.title,
        id: `${SITE_URL}/a/${art.slug}`,
        link: `${SITE_URL}/a/${art.slug}`,
        description: art.excerpt || '',
        author: [{ name: authorName }],
        date: new Date(art.publishedAt!),
        category: art.tags?.map((t: string) => ({ name: t })) || [],
      });
    }

    return new Response(feed.rss2(), {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating type feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
