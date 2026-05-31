import { PrismaClient } from '@prisma/client';
import { getContractInstance } from '../config/blockchain.js';

const prisma = new PrismaClient();

export const createCoffeeLot = async (req, res) => {
  try {
    const {
      qrCode,
      gpsCoordinates,
      elevation,
      coffeeVariety,
      cultivationMethod
    } = req.body;

    const farmerWallet = req.user.walletAddress.toLowerCase();

    if (!qrCode || !gpsCoordinates || !coffeeVariety || !cultivationMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: qrCode, gpsCoordinates, coffeeVariety, cultivationMethod'
      });
    }

    const contract = getContractInstance();

    const farmDataStruct = {
      gpsCoordinates,
      elevation: Number(elevation) || 0,
      coffeeVariety,
      cultivationMethod
    };

    const tx = await contract.createCoffeeLot(farmDataStruct, qrCode);
    const receipt = await tx.wait();

    const lotCreatedEvent = receipt.logs
      .map(log => {
        try { return contract.interface.parseLog(log); } catch { return null; }
      })
      .find(e => e && e.name === 'LotCreated');

    if (!lotCreatedEvent) {
      throw new Error('LotCreated event not found in receipt');
    }

    const onChainLotId = lotCreatedEvent.args.lotId;
    const blockTimestamp = new Date(
      (await tx.provider.getBlock(receipt.blockNumber)).timestamp * 1000
    );

    await prisma.$transaction([
      prisma.coffeeLot.create({
        data: {
          lotId: onChainLotId,
          qrCode,
          currentStatus: 'CREATED',
          currentActor: farmerWallet,
          farmerAddress: farmerWallet,
          initTxHash: receipt.hash,
          createdAt: blockTimestamp
        }
      }),
      prisma.lotStageDetail.create({
        data: {
          lotId: onChainLotId,
          stageName: 'FARM',
          stageDataPayload: {
            gpsCoordinates,
            elevation: Number(elevation) || 0,
            coffeeVariety,
            cultivationMethod
          },
          txHash: receipt.hash,
          blockchainTimestamp: blockTimestamp
        }
      }),
      prisma.lotTimeline.create({
        data: {
          lotId: onChainLotId,
          status: 'CREATED',
          description: `Farmer ${farmerWallet} created lot ${coffeeVariety} at ${gpsCoordinates}.`,
          txHash: receipt.hash
        }
      })
    ]);

    return res.status(201).json({
      success: true,
      message: 'Lot created successfully.',
      data: {
        lotId: onChainLotId.toString(),
        qrCode,
        txHash: receipt.hash,
        status: 'CREATED'
      }
    });
  } catch (error) {
    console.error('[createCoffeeLot] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Lot creation failed.',
      detail: error.message
    });
  }
};

export const updateHarvestInfo = async (req, res) => {
  try {
    const lotId = BigInt(req.params.lotId);
    const {
      harvestDate,
      harvestMethod,
      actualYield,
      ipfsHash
    } = req.body;

    const farmerWallet = req.user.walletAddress.toLowerCase();

    if (!harvestDate || !harvestMethod || !actualYield || !ipfsHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: harvestDate, harvestMethod, actualYield, ipfsHash'
      });
    }

    const harvestTimestamp = Math.floor(new Date(harvestDate).getTime() / 1000);

    const existingLot = await prisma.coffeeLot.findUnique({
      where: { lotId }
    });

    if (!existingLot) {
      return res.status(404).json({ success: false, error: 'Lot not found.' });
    }
    if (existingLot.currentStatus !== 'CREATED') {
      return res.status(409).json({
        success: false,
        error: `Lot status is "${existingLot.currentStatus}", harvest update is not allowed.`
      });
    }
    if (existingLot.farmerAddress !== farmerWallet) {
      return res.status(403).json({ success: false, error: 'You are not the owner of this lot.' });
    }

    const contract = getContractInstance();

    const tx = await contract.updateHarvestInfo(
      lotId,
      harvestTimestamp,
      harvestMethod,
      Number(actualYield),
      ipfsHash
    );

    const receipt = await tx.wait();
    const blockTimestamp = new Date(
      (await tx.provider.getBlock(receipt.blockNumber)).timestamp * 1000
    );

    await prisma.$transaction([
      prisma.coffeeLot.update({
        where: { lotId },
        data: { currentStatus: 'HARVESTED' }
      }),
      prisma.lotStageDetail.create({
        data: {
          lotId,
          stageName: 'HARVEST',
          stageDataPayload: {
            harvestDate,
            harvestMethod,
            actualYield: Number(actualYield),
            ipfsHash
          },
          txHash: receipt.hash,
          blockchainTimestamp: blockTimestamp
        }
      }),
      prisma.lotTimeline.create({
        data: {
          lotId,
          status: 'HARVESTED',
          description: `Harvest completed with ${actualYield}kg using method "${harvestMethod}". IPFS: ${ipfsHash}`,
          txHash: receipt.hash
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Harvest information updated successfully.',
      data: {
        lotId: lotId.toString(),
        status: 'HARVESTED',
        harvestMethod,
        actualYield: Number(actualYield),
        ipfsHash,
        txHash: receipt.hash
      }
    });
  } catch (error) {
    console.error('[updateHarvestInfo] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Harvest update failed.',
      detail: error.message
    });
  }
};
