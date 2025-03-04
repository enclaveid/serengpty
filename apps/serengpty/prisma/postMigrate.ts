import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Seed the database with some test data
const seed = async (prisma: PrismaClient): Promise<string[]> => {
  // Create users
  const giovanni = await prisma.user.upsert({
    where: { id: 'cm0i27jdj0000aqpa73ghpcxf' },
    update: {},
    create: {
      id: 'cm0i27jdj0000aqpa73ghpcxf',
      name: 'giovanni',
      country: 'IT', // Italy - Using ISO country code
      passwordHash: await bcrypt.hash('securePassword1', 10),
    },
  });

  const alice = await prisma.user.upsert({
    where: { name: 'alice' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'alice',
      country: 'US', // USA - Using ISO country code
      passwordHash: await bcrypt.hash('securePassword2', 10),
    },
  });

  const bob = await prisma.user.upsert({
    where: { name: 'bob' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'bob',
      country: 'GB', // UK - Using ISO country code (Great Britain)
    },
  });

  const charlie = await prisma.user.upsert({
    where: { name: 'charlie' },
    update: {},
    create: {
      email: 'charlie@example.com',
      name: 'charlie',
      country: 'CA', // Canada - Using ISO country code
    },
  });

  const diana = await prisma.user.upsert({
    where: { name: 'diana' },
    update: {},
    create: {
      email: 'diana@example.com',
      name: 'diana',
      country: 'FR', // France - Using ISO country code
    },
  });

  // Create serendipitous paths
  const techPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary:
        'Connected through tech interests and programming languages',
      score: 0.85,
    },
  });

  const travelPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary:
        'Connected through travel experiences in similar locations',
      score: 0.78,
    },
  });

  const foodPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary:
        'Connected through culinary interests and favorite restaurants',
      score: 0.92,
    },
  });

  const musicPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary: 'Connected through music tastes and concert experiences',
      score: 0.81,
    },
  });

  // Additional paths for testing multiple connections between users
  const gamingPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary: 'Connected through gaming interests and strategies',
      score: 0.75,
    },
  });

  const bookClubPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary: 'Connected through book recommendations and discussions',
      score: 0.88,
    },
  });

  const sportPath = await prisma.serendipitousPath.create({
    data: {
      commonSummary: 'Connected through sports interests and activities',
      score: 0.65,
    },
  });

  // Create common conversations
  const techConversation1 = await prisma.conversation.create({
    data: {
      uniqueSummary: 'Discussion about TypeScript and React',
      datetime: new Date('2024-02-15T14:30:00Z'),
      serendipitousPathId: techPath.id,
    },
  });

  const techConversation2 = await prisma.conversation.create({
    data: {
      uniqueSummary: 'Talking about backend technologies',
      datetime: new Date('2024-02-16T10:15:00Z'),
      serendipitousPathId: techPath.id,
    },
  });

  const travelConversation1 = await prisma.conversation.create({
    data: {
      uniqueSummary: 'Experiences in Southeast Asia',
      datetime: new Date('2024-01-20T16:45:00Z'),
      serendipitousPathId: travelPath.id,
    },
  });

  const travelConversation2 = await prisma.conversation.create({
    data: {
      uniqueSummary: 'European city recommendations',
      datetime: new Date('2024-01-25T09:30:00Z'),
      serendipitousPathId: travelPath.id,
    },
  });

  const foodConversation = await prisma.conversation.create({
    data: {
      uniqueSummary: 'Favorite Italian dishes',
      datetime: new Date('2024-02-05T19:20:00Z'),
      serendipitousPathId: foodPath.id,
    },
  });

  const musicConversation = await prisma.conversation.create({
    data: {
      uniqueSummary: 'Jazz and classical music preferences',
      datetime: new Date('2024-02-10T20:45:00Z'),
      serendipitousPathId: musicPath.id,
    },
  });

  // Create unique conversations for each UserPath
  // Giovanni and Alice - Tech Path
  const gioAliceTechPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: techPath.id,
    },
  });

  const aliceTechPath = await prisma.userPath.create({
    data: {
      userId: alice.id,
      pathId: techPath.id,
    },
  });

  // Giovanni and Alice - Book Club Path (second connection)
  const gioAliceBookPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: bookClubPath.id,
    },
  });

  const aliceBookPath = await prisma.userPath.create({
    data: {
      userId: alice.id,
      pathId: bookClubPath.id,
    },
  });

  // Giovanni and Charlie - Travel Path
  const gioTravelPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: travelPath.id,
    },
  });

  const charlieTravelPath = await prisma.userPath.create({
    data: {
      userId: charlie.id,
      pathId: travelPath.id,
    },
  });

  // Giovanni and Charlie - Sport Path (second connection)
  const gioSportPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: sportPath.id,
    },
  });

  const charlieSportPath = await prisma.userPath.create({
    data: {
      userId: charlie.id,
      pathId: sportPath.id,
    },
  });

  // Giovanni and Bob - Food Path
  const gioFoodPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: foodPath.id,
    },
  });

  const bobFoodPath = await prisma.userPath.create({
    data: {
      userId: bob.id,
      pathId: foodPath.id,
    },
  });

  // Giovanni and Bob - Gaming Path (second connection)
  const gioGamingPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: gamingPath.id,
    },
  });

  const bobGamingPath = await prisma.userPath.create({
    data: {
      userId: bob.id,
      pathId: gamingPath.id,
    },
  });

  // Giovanni and Diana - Music Path
  const gioMusicPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: musicPath.id,
    },
  });

  const dianaMusicPath = await prisma.userPath.create({
    data: {
      userId: diana.id,
      pathId: musicPath.id,
    },
  });

  // Create unique conversations for each user path
  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Machine learning projects',
      datetime: new Date('2024-02-12T11:30:00Z'),
      userPathId: gioAliceTechPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Frontend design patterns',
      datetime: new Date('2024-02-13T14:20:00Z'),
      userPathId: aliceTechPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Travel algorithms and ML',
      datetime: new Date('2024-01-19T15:30:00Z'),
      userPathId: gioTravelPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Backpacking in New Zealand',
      datetime: new Date('2024-01-18T16:30:00Z'),
      userPathId: charlieTravelPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Italian cooking techniques',
      datetime: new Date('2024-02-04T18:10:00Z'),
      userPathId: gioFoodPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'DevOps and CI/CD pipelines',
      datetime: new Date('2024-02-14T09:45:00Z'),
      userPathId: bobFoodPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Classical composers analysis',
      datetime: new Date('2024-02-11T21:00:00Z'),
      userPathId: gioMusicPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Wine tasting experiences',
      datetime: new Date('2024-02-03T17:15:00Z'),
      userPathId: dianaMusicPath.id,
    },
  });

  // Create unique conversations for the new paths
  // Book Club Path - Alice and Giovanni
  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Science fiction novel recommendations',
      datetime: new Date('2024-02-20T13:45:00Z'),
      userPathId: gioAliceBookPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Book club organizing skills',
      datetime: new Date('2024-02-21T16:30:00Z'),
      userPathId: aliceBookPath.id,
    },
  });

  // Sport Path - Charlie and Giovanni
  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Marathon training schedule',
      datetime: new Date('2024-01-28T08:15:00Z'),
      userPathId: gioSportPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Mountain biking trails',
      datetime: new Date('2024-01-29T09:45:00Z'),
      userPathId: charlieSportPath.id,
    },
  });

  // Gaming Path - Bob and Giovanni
  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Strategy game tournament',
      datetime: new Date('2024-02-07T20:30:00Z'),
      userPathId: gioGamingPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Game development frameworks',
      datetime: new Date('2024-02-08T19:15:00Z'),
      userPathId: bobGamingPath.id,
    },
  });

  // Add common conversations for the new paths
  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Literary podcasts and analysis',
      datetime: new Date('2024-02-19T14:30:00Z'),
      serendipitousPathId: bookClubPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Sports analytics and statistics',
      datetime: new Date('2024-01-27T10:15:00Z'),
      serendipitousPathId: sportPath.id,
    },
  });

  await prisma.conversation.create({
    data: {
      uniqueSummary: 'Multiplayer game coordination',
      datetime: new Date('2024-02-06T21:00:00Z'),
      serendipitousPathId: gamingPath.id,
    },
  });

  // Return all user IDs
  return [giovanni.id, alice.id, bob.id, charlie.id, diana.id];
};

// Execute the script
(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    console.log('Seeding database...');
    const userIds = await seed(prisma);

    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
