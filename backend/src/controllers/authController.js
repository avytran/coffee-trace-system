import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const nonceMap = new Map();

export const getNonce = async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress.toLowerCase();

    let agent = await prisma.agent.findUnique({
      where: { walletAddress }
    });

    if (!agent) {
      agent = await prisma.agent.create({
        data: {
          walletAddress,
          role: "PENDING_SYNC",
          name: `Web3 User ${walletAddress.substring(0, 6)}`,
          isActive: true
        }
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
      message: error.message
    });
  }
}

export const login = async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    const addressLower = walletAddress.toLowerCase();

    const savedNonce = nonceMap.get(addressLower);

    if (!savedNonce) {
      return res.status(400).json({
        error: "Authentication process failed.",
        message: "Nonce expired or not found. Please request a new nonce first."
      });
    }

    const recoveredAddress = ethers.verifyMessage(savedNonce, signature);

    if (recoveredAddress.toLowerCase() !== addressLower) {
      return res.status(401).json({
        error: "Authentication process failed.",
        message: "Invalid signature. Wallet ownership verification failed."
      });
    }

    nonceMap.delete(addressLower);

    const agent = await prisma.agent.findUnique({
      where: { walletAddress: addressLower }
    });

    const userRole = agent && agent.role ? agent.role : "PENDING_SYNC";
    const userId = agent && agent.id ? agent.id : 0;

    const token = jwt.sign(
      {
        id: userId,
        walletAddress: addressLower,
        role: userRole
      },
      process.env.JWT_SECRET || "SUPER_SECRET_KEY",
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        walletAddress: addressLower,
        role: userRole
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      error: "Authentication process failed.",
      message: error.message
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!agent) {
      return res.json({ 
        success: true, 
        data: {
          walletAddress,
          role: "PENDING_SYNC", 
          name: `Web3 User ${walletAddress.substring(0, 6)}`,
          isActive: true
        } 
      });
    }

    return res.json({ success: true, data: agent });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};