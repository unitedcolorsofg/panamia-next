/**
 * Author RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS feed of articles by author screenname
 */

import { NextRequest } from 'next/server';
import { Feed } from 'feed';
import { getPrisma } from '@/lib/prisma';

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL || 'https://panamia.club';

interface RouteParams {
  params: Promise<{ screenname: string }>;
}

interface CoAuthor {
  userId: string;
  status: string;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { screenname } = await params;
    const decodedScreenname = decodeURIComponent(screenname);

    const prisma = await getPrisma();

    // Find author by screenname
    const author = await prisma.user.findFirst({
      where: { screenname: decodedScreenname },
      select: { id: true, screenname: true },
    });
    if (!author) {
      return new Response('Author not found', { status: 404 });
    }

    const authorName = author.screenname
      ? `@${author.screenname}`
      : 'Anonymous';

    const feed = new Feed({
      title: `Pana MIA Articles by ${authorName}`,
      description: `Articles written by ${authorName}`,
      id: `${SITE_URL}/feed/author/${decodedScreenname}`,
      link: `${SITE_URL}/articles`,
      language: 'en',
      copyright: `All rights reserved ${new Date().getFullYear()}, Pana MIA`,
      feedLinks: {
        rss2: `${SITE_URL}/feed/author/${decodedScreenname}`,
      },
    });

    // Get articles by this author (primary author)
    const primaryArticles = await prisma.article.findMany({
      where: { status: 'published', authorId: author.id },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    // Get articles where this user is a co-author
    const allPublishedArticles = await prisma.article.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });
    const coAuthoredArticles = allPublishedArticles.filter((art) => {
      const coAuthors = (art.coAuthors as unknown as CoAuthor[]) || [];
      return coAuthors.some(
        (ca) => ca.userId === author.id && ca.status === 'accepted'
      );
    });

    // Combine and dedupe
    const articleMap = new Map(primaryArticles.map((a) => [a.id, a]));
    for (const art of coAuthoredArticles) {
      if (!articleMap.has(art.id)) {
        articleMap.set(art.id, art);
      }
    }
    const articles = Array.from(articleMap.values())
      .sort(
        (a, b) =>
          new Date(b.publishedAt!).getTime() -
          new Date(a.publishedAt!).getTime()
      )
      .slice(0, 50);

    for (const art of articles) {
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
    console.error('Error generating author feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
