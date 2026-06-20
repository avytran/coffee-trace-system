import { ethers } from 'ethers';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getAbi = (contractName) => {
  const path = `${__dirname}/../../artifacts/contracts/${contractName}.sol/${contractName}.json`;
  return JSON.parse(fs.readFileSync(path, 'utf-8')).abi;
};

const userRegistryAbi = getAbi("UserRegistry");
const batchRegistryAbi = getAbi("BatchRegistry");
const batchEventRegistryAbi = getAbi("BatchEventRegistry");

const ROLE_MAP = { 0: "ADMIN", 1: "FARMER", 2: "COOPERATIVE", 3: "PROCESSOR", 4: "EXPORTER", 5: "RECEIVER", 6: "ANONYMOUS" };
const STATUS_MAP = { 0: "INITIAL", 1: "HARVESTED", 2: "PRE_PROCESSED", 3: "REJECTED", 4: "PROCESSED", 5: "ASSESSED", 6: "EXPORTED", 7: "COMPLETED" };
const ACTION_MAP = { 0: "ASSIGN_ROLE", 1: "CREATE_BATCH", 2: "HARVEST", 3: "PRE_PROCESS", 4: "REJECT", 5: "PROCESS", 6: "ASSESS", 7: "EXPORT", 8: "VERIFY", 9: "TRANSFER" };

export function startContractIndexer() {
  const adminWallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);

  const userContract = new ethers.Contract(process.env.USER_REGISTRY_ADDRESS, userRegistryAbi, provider);
  const batchContract = new ethers.Contract(process.env.BATCH_REGISTRY_ADDRESS, batchRegistryAbi, provider);
  const eventContract = new ethers.Contract(process.env.EVENT_REGISTRY_ADDRESS, batchEventRegistryAbi, provider);

  console.log("🚀 [Indexer Cluster] Khởi chạy thành công toàn bộ luồng lắng nghe 3 Contracts...");

  async function autoFundGas(walletAddress) {
    try {
      const cleanWallet = walletAddress.toLowerCase();
      const balance = await provider.getBalance(cleanWallet);
      if (balance < ethers.parseEther("0.02")) {
        console.log(`[Gas Faucet] Ví ${cleanWallet} sắp hết tiền. Đang tự động cấp 0.1 ETH...`);
        const tx = await adminWallet.sendTransaction({ to: cleanWallet, value: ethers.parseEther("0.1") });
        await tx.wait();
        console.log(`[Gas Faucet] Đã nạp thành công cấp vốn cho ${cleanWallet}`);
      }
    } catch (err) {
      console.error("[Gas Faucet Error]", err.message);
    }
  }

  async function ensureUserExists(walletAddress, defaultRole = "ANONYMOUS") {
    const cleanWallet = walletAddress.toLowerCase();
    let user = await prisma.users.findUnique({ where: { wallet_address: cleanWallet } });
    
    if (!user) {
      user = await prisma.users.create({
        data: {
          wallet_address: cleanWallet,
          name: `Đối tác Web3 [${cleanWallet.substring(0, 6).toUpperCase()}]`,
          role: defaultRole,
          status: "ACTIVE"
        }
      });
    }
    return user;
  }

  userContract.on("UserRegistered", async (wallet, role, status, createdAt) => {
    try {
      if (!prisma || !prisma.users) {
        throw new Error("Không thể đọc thuộc tính 'users' từ module prisma.");
      }

      const cleanWallet = wallet.toLowerCase();
      const dbRole = ROLE_MAP[Number(role)] || "ANONYMOUS";
      
      await prisma.users.upsert({
        where: { wallet_address: cleanWallet },
        update: { role: dbRole, status: "ACTIVE" },
        create: { 
          wallet_address: cleanWallet, 
          name: `Nông Hộ Web3 [${cleanWallet.substring(0, 6).toUpperCase()}]`, 
          role: dbRole, 
          status: "ACTIVE" 
        }
      });
      console.log(`✨ [Sync DB] Đã đồng bộ đăng ký tài khoản: ${cleanWallet} [${dbRole}]`);
      await autoFundGas(cleanWallet);
    } catch (error) { 
      console.error("Lỗi đồng bộ UserRegistered:", error.message); 
    }
  });

  userContract.on("UserRoleUpdated", async (wallet, oldRole, newRole) => {
    try {
      const cleanWallet = wallet.toLowerCase();
      const dbRole = ROLE_MAP[Number(newRole)] || "ANONYMOUS";

      await prisma.users.update({ 
        where: { wallet_address: cleanWallet }, 
        data: { role: dbRole } 
      });
      console.log(`🔄 [Sync DB] Cập nhật vai trò mới [${dbRole}] cho ví: ${cleanWallet}`);
    } catch (error) { 
      console.error("Lỗi đồng bộ UserRoleUpdated:", error.message); 
    }
  });


  batchContract.on("BatchCreated", async (batchId, traceabilityCode, currentOwner) => {
    try {
      const user = await ensureUserExists(currentOwner, "FARMER");
      
      await prisma.cafe_batches.upsert({
        where: { id: batchId },
        update: { current_owner: user.id, status: "INITIAL" },
        create: {
          id: batchId,
          traceability_node: traceabilityCode,
          current_owner: user.id,
          status: "INITIAL",
          longitude: 0,
          latitude: 0,
          altitude: 0,
          weight: 0,
          plant_variety: "Unknown",
          cultivation_bio: "Standard"
        }
      });
      console.log(`📦 [Sync DB] Phát hiện Lô hàng mới On-chain: ${traceabilityCode} | Mã UUID chủ: ${user.id}`);
    } catch (error) { 
      console.error("Lỗi đồng bộ BatchCreated:", error.message); 
    }
  });

  batchContract.on("BatchStatusUpdated", async (batchId, status) => {
    try {
      const dbStatus = STATUS_MAP[Number(status)];
      await prisma.cafe_batches.update({
        where: { id: batchId },
        data: { status: dbStatus }
      });
      console.log(`🔄 [Sync DB] Lô hàng ${batchId} cập nhật trạng thái chuỗi cung ứng sang: ${dbStatus}`);

      if (dbStatus === "HARVESTED") {
        await prisma.cafe_batch_details.upsert({
          where: { batch_id: batchId },
          update: {},
          create: {
            batch_id: batchId,
            harvest_time: new Date(),
            harvest_method: "UNKNOWN",
            processing_method: "",
            fermentation_duration: 0,
            moisture_content: 0,
            defect_count: 0,
            defect_reason: "",
            roasting_temperature: 0,
            roasting_duration: 0,
            roast_batch_size: 0,
            sensory_score: 0,
            quality_grade: "C"
          }
        });
      }
    } catch (error) { 
      console.error("Lỗi đồng bộ BatchStatusUpdated:", error.message); 
    }
  });

  batchContract.on("BatchOwnershipTransferred", async (batchId, from, to) => {
    try {
      const receiverWallet = to.toLowerCase();
      const user = await ensureUserExists(receiverWallet);

      await prisma.cafe_batches.update({
        where: { id: batchId },
        data: { current_owner: user.id }
      });
      console.log(`🤝 [Sync DB] Đã chuyển giao quyền sở hữu Lô ${batchId} sang UUID: ${user.id} (${receiverWallet})`);
      await autoFundGas(receiverWallet); 
    } catch (error) { 
      console.error("Lỗi đồng bộ BatchOwnershipTransferred:", error.message); 
    }
  });


  eventContract.on("BatchEventAdded", async (batchId, action, actor, ipfsCid) => {
    try {
      const dbAction = ACTION_MAP[Number(action)];
      const actorWallet = actor.toLowerCase();

      const user = await prisma.users.findUnique({ where: { wallet_address: actorWallet } });
      const currentBatch = await prisma.cafe_batches.findUnique({ where: { id: batchId } });

      if (currentBatch && user) {
        await prisma.audit_logs.create({
          data: {
            batch_id: batchId,
            action: dbAction,
            performed_by: user.id,
            description: `Hành động ${dbAction} được ký thực thi từ ví ${actorWallet}`,
            batch_status: currentBatch.status
          }
        });

        await prisma.batch_events.create({
          data: {
            batch_id: batchId,
            event_type: dbAction,
            performed_by: user.id,
            ipfs_cid: ipfsCid,
            event_data: { 
              actor: actorWallet, 
              ipfs: ipfsCid, 
              timestamp: new Date().toISOString() 
            }
          }
        });

        console.log(`⛓️  [Sync DB Ledger] Khắc thành công dữ liệu Log & Event bất biến vào CSDL cho hành động: [${dbAction}]`);
      } else {
        console.warn(`⚠️ [Sync DB Warning] Không thể ghi Log. Lý do: Lô hàng hoặc Tài khoản người dùng chưa tồn tại ở DB off-chain.`);
      }
    } catch (error) { 
      console.error("Lỗi đồng bộ BatchEventAdded:", error.message); 
    }
  });
}