import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js"; 

/**
 * =========================================================================
 * ⚓ BƯỚC 1: TIẾP NHẬN BỘ CHỨNG TỪ NGHIỆM THU ĐẨY LÊN IPFS
 * =========================================================================
 * Route: POST /api/receiver/batches/import-ipfs
 */
export const importBatchIpfs = async (req, res) => {
    try {
        const { batch_id, document_desc, computedIpfsCid } = req.body;
        
        if (!batch_id) {
            return res.status(400).json({ success: false, message: "Thiếu mã lô hàng (batch_id) nghiệm thu!" });
        }

        return res.status(200).json({
            success: true,
            message: "Tải tệp chứng từ nghiệm thu lên IPFS thành công!",
            data: {
                batch_id,
                document_desc,
                ipfsCid: computedIpfsCid,
            }
        });
    } catch (error) {
        console.error("❌ Lỗi tại importBatchIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý tải hồ sơ lên IPFS" });
    }
};

/**
 * =========================================================================
 * 💾 BƯỚC 2: ĐỒNG BỘ SÂU XUỐNG DATABASE & ĐÓNG VÒNG ĐỜI CHUỖI CUNG ỨNG
 * =========================================================================
 * Route: POST /api/receiver/batches/save-import-db
 */
export const saveImportToDb = async (req, res) => {
    try {
        // Chuẩn hóa tên biến hỗ trợ cả camelCase từ Front-End gửi lên
        const batchId = req.body.batchId || req.body.batch_id;
        const ipfsCid = req.body.ipfsCid || req.body.ipfs_cid;
        const txHash = req.body.txHash || req.body.tx_hash;
        const status = req.body.status || "COMPLETED"; // Trạng thái cuối cùng đóng chuỗi

        const userId = req.user?.id; // ID của Receiver đang đăng nhập

        // Kiểm tra điều kiện bắt buộc
        if (!batchId || !txHash || !ipfsCid) {
            return res.status(400).json({ 
                success: false, 
                message: `Thiếu tham số đồng bộ bắt buộc! Đang nhận được: batchId=${batchId}, ipfsCid=${ipfsCid}, txHash=${txHash}` 
            });
        }

        // 🔍 Xác thực biên nhận giao dịch on-chain từ mạng lưới Blockchain
        const txReceipt = await provider.getTransactionReceipt(txHash);
        if (!txReceipt || Number(txReceipt.status) !== 1) {
            return res.status(400).json({ success: false, message: "Giao dịch Smart Contract thất bại (Reverted) hoặc chưa được khai thác!" });
        }

        console.log(`🔒 Đang tiến hành đóng chuỗi cung ứng cho lô hàng tinh gọn: #${batchId}`);

        const result = await prisma.$transaction(async (tx) => {
            
            // 1. Cập nhật trạng thái mẻ hàng gốc sang COMPLETED
            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: status, // "COMPLETED"
                    updated_at: new Date()
                }
            });

            // 2. 🔴 CẬP NHẬT NỐI TIẾP TIẾN TRÌNH (updateMany): Chốt hạ vòng đời chuỗi cung ứng
            const engagementLog = await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: {
                    batch_status: status // Đồng bộ sang "COMPLETED" để kết thúc chuỗi
                }
            });

            // 3. Lưu chứng từ vào bảng documents (Điền đầy đủ batch_status tránh lỗi Required)
            const documentLog = await tx.documents.upsert({
                where: { ipfs_cid: ipfsCid },
                update: {
                    batch_id: batchId,
                    batch_status: status
                },
                create: {
                    batch_id: batchId,
                    ipfs_cid: ipfsCid,
                    description: "Biên bản thông quan nghiệm thu & Hoàn thành chuỗi cung ứng truy xuất",
                    uploaded_by: userId || updatedBatch.owner_id,
                    type: "DOCUMENT",
                    batch_status: status // Khắc phục triệt để lỗi Required enum
                }
            });

            // 4. Ghi mốc lịch sử sự kiện Traceability hành trình của hạt cà phê
            const eventLog = await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "VERIFY", // Khớp với hành động đóng chuỗi
                    performed_by: userId || updatedBatch.owner_id,
                    ipfs_cid: ipfsCid,
                    event_data: {
                        tx_hash: txHash,
                        closed_by_receiver_id: userId,
                        message: "Chuỗi cung ứng kết thúc, hàng đã nhập kho tổng an toàn."
                    }
                }
            });

            // 5. Nhật ký giám sát bảo mật hệ thống (Điền đầy đủ batch_status tránh lỗi Required)
            const auditLog = await tx.audit_logs.create({
                data: {
                    action: "VERIFY",
                    description: `Nhà nhập khẩu (Receiver) ký nghiệm thu bộ chứng từ IPFS và đóng lệnh truy xuất cho lô hàng #${batchId}`,
                    performed_by: userId || updatedBatch.owner_id,
                    batch_id: batchId,
                    batch_status: status // Khắc phục triệt để lỗi Required enum
                }
            });

            return { updatedBatch, engagementLog, documentLog, eventLog, auditLog };
        });

        return res.status(200).json({
            success: true,
            message: "Tuyệt vời! Hệ thống đã ghi nhận đồng bộ nghiệm thu, chuỗi cung ứng đã đóng!",
            data: result
        });

    } catch (error) {
        console.error("❌ Lỗi tại saveImportToDb:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống khi thực thi nghiệp vụ lưu trữ đóng chuỗi", 
            error: error.message 
        });
    }
};