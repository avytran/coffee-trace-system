import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ethers } from 'ethers';
import pg from 'pg'; 

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

async function main() {
  console.log('Connecting to Blockchain Node to fetch active accounts...');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let accounts = [];
  
  try {
    accounts = await provider.listAccounts();
  } catch (error) {
    console.error("Failed to connect to Blockchain RPC Node. Ensure your local blockchain network is running (e.g., `npx hardhat node`)!");
    process.exit(1);
  }

  if (accounts.length < 4) {
    console.error("Local Blockchain node does not provide enough accounts (minimum 4 required) for role assignment!");
    process.exit(1);
  }

  console.log('Initiating database seeding for Agent table (Synchronized with Blockchain wallets)...');

  const initialAgents = [
    {
      walletAddress: accounts[0].address.toLowerCase(),
      name: 'Ban Quản Trị Hệ Thống',
      role: 'ADMIN',
      email: 'admin@coffeetrace.com',
      phone: '0123456789',
      physicalAddress: 'Văn phòng Điều hành Trung tâm, TP. HCM',
    },
    {
      walletAddress: accounts[1].address.toLowerCase(),
      name: 'Nông hộ Y Miên',
      role: 'FARMER',
      email: 'ymien.farm@gmail.com',
      phone: '0987654321',
      physicalAddress: 'Buôn Ma Thuột, Đắk Lắk',
    },
    {
      walletAddress: accounts[2].address.toLowerCase(),
      name: 'Hợp Tác Xã Cà Phê Chơ Cư Mgar',
      role: 'COOPERATIVE',
      email: 'cumgar.coop@gmail.com',
      phone: '0905111222',
      physicalAddress: 'Huyện Cư M\'gar, Đắk Lắk',
    },
    {
      walletAddress: accounts[3].address.toLowerCase(),
      name: 'Nhà Máy Chế Biến Cà Phê An Thái',
      role: 'PROCESSOR',
      email: 'anthai.processor@anthai.com.vn',
      phone: '02623955111',
      physicalAddress: 'KCN Hòa Phú, Buôn Ma Thuột',
    }
  ];

  for (const agent of initialAgents) {
    const savedAgent = await prisma.agent.upsert({
      where: { walletAddress: agent.walletAddress }, 
      update: { 
        name: agent.name, 
        role: agent.role,
        email: agent.email,
        phone: agent.phone,
        physicalAddress: agent.physicalAddress
      },
      create: {
        walletAddress: agent.walletAddress,
        name: agent.name,
        role: agent.role,
        email: agent.email,
        phone: agent.phone,
        physicalAddress: agent.physicalAddress,
        isActive: true
      },
    });
    console.log(`Successfully seeded Agent: ${savedAgent.name} | Wallet: ${savedAgent.walletAddress} -> Role: ${savedAgent.role}`);
  }

  console.log('Agent database seeding completed successfully!');
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