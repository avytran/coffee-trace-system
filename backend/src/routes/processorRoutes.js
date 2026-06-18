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

// 🟢 Bộ lưu trữ tạm thời trong RAM xử lý file nhị phân đính kèm
const upload = multer({ storage: multer.memoryStorage() });

// =========================================================================
// 🔥 LUỒNG 1: THIẾT LẬP THÔNG SỐ MỀ RANG & PHÂN HẠNG CẢM QUAN (ASSESSED)
// =========================================================================

/**
 * Bước 1: Tiếp nhận thông số lò rang, bóc tách hồ sơ mẻ rang, tự động đẩy IPFS
 * Khớp chuẩn frontend: axiosInstance.post('/processor/batches/roast-ipfs', formDataPayload)
 */
router.post(
  '/batches/roast-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'), // 👈 Đón chuẩn field "ipfs_file" từ formDataPayload
  autoIpfsUpload, 
  roastBatchIpfs
);

/**
 * Bước 2: Lưu thông tin mẻ rang, độ ẩm, điểm cupping, txHash vào PostgreSQL
 * Khớp chuẩn frontend: axiosInstance.post('/processor/batches/save-roast-db', { ... })
 */
router.post(
  '/batches/save-roast-db', 
  verifyToken, 
  saveRoastToDb
);


// =========================================================================
// 🤝 LUỒNG 2: CHUYỂN GIAO QUYỀN SỞ HỮU SANG NHÀ XUẤT KHẨU (EXPORTED)
// =========================================================================

/**
 * Bước 1: Tiếp nhận ID nhà xuất khẩu, vận đơn thương mại nội địa, tự động đẩy IPFS
 * Khớp chuẩn frontend: axiosInstance.post('/processor/batches/transfer-ipfs', formDataPayload)
 * 🌟 ĐÃ SỬA: Đổi tên endpoint từ 'transfer-exporter-ipfs' thành 'transfer-ipfs' cho khớp y hệt Frontend
 */
router.post(
  '/batches/transfer-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'), // 👈 Đóng gói vận đơn từ modal TransferNextOwnerModal
  autoIpfsUpload, 
  transferExporterIpfs
);

/**
 * Bước 2: Đồng bộ kết quả chuyển giao đổi sang chủ sở hữu Exporter và trạng thái "EXPORTED" vào DB
 * Khớp chuẩn frontend: axiosInstance.post('/processor/batches/save-transfer-exporter-db', { ... })
 */
router.post(
  '/batches/save-transfer-exporter-db', 
  verifyToken, 
  saveTransferExporterToDb
);

export default router;