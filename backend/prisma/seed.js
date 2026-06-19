import pkgClient from '@prisma/client';
const { PrismaClient } = pkgClient;

import pkgAdapter from '@prisma/adapter-pg';
const { PrismaPg } = pkgAdapter;

import { ethers } from 'ethers';
import pg from 'pg'; 
import { provider, wallet, environment } from '../config/blockchain.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`🌍 [Seeding]: Bắt đầu kiểm tra môi trường Blockchain... (Môi trường hiện tại: ${environment.toUpperCase()})`);
  
  let adminWallet = "";
  
  try {
    if (environment === 'sepolia') {
      if (!wallet) {
        console.error("❌ Lỗi: Không tìm thấy ví cấu hình trong Server làm ADMIN cho mạng Sepolia!");
        process.exit(1);
      }
      adminWallet = wallet.address.toLowerCase();
    } else {
      console.log('Connecting to Local Node to fetch accounts...');
      const accounts = await provider.listAccounts();
      if (accounts.length < 1) {
        console.error("❌ Node Local không cung cấp tài khoản nào!");
        process.exit(1);
      }
      adminWallet = accounts[0].address.toLowerCase();
    }
  } catch (error) {
    console.error("❌ Thất bại khi kết nối tới cổng Blockchain Node:", error.message);
    process.exit(1);
  }

  console.log(`👉 Tìm thấy địa chỉ ví ADMIN hợp lệ: ${adminWallet}`);
  console.log('Initiating database seeding for ADMIN user...');

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
  console.log(`🚀 Ghi nhận dữ liệu ADMIN thành công: ${savedAdmin.name}`);
  console.log(`🔑 Wallet Address: ${savedAdmin.wallet_address}`);
  console.log(`💡 Các tài khoản (FARMER, COOPERATIVE, v.v.) sẽ do ADMIN này cấp quyền.`);
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