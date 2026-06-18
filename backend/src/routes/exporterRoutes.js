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

// 🟢 Cấu hình bộ lưu trữ tạm thời trong RAM để tiếp nhận bộ chứng từ xuất khẩu từ Client
const upload = multer({ storage: multer.memoryStorage() });

// =========================================================================
// 🚢 LUỒNG 1: KHAI BÁO THÔNG TIN VẬN CHUYỂN QUỐC TẾ (DECLARATION)
// =========================================================================

/**
 * Bước 1: Đón nhận hồ sơ Hải quan / Vận đơn đường biển và tự động đẩy lên IPFS
 * Khớp chuẩn frontend: axiosInstance.post('/exporter/batches/shipment-ipfs', formDataPayload)
 */
router.post(
  '/batches/shipment-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'), // 👈 Bóc tách tệp đính kèm (Bill of Lading / Tờ khai hải quan)
  autoIpfsUpload,             // 👈 Tự động đẩy file lên IPFS lấy CID
  shipmentBatchIpfs
);

/**
 * Bước 2: Đồng bộ nhật ký vận tải, số container, ngày đi xuống PostgreSQL
 * Khớp chuẩn frontend: axiosInstance.post('/exporter/batches/save-shipment-db', { ... })
 */
router.post(
  '/batches/save-shipment-db', 
  verifyToken, 
  saveShipmentToDb
);


// =========================================================================
// 🤝 LUỒNG 2: CHUYỂN GIAO QUYỀN SỞ HỮU SANG NHÀ NHẬP KHẨU (RECEIVER / IMPORTER)
// =========================================================================

/**
 * Bước 1: Tiếp nhận biên bản bàn giao chủ quyền thương mại và đẩy lên IPFS
 * ⚠️ LƯU Ý ĐỒNG BỘ: Frontend của bạn đang gọi nhầm tiền tố thành:
 * axiosInstance.post('/processor/batches/transfer-ipfs', formDataPayload)
 * * Nếu bạn muốn sửa Frontend về đúng nhóm `/exporter`, hãy dùng endpoint dưới đây:
 * '/batches/transfer-ipfs' (nằm trong file router này sẽ tạo ra đường dẫn /exporter/batches/transfer-ipfs)
 */
router.post(
  '/batches/transfer-ipfs', 
  verifyToken, 
  upload.single('ipfs_file'), // 👈 Biên bản ký kết bàn giao tài sản
  autoIpfsUpload, 
  transferImporterIpfs
);

/**
 * Bước 2: Lưu vết Blockchain giao dịch đổi chủ (owner_id sang Receiver) vào PostgreSQL
 * Khớp chuẩn frontend: axiosInstance.post('/exporter/batches/save-transfer-exporter-db', { ... })
 */
router.post(
  '/batches/save-transfer-exporter-db', 
  verifyToken, 
  saveTransferImporterToDb
);

export default router;