import { PrismaClient } from '@prisma/client';
import { getContractInstance } from '../config/blockchain.js';

const prisma = new PrismaClient();

export const startLotIndexer = () => {
  const contract = getContractInstance();
  console.log('[Indexer] Listening for LotCreated events');

  contract.on('LotCreated', async (lotId, farmerAddress, gpsCoordinates, qrCodeIdentifier, event) => {
    try {
      console.log(`[Indexer] LotCreated event received lotId=${lotId} farmer=${farmerAddress}`);
      const block = await event.getBlock();
      const blockTimestamp = new Date(block.timestamp * 1000);
      const txHash = event.transactionHash;

      await prisma.coffeeLot.upsert({
        where: { lotId: BigInt(lotId) },
        update: {},
        create: {
          lotId: BigInt(lotId),
          qrCode: qrCodeIdentifier,
          currentStatus: 'CREATED',
          currentActor: farmerAddress.toLowerCase(),
          farmerAddress: farmerAddress.toLowerCase(),
          initTxHash: txHash,
          createdAt: blockTimestamp
        }
      });

      console.log(`[Indexer] Synchronized lotId=${lotId} into Postgres`);
    } catch (err) {
      console.error(`[Indexer] Error processing LotCreated event lotId=${lotId}:`, err.message);
    }
  });

  contract.on('error', (err) => {
    console.error('[Indexer] Contract error:', err);
  });
};

export const stopLotIndexer = () => {
  const contract = getContractInstance();
  contract.removeAllListeners('LotCreated');
  console.log('[Indexer] Stopped listening for LotCreated events');
};
