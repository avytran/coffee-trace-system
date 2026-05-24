import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

async function main() {
  try {
    const address = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
    console.log('Querying agent for', address);
    const agent = await prisma.agent.findUnique({ where: { walletAddress: address } });
    console.log('Result:', agent);
  } catch (e) {
    console.error('Debug query error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
