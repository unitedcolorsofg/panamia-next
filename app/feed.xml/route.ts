/**
 * RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS 2.0 feed of all published articles
 */

import { Feed } from 'feed';
import { getPrisma } from '@/lib/prisma';

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL || 'https://panamia.club';

async function generateFeed() {
  const prisma = await getPrisma();

  const feed = new Feed({
    title: 'Pana MIA Community Articles',
    description:
      'Stories, updates, and perspectives from the South Florida community',
    id: SITE_URL,
    link: `${SITE_URL}/articles`,
    language: 'en',
    image: `${SITE_URL}/logo.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, Pana MIA`,
    feedLinks: {
      rss2: `${SITE_URL}/feed.xml`,
      json: `${SITE_URL}/feed.json`,
    },
  });

  // Get recent published articles
  const articles = await prisma.article.findMany({
    where: { status: 'published' },
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
      content: art.content,
      author: [{ name: authorName }],
      date: new Date(art.publishedAt!),
      category: art.tags?.map((tag: string) => ({ name: tag })) || [],
      image: art.coverImage || undefined,
    });
  }

  return feed;
}

export async function GET() {
  try {
    const feed = await generateFeed();

    return new Response(feed.rss2(), {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
