import express from 'express';
import multer from 'multer'; // 🟢 Bổ sung multer giống farmer
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

// 🟢 Cấu hình bộ lưu trữ tạm trong RAM để đón nhận file từ Client gửi lên
const upload = multer({ storage: multer.memoryStorage() });

// =========================================================================
// 🟢 LUỒNG 1: PHÊ DUYỆT LÔ HÀNG (APPROVE)
// =========================================================================
router.post(
  '/batches/approve-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'), // 👈 Phải bóc file ra trước, tránh lỗi sập Server 500
  autoIpfsUpload, 
  approveBatchIpfs
);
router.post('/batches/save-approve-db', verifyToken, saveApproveToDb);


// =========================================================================
// 🔴 LUỒNG 2: TỪ CHỐI LÔ HÀNG (REJECT)
// =========================================================================
router.post(
  '/batches/reject-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'), // 👈 Đón nhận biên bản lỗi đính kèm từ HTX
  autoIpfsUpload, 
  rejectBatchIpfs
);
router.post('/batches/save-reject-db', verifyToken, saveRejectToDb);


// =========================================================================
// 🔵 LUỒNG 3: CHUYỂN GIAO NHÀ CHẾ BIẾN (TRANSFER TO PROCESSOR)
// =========================================================================
router.post(
  '/batches/transfer-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'),
  autoIpfsUpload, 
  transferProcessorIpfs
);
router.post('/batches/save-transfer-db', verifyToken, saveTransferProcessorToDb);

export default router;