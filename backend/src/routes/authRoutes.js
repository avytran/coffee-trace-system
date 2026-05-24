import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const router = express.Router();
const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const nonceMap = new Map();

router.get('/nonce/:walletAddress', async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress.toLowerCase();

    const agent = await prisma.agent.findUnique({
      where: { walletAddress }
    });

    if (!agent) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "This wallet address is not registered as a valid agent in the supply chain system." 
      });
    }

    if (!agent.isActive) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "Your account has been deactivated." 
      });
    }

    const nonce = `Welcome to Coffee Trace! Please sign this message to verify your wallet ownership.\nSecurity Nonce Code: ${Math.floor(Math.random() * 1000000)}`;
    
    nonceMap.set(walletAddress, nonce);

    return res.json({ nonce });
  } catch (error) {
    console.error("Get Nonce Error:", error);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message, 
      stack: error.stack 
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({ 
        message: "Missing wallet address or cryptographic signature." 
      });
    }

    const addressLower = walletAddress.toLowerCase();

    const savedNonce = nonceMap.get(addressLower);
    if (!savedNonce) {
      return res.status(400).json({ 
        message: "Nonce has expired or does not exist. Please request a new nonce." 
      });
    }

    const recoveredAddress = ethers.verifyMessage(savedNonce, signature);

    if (recoveredAddress.toLowerCase() !== addressLower) {
      return res.status(401).json({ 
        message: "Invalid signature! Wallet ownership authentication failed." 
      });
    }

    nonceMap.delete(addressLower);

    const agent = await prisma.agent.findUnique({
      where: { walletAddress: addressLower }
    });

    const token = jwt.sign(
      { 
        walletAddress: agent.walletAddress, 
        role: agent.role, 
        name: agent.name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: "Wallet verified successfully! Login successful.",
      token,
      agent: {
        name: agent.name,
        role: agent.role,
        walletAddress: agent.walletAddress
      }
    });

  } catch (error) {
    console.error("Wallet Login Error:", error);
    return res.status(500).json({ 
      error: "Authentication process failed." 
    });
  }
});

export default router;