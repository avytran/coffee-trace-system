import express from 'express';
import multer from 'multer';
import { 
  approveBatchIpfs, 
  saveApproveToDb, 
  rejectBatchIpfs, 
  saveRejectToDb, 
  transferProcessorIpfs, 
  saveTransferProcessorToDb 
} from '../controllers/cooperativeController.js';

import { autoIpfsUpload } from '../middlewares/ipfsUploadMiddleware.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/batches/approve-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  approveBatchIpfs
);
router.post('/batches/save-approve-db', verifyToken, saveApproveToDb);

router.post(
  '/batches/reject-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  rejectBatchIpfs
);
router.post('/batches/save-reject-db', verifyToken, saveRejectToDb);

router.post(
  '/batches/transfer-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  transferProcessorIpfs
);
router.post('/batches/save-transfer-db', verifyToken, saveTransferProcessorToDb);

export default router;