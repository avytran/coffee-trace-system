import express from 'express';
import multer from 'multer';
import { importBatchIpfs, saveImportToDb } from '../controllers/receiverController.js';
import { autoIpfsUpload } from '../middlewares/ipfsUploadMiddleware.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/batches/import-ipfs', verifyToken, upload.single('ipfs_file'), autoIpfsUpload, importBatchIpfs);
router.post('/batches/save-import-db', verifyToken, saveImportToDb);

export default router;