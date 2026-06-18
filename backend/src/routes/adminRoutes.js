import 'dotenv/config';
import express from 'express';

import { createPendingUser, syncBlockchainSuccess, getDashboardStats, getPermissionsList } from '../controllers/adminController.js';

const router = express.Router();

router.post('/users/create-pending', createPendingUser);
router.post('/users/sync-success', syncBlockchainSuccess);
router.get("/dashboard-stats", getDashboardStats);
router.get("/permissions", getPermissionsList);

export default router;