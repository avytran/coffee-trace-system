import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import { verifyWalletAndGetRole, getUserProfile } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

router.post('/verify-wallet', verifyWalletAndGetRole);
router.get('/profile', verifyToken, getUserProfile);

export default router;