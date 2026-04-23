import { db } from '@/lib/db';
import { articles, profiles, users } from '@/lib/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
};

const SITE_URL = process.env.NEXT_PUBLIC_HOST_URL ?? 'https://pana.social';

const STATIC_ROUTES: SitemapEntry[] = [
  { url: SITE_URL, priority: 1.0, changeFrequency: 'weekly' },
  { url: `${SITE_URL}/about-us`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/a`, changeFrequency: 'daily' },
  { url: `${SITE_URL}/directorio`, changeFrequency: 'weekly' },
  { url: `${SITE_URL}/donate`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/podcasts`, changeFrequency: 'weekly' },
  { url: `${SITE_URL}/m/discover`, changeFrequency: 'weekly' },
  { url: `${SITE_URL}/form/become-a-pana`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/form/contact-us`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/form/join-the-team`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/legal/terms`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/legal/privacy`, changeFrequency: 'monthly' },
  { url: `${SITE_URL}/legal/dmca`, changeFrequency: 'monthly' },
  {
    url: `${SITE_URL}/doc/affiliate-terms-and-conditions`,
    changeFrequency: 'monthly',
  },
  {
    url: `${SITE_URL}/event/panimo-by-pana-mia`,
    changeFrequency: 'monthly',
  },
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const [publishedArticles, publicProfiles] = await Promise.all([
    db.query.articles.findMany({
      where: eq(articles.status, 'published'),
      columns: { slug: true, updatedAt: true },
    }),
    db
      .select({ screenname: users.screenname, updatedAt: profiles.updatedAt })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(and(isNotNull(users.screenname), eq(profiles.active, true))),
  ]);

  const articleRoutes: SitemapEntry[] = publishedArticles.map((a) => ({
    url: `${SITE_URL}/a/${a.slug}`,
    lastModified: a.updatedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const profileRoutes: SitemapEntry[] = publicProfiles.map((p) => ({
    url: `${SITE_URL}/p/${p.screenname}`,
    lastModified: p.updatedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...STATIC_ROUTES, ...articleRoutes, ...profileRoutes];
}
