import express from 'express';

import { getPublicLotTraceability, getPublicDashboardStats } from '../controllers/publicController.js';

const router = express.Router();

router.get('/lots/:lotId', getPublicLotTraceability);
router.get("/dashboard", getPublicDashboardStats);

export default router;