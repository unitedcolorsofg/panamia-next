/**
 * Tag-filtered RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS feed of articles by tag
 */

import { NextRequest } from 'next/server';
import { Feed } from 'feed';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://panamia.club';

interface RouteParams {
  params: Promise<{ tag: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag).toLowerCase();

    await dbConnect();

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
    const articles = await article
      .find({ status: 'published', tags: decodedTag })
      .sort({ publishedAt: -1 })
      .limit(50)
      .lean();

    // Get author info
    const authorIds = [
      ...new Set(articles.map((a: any) => a.authorId.toString())),
    ];
    const authors = await user.find({ _id: { $in: authorIds } }).lean();
    const authorMap = new Map(
      authors.map((a: any) => [
        a._id.toString(),
        { screenname: a.screenname, name: a.name },
      ])
    );

    for (const art of articles) {
      const artAny = art as any;
      const author = authorMap.get(artAny.authorId.toString());
      const authorName = author?.screenname
        ? `@${author.screenname}`
        : author?.name || 'Anonymous';

      feed.addItem({
        title: artAny.title,
        id: `${SITE_URL}/articles/${artAny.slug}`,
        link: `${SITE_URL}/articles/${artAny.slug}`,
        description: artAny.excerpt || '',
        author: [{ name: authorName }],
        date: new Date(artAny.publishedAt),
        category: artAny.tags?.map((t: string) => ({ name: t })) || [],
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
