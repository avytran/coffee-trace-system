import 'dotenv/config';
import express from 'express';

import { getAgents, updateAgentStatus } from '../controllers/adminController.js';

const router = express.Router();

router.get('/agents', getAgents);
router.put('/agents/:walletAddress', updateAgentStatus);

export default router;