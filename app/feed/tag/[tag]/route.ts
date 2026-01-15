/**
 * Tag-filtered RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS feed of articles by tag
 */

import { NextRequest } from 'next/server';
import { Feed } from 'feed';
import { getPrisma } from '@/lib/prisma';

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL || 'https://panamia.club';

interface RouteParams {
  params: Promise<{ tag: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag).toLowerCase();

    const prisma = await getPrisma();

    const feed = new Feed({
      title: `Pana MIA Articles - #${decodedTag}`,
      description: `Articles tagged with #${decodedTag}`,
      id: `${SITE_URL}/articles?tag=${decodedTag}`,
      link: `${SITE_URL}/articles?tag=${decodedTag}`,
      language: 'en',
      copyright: `All rights reserved ${new Date().getFullYear()}, Pana MIA`,
      feedLinks: {
        rss2: `${SITE_URL}/feed/tag/${decodedTag}`,
      },
    });

    // Get articles with this tag
    const articles = await prisma.article.findMany({
      where: { status: 'published', tags: { has: decodedTag } },
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
        id: `${SITE_URL}/articles/${art.slug}`,
        link: `${SITE_URL}/articles/${art.slug}`,
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
    console.error('Error generating tag feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
