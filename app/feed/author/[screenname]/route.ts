/**
 * Author RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS feed of articles by author screenname
 */

import { NextRequest } from 'next/server';
import { Feed } from 'feed';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL || 'https://panamia.club';

interface RouteParams {
  params: Promise<{ screenname: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { screenname } = await params;
    const decodedScreenname = decodeURIComponent(screenname);

    await dbConnect();

    // Find author by screenname
    const author = await user.findOne({ screenname: decodedScreenname }).lean();
    if (!author) {
      return new Response('Author not found', { status: 404 });
    }

    const authorAny = author as any;
    const authorName = authorAny.screenname
      ? `@${authorAny.screenname}`
      : authorAny.name || 'Anonymous';

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

    // Get articles by this author (including co-authored)
    const articles = await article
      .find({
        status: 'published',
        $or: [
          { authorId: authorAny._id },
          { 'coAuthors.userId': authorAny._id, 'coAuthors.status': 'accepted' },
        ],
      })
      .sort({ publishedAt: -1 })
      .limit(50)
      .lean();

    for (const art of articles) {
      const artAny = art as any;

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
    console.error('Error generating author feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
