/**
 * Article Type RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS feed of articles by type (business_update or community_commentary)
 */

import { NextRequest } from 'next/server';
import { Feed } from 'feed';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://panamia.club';

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

    await dbConnect();

    const typeLabel = TYPE_LABELS[type] || type;

    const feed = new Feed({
      title: `Pana MIA ${typeLabel}`,
      description: `${typeLabel} from the South Florida community`,
      id: `${SITE_URL}/articles?type=${type}`,
      link: `${SITE_URL}/articles?type=${type}`,
      language: 'en',
      copyright: `All rights reserved ${new Date().getFullYear()}, Pana MIA`,
      feedLinks: {
        rss2: `${SITE_URL}/feed/type/${type}`,
      },
    });

    // Get articles of this type
    const articles = await article
      .find({ status: 'published', articleType: type })
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
    console.error('Error generating type feed:', error);
    return new Response('Error generating feed', { status: 500 });
  }
}
