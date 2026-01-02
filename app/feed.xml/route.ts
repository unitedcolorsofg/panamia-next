/**
 * RSS Feed
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * RSS 2.0 feed of all published articles
 */

import { Feed } from 'feed';
import dbConnect from '@/lib/connectdb';
import article from '@/lib/model/article';
import user from '@/lib/model/user';

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL || 'https://panamia.club';

async function generateFeed() {
  await dbConnect();

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
  const articles = await article
    .find({ status: 'published' })
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
      content: artAny.content,
      author: [{ name: authorName }],
      date: new Date(artAny.publishedAt),
      category: artAny.tags?.map((tag: string) => ({ name: tag })) || [],
      image: artAny.coverImage,
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
