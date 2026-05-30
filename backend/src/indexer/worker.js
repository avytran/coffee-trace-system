import { ethers } from 'ethers';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const contractAbiPath = `${__dirname}/../../artifacts/contracts/CoffeeTraceability.sol/CoffeeTraceability.json`;
const contractAbi = JSON.parse(fs.readFileSync(contractAbiPath, 'utf-8'));

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const ROLE_MAP = {
  [ethers.id("ADMIN_ROLE")]: "ADMIN",
  [ethers.id("FARMER_ROLE")]: "FARMER",
  [ethers.id("COOPERATIVE_ROLE")]: "COOPERATIVE",
  [ethers.id("PROCESSOR_ROLE")]: "PROCESSOR",
  [ethers.id("EXPORTER_ROLE")]: "EXPORTER",
  [ethers.id("ROASTERY_ROLE")]: "ROASTERY"
};

export function startContractIndexer() {
  const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  const contract = new ethers.Contract(
    process.env.BLOCKCHAIN_CONTRACT_ADDRESS, 
    contractAbi.abi, 
    provider
  );

  console.log("[Indexer Worker] System active. Listening for RoleGranted event streams...");

  contract.on("RoleGranted", async (role, account, sender) => {
    try {
      const cleanWallet = account.toLowerCase();
      const dbRole = ROLE_MAP[role] || "UNKNOWN_ROLE";

      console.log(`📥 [Blockchain Event] RoleGranted Captured -> Wallet: ${cleanWallet} | Role: ${dbRole}`);

      const syncedAgent = await prisma.agent.upsert({
        where: { walletAddress: cleanWallet },
        update: { role: dbRole },
        create: {
          walletAddress: cleanWallet,
          name: `Web3 Agent [${cleanWallet.substring(0, 6)}]`,
          role: dbRole,
          isActive: true
        }
      });
      console.log(`[DB Synced] Agent ${syncedAgent.walletAddress} marked as ${syncedAgent.role}`);

      const adminWallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
      const userBalance = await provider.getBalance(cleanWallet);

      if (userBalance < ethers.parseEther("0.02")) {
        console.log(`[Gas Faucet] Wallet ${cleanWallet} has low ETH. Auto-funding 0.1 ETH...`);
        const tx = await adminWallet.sendTransaction({
          to: cleanWallet,
          value: ethers.parseEther("0.1")
        });
        await tx.wait();
        console.log(`[Gas Faucet Success] Gas funded successfully. TxHash: ${tx.hash}`);
      }

    } catch (error) {
      console.error("[Indexer Worker Error] Failed to process transaction log sync:", error.message);
    }
  });

    contract.on("LotExported", async (lotId, qrCode, exporter) => {
        console.log(`[Indexer] Phát hiện lô ${lotId} được xuất khẩu bởi ${exporter}`);
        
        try {
            
            await prisma.coffeeLot.update({
                where: { id: Number(lotId) },
                data: { 
                    currentStatus: 'EXPORTED',
                    qrCode: qrCode 
                }
            });
            console.log(`[Indexer] Đã cập nhật thành công lô ${lotId} sang trạng thái EXPORTED`);
        } catch (error) {
            console.error(`[Indexer] Lỗi khi cập nhật database cho lô ${lotId}:`, error);
        }
    });
}