import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { getNonce, getProfile, login } from '../controllers/authController.js';

const router = express.Router();

router.get('/nonce/:walletAddress', getNonce);
router.post('/login', login);
router.get('/profile/:walletAddress', getProfile);

export default router;