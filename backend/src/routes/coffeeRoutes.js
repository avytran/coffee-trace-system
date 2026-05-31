import express from 'express';
import multer from 'multer';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { createCoffeeLot, updateHarvestInfo } from '../controllers/coffeeController.js';
import { uploadIPFS } from '../agents/ipfsAgent.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or PDF files are allowed'), false);
  },
});

router.post('/create-lot', protect, restrictTo('FARMER'), createCoffeeLot);
router.put('/harvest/:lotId', protect, restrictTo('FARMER'), updateHarvestInfo);
router.post('/agents/upload-ipfs', protect, upload.single('file'), uploadIPFS);

export default router;
