require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { nanoid } = require('nanoid');

const MONGODB_URI = process.env.MONGODB_URI;

// Sample data for generating realistic sessions
const EXPERTISE_AREAS = [
  'Web Development',
  'Mobile Development',
  'Data Science',
  'UI/UX Design',
  'Digital Marketing',
  'Photography',
  'Writing',
  'Business Strategy',
  'Career Coaching',
  'Language Teaching',
];

const TOPICS = [
  'Portfolio Review',
  'Career Guidance',
  'Technical Interview Prep',
  'Project Consultation',
  'Skill Development',
  'Industry Insights',
  'Networking Strategies',
  'Tools and Best Practices',
  'Freelancing Tips',
  'Building Your Brand',
];

const MENTOR_NAMES = [
  'Alex Rivera',
  'Jordan Chen',
  'Sam Taylor',
  'Morgan Lee',
  'Casey Johnson',
  'Riley Davis',
  'Avery Martinez',
  'Quinn Anderson',
];

const MENTEE_NAMES = [
  'Emma Wilson',
  'Liam Brown',
  'Sophia Garcia',
  'Noah Rodriguez',
  'Olivia Martinez',
  'Ethan Hernandez',
  'Ava Lopez',
  'Mason Gonzalez',
  'Isabella Perez',
  'Lucas Sanchez',
];

function generateEmail(name) {
  return name.toLowerCase().replace(' ', '.') + '@example.com';
}

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSessionDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(randomInt(9, 17), randomInt(0, 59), 0, 0);
  return date;
}

async function seedData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected successfully!');

    const db = client.db();
    const profilesCollection = db.collection('profiles');
    const sessionsCollection = db.collection('mentorSessions');

    // Step 1: Create/update mentor profiles
    console.log('\n📝 Creating mentor profiles...');
    for (const mentorName of MENTOR_NAMES) {
      const mentorEmail = generateEmail(mentorName);
      const expertise = [
        randomElement(EXPERTISE_AREAS),
        randomElement(EXPERTISE_AREAS),
      ];

      await profilesCollection.updateOne(
        { email: mentorEmail },
        {
          $set: {
            name: mentorName,
            email: mentorEmail,
            slug: mentorName.toLowerCase().replace(' ', '-'),
            active: true,
            'mentoring.enabled': true,
            'mentoring.expertise': expertise,
            'mentoring.languages': ['English'],
            'mentoring.bio': `Experienced ${expertise[0]} professional helping others grow their skills.`,
            'mentoring.hourlyRate': randomInt(0, 100),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
    console.log(`✓ Created ${MENTOR_NAMES.length} mentor profiles`);

    // Step 2: Delete existing test sessions (optional - comment out to keep existing data)
    console.log('\n🗑️  Clearing existing test sessions...');
    const deleteResult = await sessionsCollection.deleteMany({
      mentorEmail: { $in: MENTOR_NAMES.map(generateEmail) },
    });
    console.log(
      `✓ Deleted ${deleteResult.deletedCount} existing test sessions`
    );

    // Step 3: Generate sessions across last 90 days
    console.log('\n📊 Generating mentoring sessions...');
    const sessions = [];
    const statuses = ['scheduled', 'completed', 'cancelled'];
    const statusWeights = [0.2, 0.65, 0.15]; // 20% scheduled, 65% completed, 15% cancelled

    // Generate 50-100 sessions
    const numSessions = randomInt(50, 100);

    for (let i = 0; i < numSessions; i++) {
      const daysAgo = randomInt(0, 90);
      const scheduledAt = generateSessionDate(daysAgo);
      const mentorEmail = generateEmail(randomElement(MENTOR_NAMES));
      const menteeEmail = generateEmail(randomElement(MENTEE_NAMES));

      // Weighted random status
      const rand = Math.random();
      let status;
      if (rand < statusWeights[0]) {
        status = 'scheduled';
      } else if (rand < statusWeights[0] + statusWeights[1]) {
        status = 'completed';
      } else {
        status = 'cancelled';
      }

      // Only future dates can be scheduled
      if (daysAgo < 0) {
        status = 'scheduled';
      }

      const session = {
        mentorEmail,
        menteeEmail,
        scheduledAt,
        duration: [30, 45, 60, 90][randomInt(0, 3)],
        topic: randomElement(TOPICS),
        status,
        sessionId: nanoid(16),
        notes: status === 'completed' ? 'Great session! Very helpful.' : null,
        createdAt: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      };

      // Add completion/cancellation details
      if (status === 'completed') {
        session.completedAt = new Date(
          scheduledAt.getTime() + session.duration * 60 * 1000
        );
      } else if (status === 'cancelled') {
        session.cancelledAt = new Date(
          scheduledAt.getTime() - randomInt(1, 48) * 60 * 60 * 1000
        );
        session.cancelledBy = Math.random() > 0.5 ? mentorEmail : menteeEmail;
        session.cancelReason = randomElement([
          'Schedule conflict',
          'Emergency came up',
          'Need to reschedule',
          'No longer needed',
        ]);
      }

      sessions.push(session);
    }

    // Insert all sessions
    await sessionsCollection.insertMany(sessions);
    console.log(`✓ Created ${sessions.length} mentoring sessions`);

    // Step 4: Show summary statistics
    console.log('\n📈 Session Statistics:');
    const stats = await sessionsCollection
      .aggregate([
        {
          $match: { mentorEmail: { $in: MENTOR_NAMES.map(generateEmail) } },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    stats.forEach((stat) => {
      console.log(`  - ${stat._id}: ${stat.count}`);
    });

    console.log('\n✅ Seed data generation complete!');
    console.log('\n🎯 Next steps:');
    console.log('  1. Visit /account/admin/mentoring to view the dashboard');
    console.log('  2. Try different date ranges to see the data');
    console.log('  3. Expand the chart sections to view visualizations');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed.');
  }
}

seedData();
