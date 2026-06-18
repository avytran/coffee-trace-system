import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ethers } from 'ethers';
import pg from 'pg'; 
import { provider } from '../config/blockchain.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

async function main() {
  console.log('Connecting to Blockchain Node to fetch active accounts...');
  
  let accounts = [];
  
  try {
    accounts = await provider.listAccounts();
  } catch (error) {
    console.error("Failed to connect to Blockchain RPC Node. Ensure your local blockchain network is running (e.g., `npx hardhat node`)!");
    process.exit(1);
  }

  if (accounts.length < 1) {
    console.error("Local Blockchain node does not provide any accounts! Minimum 1 required for ADMIN seeding.");
    process.exit(1);
  }

  console.log('Initiating database seeding for ADMIN user (Synchronized with Blockchain wallet)...');

  const adminWallet = accounts[0].address.toLowerCase();

  const savedAdmin = await prisma.users.upsert({
    where: { wallet_address: adminWallet }, 
    update: { 
      name: 'Ban Quản Trị Hệ Thống', 
      role: 'ADMIN'
    },
    create: {
      wallet_address: adminWallet,
      name: 'Ban Quản Trị Hệ Thống',
      role: 'ADMIN',
      status: 'ACTIVE'
    },
  });

  console.log(`----------------------------------------------------------------------`);
  console.log(`🚀 Successfully seeded ADMIN: ${savedAdmin.name}`);
  console.log(`🔑 Wallet Address: ${savedAdmin.wallet_address}`);
  console.log(`💡 Other roles (FARMER, COOPERATIVE, etc.) will be assigned by this ADMIN.`);
  console.log(`----------------------------------------------------------------------`);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Database seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });