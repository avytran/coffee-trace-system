import express from 'express';
import multer from 'multer';
import { 
  roastBatchIpfs, 
  saveRoastToDb, 
  transferExporterIpfs, 
  saveTransferExporterToDb 
} from '../controllers/processorController.js';

import { autoIpfsUpload } from '../middlewares/ipfsUploadMiddleware.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/batches/roast-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  roastBatchIpfs
);

router.post(
  '/batches/save-roast-db', 
  verifyToken, 
  saveRoastToDb
);

router.post(
  '/batches/transfer-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  transferExporterIpfs
);

router.post(
  '/batches/save-transfer-exporter-db', 
  verifyToken, 
  saveTransferExporterToDb
);

export default router;