/**
 * User Data Migration Script
 *
 * Migrates user-related data from MongoDB to PostgreSQL:
 * - User additional fields (accountType, alternateEmails, notificationPreferences)
 * - Following relationships (MongoDB followers collection → user_follows)
 * - User lists (MongoDB userlist collection → user_lists + user_list_members)
 *
 * Prerequisites:
 * - PostgreSQL users table must exist with user records
 * - Run after: migrate-profiles.ts
 *
 * Usage:
 *   npx tsx scripts/migrate-users.ts [--dry-run]
 */

import mongoose from 'mongoose';
import { PrismaClient, AccountType } from '@prisma/client';

// MongoDB schemas (inline to avoid import issues)
const userSchema = new mongoose.Schema(
  {
    email: String,
    screenname: String,
    name: String,
    accountType: String,
    status: {
      role: String,
      locked: Date,
    },
    affiliate: mongoose.Schema.Types.Mixed,
    alternate_emails: [String],
    zip_code: String,
    following: [String],
    notificationPreferences: {
      coauthorInvites: { type: Boolean, default: true },
      reviewRequests: { type: Boolean, default: true },
      articlePublished: { type: Boolean, default: true },
      articleReplies: { type: Boolean, default: true },
      revisionNeeded: { type: Boolean, default: true },
      mentoringRequests: { type: Boolean, default: true },
      systemAnnouncements: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const followersSchema = new mongoose.Schema({
  followerId: String,
  followerUserName: String,
  followedUserName: String,
  userId: String,
});

const userlistSchema = new mongoose.Schema(
  {
    user_id: String,
    name: String,
    desc: String,
    public: Boolean,
    profiles: [String],
  },
  { timestamps: true }
);

const MongoUser = mongoose.models.user || mongoose.model('user', userSchema);
const Followers =
  mongoose.models.followers || mongoose.model('followers', followersSchema);
const UserList =
  mongoose.models.userlist || mongoose.model('userlist', userlistSchema);

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

function mapAccountType(mongoType: string | undefined): AccountType {
  switch (mongoType) {
    case 'small_business':
      return 'small_business';
    case 'hybrid':
      return 'hybrid';
    case 'other':
      return 'other';
    default:
      return 'personal';
  }
}

async function migrateUserFields() {
  console.log('\n📋 Migrating user fields...');

  const mongoUsers = await MongoUser.find({}).lean();
  console.log(`Found ${mongoUsers.length} MongoDB users`);

  let updated = 0;
  let skipped = 0;

  for (const mongoUser of mongoUsers) {
    const email = mongoUser.email?.toLowerCase();
    if (!email) {
      console.log(`  ⚠️  Skipping user without email`);
      skipped++;
      continue;
    }

    // Find corresponding PostgreSQL user
    const pgUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!pgUser) {
      console.log(`  ⚠️  No PostgreSQL user found for: ${email}`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`  [DRY RUN] Would update user: ${email}`);
      updated++;
      continue;
    }

    await prisma.user.update({
      where: { id: pgUser.id },
      data: {
        accountType: mapAccountType(mongoUser.accountType),
        lockedAt: mongoUser.status?.locked || null,
        alternateEmails: mongoUser.alternate_emails || [],
        notificationPreferences: mongoUser.notificationPreferences || null,
      },
    });

    updated++;
  }

  console.log(`✅ Updated ${updated} users, skipped ${skipped}`);
}

async function migrateFollowing() {
  console.log('\n👥 Migrating following relationships...');

  // Get all following relationships from MongoDB followers collection
  const mongoFollows = await Followers.find({}).lean();
  console.log(`Found ${mongoFollows.length} MongoDB follow records`);

  // Also check the user.following[] arrays
  const usersWithFollowing = await MongoUser.find({
    following: { $exists: true, $ne: [] },
  }).lean();
  console.log(`Found ${usersWithFollowing.length} users with following arrays`);

  let created = 0;
  let skipped = 0;
  const processedPairs = new Set<string>();

  // Process followers collection
  for (const follow of mongoFollows) {
    // The followers collection uses screennames, need to look up by screenname
    const follower = await prisma.user.findFirst({
      where: {
        OR: [
          { screenname: follow.followerUserName },
          { id: follow.followerId },
        ],
      },
    });

    const following = await prisma.user.findFirst({
      where: {
        OR: [{ screenname: follow.followedUserName }, { id: follow.userId }],
      },
    });

    if (!follower || !following) {
      skipped++;
      continue;
    }

    const pairKey = `${follower.id}:${following.id}`;
    if (processedPairs.has(pairKey)) {
      continue;
    }
    processedPairs.add(pairKey);

    if (isDryRun) {
      console.log(
        `  [DRY RUN] Would create follow: ${follower.screenname} → ${following.screenname}`
      );
      created++;
      continue;
    }

    try {
      await prisma.userFollow.create({
        data: {
          followerId: follower.id,
          followingId: following.id,
        },
      });
      created++;
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Unique constraint violation - already exists
        skipped++;
      } else {
        throw e;
      }
    }
  }

  // Process user.following[] arrays
  for (const user of usersWithFollowing) {
    const follower = await prisma.user.findUnique({
      where: { email: user.email?.toLowerCase() },
    });

    if (!follower) continue;

    for (const followingId of user.following || []) {
      // following array might contain emails or IDs
      const following = await prisma.user.findFirst({
        where: {
          OR: [
            { email: followingId.toLowerCase() },
            { id: followingId },
            { screenname: followingId },
          ],
        },
      });

      if (!following) continue;

      const pairKey = `${follower.id}:${following.id}`;
      if (processedPairs.has(pairKey)) {
        continue;
      }
      processedPairs.add(pairKey);

      if (isDryRun) {
        console.log(
          `  [DRY RUN] Would create follow: ${follower.screenname} → ${following.screenname}`
        );
        created++;
        continue;
      }

      try {
        await prisma.userFollow.create({
          data: {
            followerId: follower.id,
            followingId: following.id,
          },
        });
        created++;
      } catch (e: any) {
        if (e.code === 'P2002') {
          skipped++;
        } else {
          throw e;
        }
      }
    }
  }

  console.log(`✅ Created ${created} follow relationships, skipped ${skipped}`);
}

async function migrateUserLists() {
  console.log('\n📝 Migrating user lists...');

  const mongoLists = await UserList.find({}).lean();
  console.log(`Found ${mongoLists.length} MongoDB user lists`);

  let listsCreated = 0;
  let membersCreated = 0;
  let skipped = 0;

  for (const mongoList of mongoLists) {
    // Find owner by user_id (could be email, screenname, or ID)
    const owner = await prisma.user.findFirst({
      where: {
        OR: [
          { email: mongoList.user_id?.toLowerCase() },
          { id: mongoList.user_id },
          { screenname: mongoList.user_id },
        ],
      },
    });

    if (!owner) {
      console.log(
        `  ⚠️  No owner found for list: ${mongoList.name} (user_id: ${mongoList.user_id})`
      );
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(
        `  [DRY RUN] Would create list: "${mongoList.name}" for ${owner.screenname || owner.email}`
      );
      listsCreated++;
      continue;
    }

    // Create the list
    const list = await prisma.userList.create({
      data: {
        ownerId: owner.id,
        name: mongoList.name || 'Unnamed List',
        description: mongoList.desc || null,
        isPublic: mongoList.public || false,
        createdAt: (mongoList as any).createdAt || new Date(),
        updatedAt: (mongoList as any).updatedAt || new Date(),
      },
    });
    listsCreated++;

    // Add members
    for (const profileId of mongoList.profiles || []) {
      // profiles array might contain profile IDs, emails, or slugs
      // First check if there's a profile with this ID, then find the associated user
      const profile = await prisma.profile.findFirst({
        where: {
          OR: [
            { id: profileId },
            { email: profileId.toLowerCase?.() || profileId },
            { slug: profileId },
          ],
        },
      });

      let userId: string | null = null;

      if (profile?.userId) {
        userId = profile.userId;
      } else {
        // Try finding user directly
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { id: profileId },
              { email: profileId.toLowerCase?.() || profileId },
              { screenname: profileId },
            ],
          },
        });
        userId = user?.id || null;
      }

      if (!userId) continue;

      if (isDryRun) {
        membersCreated++;
        continue;
      }

      try {
        await prisma.userListMember.create({
          data: {
            listId: list.id,
            userId,
          },
        });
        membersCreated++;
      } catch (e: any) {
        if (e.code !== 'P2002') throw e;
      }
    }
  }

  console.log(
    `✅ Created ${listsCreated} lists with ${membersCreated} members, skipped ${skipped}`
  );
}

async function main() {
  console.log('🚀 Starting user data migration...');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  try {
    await migrateUserFields();
    await migrateFollowing();
    await migrateUserLists();

    console.log('\n🎉 Migration complete!');
    if (isDryRun) {
      console.log('This was a dry run. No data was modified.');
      console.log('Run without --dry-run to perform the actual migration.');
    }
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
