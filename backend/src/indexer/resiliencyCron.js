import cron from 'node-cron';
import { prisma } from '../server.js';
import { ethers } from 'ethers';
import { provider } from '../../config/blockchain.js';
import fs from 'fs';
import path from 'path';

const contractPath = path.resolve(process.cwd(), 'artifacts/contracts/CoffeeTraceability.sol/CoffeeTraceability.json');
const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const contractABI = contractJson.abi;

const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new ethers.Contract(contractAddress, contractABI, provider);

cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 [CRONJOB] Bắt đầu kiểm tra đồng bộ khối...");

  try {
    if (!contractAddress) {
      console.error("❌ Lỗi: Chưa cấu hình CONTRACT_ADDRESS trong file .env");
      return;
    }

    const blockCurrent = await provider.getBlockNumber();

    const lastSavedRecord = await prisma.systemConfig.findUnique({
      where: { key: "last_processed_block" }
    });

    let blockLastSaved = lastSavedRecord ? parseInt(lastSavedRecord.value, 10) : blockCurrent;

    if (blockCurrent > blockLastSaved) {
      const fromBlock = blockLastSaved + 1;
      const toBlock = blockCurrent;

      console.warn(`🚑 Phát hiện hụt block! Đang quét bù từ block ${fromBlock} -> ${toBlock}`);

      const missedLogs = await contract.queryFilter("*", fromBlock, toBlock);

      if (missedLogs.length > 0) {
        console.log(`📦 Tìm thấy ${missedLogs.length} sự kiện bị bỏ sót. Đang tiến hành khôi phục...`);
    
      } else {
        console.log("✅ Không có sự kiện nào phát sinh trong khoảng block bị rớt mạng.");
      }

      await prisma.systemConfig.upsert({
        where: { key: "last_processed_block" },
        update: { value: blockCurrent.toString() },
        create: { key: "last_processed_block", value: blockCurrent.toString() }
      });

      console.log(`🟢 Đã đồng bộ khôi phục thành công đến block: ${blockCurrent}`);
    } else {
      console.log("⚡ Hệ thống vẫn đang đồng bộ hoàn hảo, không bỏ sót block nào.");
    }

  } catch (error) {
    console.error("❌ [CRONJOB ERROR] Lỗi hệ thống khôi phục dữ liệu:", error.message);
  }
});