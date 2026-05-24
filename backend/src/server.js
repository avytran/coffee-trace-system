import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import coffeeRoutes from './routes/coffeeRoutes.js';
import authRoutes from './routes/authRoutes.js';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { provider } from '../config/blockchain.js';

const app = express();

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/coffee', coffeeRoutes);

app.get('/health', async (req, res) => {
  const healthStatus = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: new Date(),
    infrastructure: {
      expressServer: 'UP',
      postgresql: 'DOWN'
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.infrastructure.postgresql = 'UP';
  } catch (error) {
    healthStatus.status = 'ERROR';
    healthStatus.errorDetails = error.message;
  }

  try {
    if (provider) {
      const blockNumber = await provider.getBlockNumber();
      const network = await provider.getNetwork();
      
      healthStatus.infrastructure.blockchainNode = 'UP';
      healthStatus.blockchainDetails = {
        currentBlock: blockNumber,
        chainId: network.chainId.toString(),
        networkName: network.name
      };
    }
  } catch (error) {
    healthStatus.status = 'ERROR';
    healthStatus.blockchainError = error.message;
  }

  const statusCode = healthStatus.status === 'OK' ? 200 : 503;
  return res.status(statusCode).json(healthStatus);
});

app.listen(PORT, () => {
  console.log(`Server is running at: http://localhost:${PORT}`);
  console.log(`Health Check at: http://localhost:${PORT}/health`);
});

export default app;