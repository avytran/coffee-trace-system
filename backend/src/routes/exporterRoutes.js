import express from 'express';
import multer from 'multer';
import { 
  shipmentBatchIpfs, 
  saveShipmentToDb, 
  transferImporterIpfs, 
  saveTransferImporterToDb 
} from '../controllers/exporterController.js';

import { autoIpfsUpload } from '../middlewares/ipfsUploadMiddleware.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/batches/shipment-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  shipmentBatchIpfs
);

router.post(
  '/batches/save-shipment-db', 
  verifyToken, 
  saveShipmentToDb
);

router.post(
  '/batches/transfer-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  transferImporterIpfs
);

router.post(
  '/batches/save-transfer-exporter-db', 
  verifyToken, 
  saveTransferImporterToDb
);

export default router;