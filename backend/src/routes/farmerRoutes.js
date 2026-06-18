import express from 'express';
import multer from 'multer';
import { createBatch, verifyTransferPartner, saveBatchToDb, harvestBatch, transferToCoop } from '../controllers/farmerController.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { autoIpfsUpload } from '../middlewares/ipfsUploadMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/batches/create', verifyToken, upload.single('ipfs_file'), autoIpfsUpload, createBatch);
router.post('/batches/save-db', verifyToken, saveBatchToDb);
router.post('/batches/verify-transfer', verifyTransferPartner);
router.post('/batches/harvest-batch', verifyToken, harvestBatch);
router.post('/batches/transfer-to-coop', verifyToken, transferToCoop);

export default router;