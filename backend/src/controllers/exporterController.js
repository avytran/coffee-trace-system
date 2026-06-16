import { prisma } from "../utils/prisma.js";

/**
 * =========================================================================
 * 🚢 LUỒNG 1: EXPORT - KHAI BÁO THÔNG TIN VẬN CHUYỂN QUỐC TẾ
 * =========================================================================
 * Bước 1: Tiếp nhận thông tin vận tải và tệp đính kèm đẩy lên IPFS
 * Route: POST /api/exporter/batches/shipment-ipfs
 */
export const shipmentBatchIpfs = async (req, res) => {
    try {
        const { batch_id, carrier, departure_date, destination, container_number, document_desc, computedIpfsCid } = req.body;

        if (!batch_id) {
            return res.status(400).json({ success: false, message: "Thiếu mã lô hàng (batch_id)" });
        }

        return res.status(200).json({
            success: true,
            message: "Tích hợp hồ sơ vận tải lên IPFS thành công!",
            data: {
                batch_id,
                carrier,
                departure_date,
                destination,
                container_number,
                document_desc,
                ipfsCid: computedIpfsCid
            }
        });
    } catch (error) {
        console.error("❌ Lỗi tại shipmentBatchIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý IPFS vận tải" });
    }
};

/**
 * Bước 2: Đồng bộ dữ liệu vận chuyển vào bảng `shipping_info` độc lập và ghi log event
 * Route: POST /api/exporter/batches/save-shipment-db
 */
export const saveShipmentToDb = async (req, res) => {
    try {
        // Hỗ trợ bóc tách cả 2 kiểu viết để phòng trường hợp Frontend gửi kiểu gì cũng không trượt
        const batchId = req.body.batchId || req.body.batch_id;
        const ipfsCid = req.body.ipfsCid || req.body.ipfs_cid;
        const txHash = req.body.txHash || req.body.tx_hash;

        const carrier = req.body.carrier;
        const destination = req.body.destination;
        const containerNumber = req.body.containerNumber || req.body.container_number;
        const departureDate = req.body.departureDate || req.body.departure_date;

        // Báo lỗi chính xác xem phía Client đang nộp thiếu trường nào
        if (!batchId || !txHash || !ipfsCid) {
            return res.status(400).json({
                success: false,
                message: `Thiếu dữ liệu đồng bộ bắt buộc! Đang nhận được: batchId=${batchId}, ipfsCid=${ipfsCid}, txHash=${txHash}`
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Tạo mới bản ghi vận chuyển trong bảng shipping_info tách biệt
            const shippingLog = await tx.shipping_info.create({
                data: {
                    batch_id: batchId,
                    ipfs_cid: ipfsCid,
                    carrier: carrier,
                    departure_date: departureDate ? new Date(departureDate) : new Date(),
                    destination: destination,
                    container_number: containerNumber
                }
            });

            // 2. Ghi nhận nhật ký sự kiện chuỗi cung ứng vào bảng `batch_events`
            const eventLog = await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "EXPORT",
                    performed_by: req.user.id,
                    ipfs_cid: ipfsCid,
                    event_data: {
                        carrier,
                        destination,
                        container_number: containerNumber,
                        tx_hash: txHash
                    }
                }
            });

            return { shippingLog, eventLog };
        });

        return res.status(200).json({
            success: true,
            message: "Đồng bộ dữ liệu logistics vào bảng shipping_info thành công!",
            data: result
        });

    } catch (error) {
        console.error("❌ Lỗi tại saveShipmentToDb:", error);
        return res.status(500).json({ success: false, message: "Thất bại khi lưu thông tin vận chuyển vào DB" });
    }
};


/**
 * =========================================================================
 * 🤝 LUỒNG 2: TRANSFER - CHUYỂN GIAO QUYỀN SỞ HỮU SANG NHÀ NHẬP KHẨU
 * =========================================================================
 * Bước 1: Tiếp nhận biên bản chuyển đổi chủ quyền sở hữu thương mại đẩy lên IPFS
 * Route: POST /api/exporter/batches/transfer-ipfs
 */
export const transferImporterIpfs = async (req, res) => {
    try {
        const { batch_id, exporter_id, document_desc } = req.body;

        if (!batch_id) {
            return res.status(400).json({ success: false, message: "Thiếu mã lô hàng (batch_id) bàn giao" });
        }

        const ipfsCid = req.computedIpfsCid || "";

        return res.status(200).json({
            success: true,
            message: "Biên bản chuyển giao quyền sở hữu đã sẵn sàng trên IPFS",
            data: {
                batch_id,
                exporter_id,
                document_desc,
                ipfsCid
            }
        });
    } catch (error) {
        console.error("❌ Lỗi tại transferImporterIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi băm vận đơn chuyển giao" });
    }
};

/**
 * Bước 2: Đồng bộ giao dịch đổi chủ, cập nhật owner_id, gán nối tiếp vào actor_engagement
 * Route: POST /api/exporter/batches/save-transfer-exporter-db
 */
export const saveTransferImporterToDb = async (req, res) => {
    try {
        const { batchId, status, exporterId, ipfsCid, txHash } = req.body; // exporterId gửi từ frontend là ID của Receiver đích

        if (!batchId || !exporterId || !txHash || !ipfsCid) {
            return res.status(400).json({ success: false, message: "Thiếu tham số chuyển giao chủ quyền bắt buộc!" });
        }

        const result = await prisma.$transaction(async (tx) => {

            // 1. Xác thực xem Nhà nhập khẩu (Receiver) đích có tồn tại hay không
            const targetReceiver = await tx.users.findUnique({
                where: { id: exporterId }
            });

            if (!targetReceiver) {
                throw new Error("Không tìm thấy Nhà nhập khẩu đối tác tiếp nhận trong DB!");
            }

            // 2. Cập nhật trạng thái và đổi đứt chủ sở hữu tài sản (owner_id) tại bảng gốc cafe_batches
            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: status || "EXPORTED", // Khớp với giá trị enum status_enum
                    owner_id: targetReceiver.id
                }
            });

            // 3. Cập nhật nối tiếp dòng lịch sử chuỗi cung ứng vào bảng actor_engagement bằng updateMany
            await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: {
                    receiver_id: targetReceiver.id
                }
            });

            // 4. Ghi nhận lịch sử sự kiện bàn giao tài sản vào bảng `batch_events` (Hành động TRANSFER)
            const eventLog = await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "TRANSFER", // Thuộc enum action_enum của bạn
                    performed_by: req.user.id,
                    ipfs_cid: ipfsCid,
                    event_data: {
                        previous_owner_id: req.user.id,
                        new_owner_id: targetReceiver.id,
                        new_owner_name: targetReceiver.name,
                        tx_hash: txHash
                    }
                }
            });

            return { updatedBatch, eventLog };
        });

        return res.status(200).json({
            success: true,
            message: "Bàn giao lô hàng sang Nhà nhập khẩu và cập nhật tiến trình actor_engagement thành công!",
            data: result
        });

    } catch (error) {
        console.error("❌ Lỗi tại saveTransferImporterToDb:", error);
        return res.status(500).json({ success: false, message: error.message || "Lỗi đồng bộ DB luồng kết chuyển chủ quyền" });
    }
};
