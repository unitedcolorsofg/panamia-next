import { db } from '@/lib/db';
import { articles, profiles, users } from '@/lib/schema';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';

type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?:
    'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
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
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const [publishedArticles, publicProfiles] = await Promise.all([
    db.query.articles.findMany({
      where: eq(articles.status, 'published'),
      columns: { slug: true, updatedAt: true },
    }),
    db
      .select({
        screenname: sql<
          string | null
        >`COALESCE(${profiles.screenname}, ${users.screenname})`,
        updatedAt: profiles.updatedAt,
      })
      // Driven from `profiles`, with a LEFT join: a business listing submitted
      // through /form/list-your-business keeps `profiles.userId` NULL
      // permanently and is administered through `profileOwners`, so driving
      // from `users` dropped every listing in the directory before any filter
      // below could run. /p/[handle] resolves the profile's own screenname
      // first and falls back to its owner's, so a listing carries its handle
      // here without a user row. Same construct as getSearch(), featured and
      // suggest.
      .from(profiles)
      .leftJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          sql`COALESCE(${profiles.screenname}, ${users.screenname}) IS NOT NULL`,
          // Also the gate on unapproved submissions: /form/list-your-business
          // writes active: false until a human approves it, and
          // delete-account's tombstone clears it. Not merely a liveness check.
          eq(profiles.active, true),
          // Members are not listings. Every signed-in user has an active
          // profile now, so without this the sitemap would publish every
          // personal account to search engines. A listing with no user carries
          // no account type to test and is a listing by definition.
          or(
            isNull(profiles.userId),
            inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES)
          )
        )
      ),
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
