import express from 'express';
import { getBatches, getBatchDetail } from '../controllers/batchController.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

router.get('/my-batches', verifyToken, getBatches);
router.get('/:id', verifyToken, getBatchDetail);

export default router;