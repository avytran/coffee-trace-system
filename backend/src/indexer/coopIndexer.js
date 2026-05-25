import { ethers } from "ethers";
import { createRequire } from "module";
import prisma from "../prismaClient.js";

const require = createRequire(import.meta.url);

const contractArtifact = require("../../artifacts/contracts/CoffeeTraceability.sol/CoffeeTraceability.json");
const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);

const contract = new ethers.Contract(
  process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
  contractArtifact.abi,
  provider
);

const getBlockchainTimestamp = async (event) => {
  const blockNumber = event.log.blockNumber;
  const block = await provider.getBlock(blockNumber);
  return new Date(Number(block.timestamp) * 1000);
};

contract.on(
  "LotProcessed",
  async (
    lotId,
    actor,
    processMethod,
    fermentationTime,
    moistureContent,
    impurityRate,
    ipfsReportHash,
    event
  ) => {
    try {
      const txHash = event.log.transactionHash;
      const blockchainTimestamp = await getBlockchainTimestamp(event);
      const actorAddress = actor.toLowerCase();
      const lotIdBigInt = BigInt(lotId.toString());

      const stageDataPayload = {
        processMethod,
        fermentationTime: Number(fermentationTime),
        moistureContent: Number(moistureContent) / 10,
        impurityRate: Number(impurityRate) / 100,
        ipfsReportHash,
      };

      await prisma.$transaction([
        prisma.coffeeLot.update({
          where: {
            lotId: lotIdBigInt,
          },
          data: {
            currentStatus: "PROCESSED",
            currentActor: actorAddress,
            updatedAt: new Date(),
          },
        }),

        prisma.lotStageDetail.create({
          data: {
            lotId: lotIdBigInt,
            stageName: "PROCESSING",
            actorAddress,
            stageDataPayload,
            ipfsHash: ipfsReportHash || null,
            txHash,
            blockchainTimestamp,
          },
        }),
      ]);

      console.log(`Lô #${lotId.toString()} -> PROCESSED`);
    } catch (err) {
      console.error("Indexer PROCESSED error:", err);
    }
  }
);

contract.on("LotRejected", async (lotId, actor, reason, event) => {
  try {
    const txHash = event.log.transactionHash;
    const blockchainTimestamp = await getBlockchainTimestamp(event);
    const actorAddress = actor.toLowerCase();
    const lotIdBigInt = BigInt(lotId.toString());

    await prisma.$transaction([
      prisma.coffeeLot.update({
        where: {
          lotId: lotIdBigInt,
        },
        data: {
          currentStatus: "REJECTED",
          currentActor: actorAddress,
          updatedAt: new Date(),
        },
      }),

      prisma.lotStageDetail.create({
        data: {
          lotId: lotIdBigInt,
          stageName: "PROCESSING",
          actorAddress,
          stageDataPayload: {
            rejected: true,
            rejectionReason: reason,
          },
          ipfsHash: null,
          txHash,
          blockchainTimestamp,
        },
      }),
    ]);

    console.log(`Lô #${lotId.toString()} -> REJECTED | Lý do: ${reason}`);
  } catch (err) {
    console.error("Indexer REJECTED error:", err);
  }
});

console.log("Coop Indexer đang chạy...");