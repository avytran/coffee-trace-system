import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import { verifyWalletAndGetRole } from '../controllers/authController.js';

const router = express.Router();

router.post('/verify-wallet', verifyWalletAndGetRole);

export default router;