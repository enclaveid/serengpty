import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    transactionOptions: {
      maxWait: 60 * 1000, // 1 minute
      timeout: 60 * 1000, // 1 minute
    },
  });

globalForPrisma.prisma = prisma;

// This will be used by chat notifications
// See the updateConversationsForUser function in chatActions.ts
// This middleware approach provides a more efficient way to get real-time updates
// without having to poll the database

/*
prisma.$use(async (params, next) => {
  // Run the query
  const result = await next(params);

  // Handle message updates after the operation completes
  // This is handled directly in server actions now

  return result;
});
*/

export default prisma;
