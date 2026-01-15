#!/usr/bin/env npx tsx
/**
 * Migrate Articles from MongoDB to PostgreSQL
 *
 * This script migrates the articles collection from MongoDB to PostgreSQL.
 * It maps MongoDB user ObjectIds to PostgreSQL user IDs (cuid format) via email.
 *
 * Prerequisites:
 * - Run auth migration first (import-auth-data.ts)
 * - Both MONGODB_URI and POSTGRES_URL must be set
 *
 * What gets migrated:
 * - All article fields
 * - authorId mapped to PostgreSQL user ID
 * - coAuthors[].userId mapped to PostgreSQL user IDs
 * - reviewedBy.userId mapped to PostgreSQL user ID
 * - inReplyTo preserved as article reference (looked up by slug)
 *
 * Usage: npx tsx scripts/migrate-articles.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

interface MongoCoAuthor {
  userId: ObjectId;
  invitedAt?: Date;
  invitationMessage?: string;
  status: 'pending' | 'accepted' | 'declined';
  acceptedAt?: Date;
}

interface MongoReviewComment {
  id: string;
  text: string;
  contentRef?: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt?: Date;
}

interface MongoReviewRecord {
  userId: ObjectId;
  requestedAt?: Date;
  invitationMessage?: string;
  status: 'pending' | 'approved' | 'revision_needed';
  checklist?: {
    factsVerified: boolean;
    sourcesChecked: boolean;
    communityStandards: boolean;
  };
  comments?: MongoReviewComment[];
  approvedAt?: Date;
}

interface MongoArticle {
  _id: ObjectId;
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  articleType: 'business_update' | 'community_commentary';
  tags?: string[];
  authorId: ObjectId;
  authorEmail?: string;
  coAuthors?: MongoCoAuthor[];
  reviewedBy?: MongoReviewRecord;
  inReplyTo?: ObjectId;
  status: string;
  publishedAt?: Date;
  removedAt?: Date;
  removedBy?: ObjectId;
  removalReason?: string;
  readingTime?: number;
  mastodonPostUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoUser {
  _id: ObjectId;
  email: string;
}

async function migrateArticles() {
  console.log('\n📰 Migrating Articles from MongoDB to PostgreSQL\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is required');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('Connected to MongoDB\n');

    // Build user ID mapping: MongoDB ObjectId -> PostgreSQL cuid
    console.log('Building user ID mapping...');
    const mongoUsers = await db
      .collection<MongoUser>('users')
      .find({})
      .toArray();
    const pgUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    // Create email -> PostgreSQL ID map
    const emailToPgId = new Map<string, string>();
    for (const user of pgUsers) {
      emailToPgId.set(user.email.toLowerCase(), user.id);
    }

    // Create MongoDB ObjectId -> PostgreSQL ID map
    const mongoIdToPgId = new Map<string, string>();
    for (const mongoUser of mongoUsers) {
      const pgId = emailToPgId.get(mongoUser.email.toLowerCase());
      if (pgId) {
        mongoIdToPgId.set(mongoUser._id.toString(), pgId);
      }
    }

    console.log(`  Mapped: ${mongoIdToPgId.size} users\n`);

    // Fetch articles from MongoDB
    console.log('Fetching articles from MongoDB...');
    const articles = await db
      .collection<MongoArticle>('articles')
      .find({})
      .toArray();
    console.log(`  Found: ${articles.length} articles\n`);

    if (articles.length === 0) {
      console.log('✅ No articles to migrate\n');
      return;
    }

    // First pass: create slug -> article map for threading
    const slugToMongoId = new Map<string, string>();
    for (const article of articles) {
      slugToMongoId.set(article._id.toString(), article.slug);
    }

    // Process articles
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const toInsert: any[] = [];

    for (const article of articles) {
      // Map author to PostgreSQL ID
      let authorPgId = mongoIdToPgId.get(article.authorId.toString());

      // Fallback: try using authorEmail if present
      if (!authorPgId && article.authorEmail) {
        authorPgId = emailToPgId.get(article.authorEmail.toLowerCase());
      }

      if (!authorPgId) {
        console.log(
          `  Skipping "${article.slug}": author not found in PostgreSQL`
        );
        skipped++;
        continue;
      }

      // Map coAuthors
      const coAuthors = (article.coAuthors || []).map((ca) => {
        const pgId = mongoIdToPgId.get(ca.userId.toString());
        return {
          userId: pgId || ca.userId.toString(), // Keep original if not mapped
          invitedAt: ca.invitedAt?.toISOString(),
          invitationMessage: ca.invitationMessage,
          status: ca.status,
          acceptedAt: ca.acceptedAt?.toISOString(),
        };
      });

      // Map reviewedBy
      let reviewedBy = null;
      if (article.reviewedBy) {
        const reviewerPgId = mongoIdToPgId.get(
          article.reviewedBy.userId.toString()
        );
        reviewedBy = {
          userId: reviewerPgId || article.reviewedBy.userId.toString(),
          requestedAt: article.reviewedBy.requestedAt?.toISOString(),
          invitationMessage: article.reviewedBy.invitationMessage,
          status: article.reviewedBy.status,
          checklist: article.reviewedBy.checklist,
          comments: article.reviewedBy.comments?.map((c) => ({
            ...c,
            createdAt: c.createdAt?.toISOString(),
            resolvedAt: c.resolvedAt?.toISOString(),
          })),
          approvedAt: article.reviewedBy.approvedAt?.toISOString(),
        };
      }

      // Map inReplyTo (we'll resolve this in a second pass)
      const inReplyTo = article.inReplyTo
        ? slugToMongoId.get(article.inReplyTo.toString())
        : null;

      // Map removedBy
      const removedByPgId = article.removedBy
        ? mongoIdToPgId.get(article.removedBy.toString())
        : null;

      // Validate status
      const validStatuses = [
        'draft',
        'pending_review',
        'revision_needed',
        'published',
        'removed',
      ];
      const status = validStatuses.includes(article.status)
        ? article.status
        : 'draft';

      // Validate articleType
      const validTypes = ['business_update', 'community_commentary'];
      if (!validTypes.includes(article.articleType)) {
        console.log(
          `  Skipping "${article.slug}": invalid articleType "${article.articleType}"`
        );
        skipped++;
        continue;
      }

      toInsert.push({
        id: article._id.toString(),
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        slug: article.slug,
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || null,
        coverImage: article.coverImage || null,
        articleType: article.articleType as any,
        tags: article.tags || [],
        authorId: authorPgId,
        coAuthors: coAuthors,
        reviewedBy: reviewedBy,
        inReplyTo: null, // Will be resolved in second pass
        inReplyToSlug: inReplyTo, // Temporary for second pass
        status: status as any,
        publishedAt: article.publishedAt || null,
        removedAt: article.removedAt || null,
        removedBy: removedByPgId,
        removalReason: article.removalReason || null,
        readingTime: article.readingTime || 1,
        mastodonPostUrl: article.mastodonPostUrl || null,
      });

      migrated++;
    }

    console.log(`📊 Migration summary:`);
    console.log(`  To migrate: ${migrated}`);
    console.log(`  Skipped (missing author): ${skipped}`);
    console.log('');

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN - Skipping database writes\n');
      if (toInsert.length > 0) {
        console.log('Sample article to insert:');
        const sample = { ...toInsert[0] };
        sample.content = sample.content.substring(0, 100) + '...';
        console.log(JSON.stringify(sample, null, 2));
      }
    } else if (toInsert.length > 0) {
      console.log('Inserting articles into PostgreSQL...');

      // First pass: insert all articles without inReplyTo
      const slugToId = new Map<string, string>();

      for (const article of toInsert) {
        const { inReplyToSlug, ...data } = article;
        try {
          const created = await prisma.article.upsert({
            where: { id: data.id },
            update: data,
            create: data,
          });
          slugToId.set(data.slug, created.id);
        } catch (error) {
          console.error(`  Error inserting article ${data.slug}:`, error);
          errors++;
        }
      }

      console.log(`  Inserted ${slugToId.size} articles`);

      // Second pass: update inReplyTo references
      console.log('  Resolving article threading...');
      let threaded = 0;

      for (const article of toInsert) {
        if (article.inReplyToSlug) {
          const parentId = slugToId.get(article.inReplyToSlug);
          if (parentId) {
            try {
              await prisma.article.update({
                where: { id: article.id },
                data: { inReplyTo: parentId },
              });
              threaded++;
            } catch (error) {
              console.error(
                `  Error updating inReplyTo for ${article.slug}:`,
                error
              );
            }
          }
        }
      }

      console.log(`  Resolved ${threaded} thread references`);
      console.log('');
    }

    console.log('✅ Migration complete!');
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    if (errors > 0) {
      console.log(`  Errors: ${errors}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
    console.log('Database connections closed.');
  }
}

migrateArticles();
