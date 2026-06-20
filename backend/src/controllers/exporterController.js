import { prisma } from "../utils/prisma.js";

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
        console.error("Lỗi tại shipmentBatchIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý IPFS vận tải" });
    }
};

export const saveShipmentToDb = async (req, res) => {
    try {
        const batchId = req.body.batchId || req.body.batch_id;
        const ipfsCid = req.body.ipfsCid || req.body.ipfs_cid;
        const txHash = req.body.txHash || req.body.tx_hash;

        const carrier = req.body.carrier;
        const destination = req.body.destination;
        const containerNumber = req.body.containerNumber || req.body.container_number;
        const departureDate = req.body.departureDate || req.body.departure_date;

        if (!batchId || !txHash || !ipfsCid) {
            return res.status(400).json({
                success: false,
                message: `Thiếu dữ liệu đồng bộ bắt buộc! Đang nhận được: batchId=${batchId}, ipfsCid=${ipfsCid}, txHash=${txHash}`
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: "EXPORTED"
                }
            });

            await tx.actor_engagement.updateMany({
                where: { 
                    batch_id: batchId,
                    exporter_id: req.user.id
                },
                data: {
                    batch_status: "EXPORTED"
                }
            });

            const shippingLog = await tx.shipping_info.create({
                data: {
                    batch_id: batchId,
                    ipfs_cid: ipfsCid,
                    carrier: carrier || "Unknown Carrier",
                    departure_date: departureDate ? new Date(departureDate) : new Date(),
                    destination: destination || "Unknown Destination",
                    container_number: containerNumber || "N/A"
                }
            });

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

            return { updatedBatch, shippingLog, eventLog };
        });

        return res.status(200).json({
            success: true,
            message: "Đồng bộ dữ liệu logistics vào bảng shipping_info thành công!",
            data: result
        });

    } catch (error) {
        console.error("Lỗi tại saveShipmentToDb:", error);
        return res.status(500).json({ success: false, message: "Thất bại khi lưu thông tin vận chuyển vào DB" });
    }
};

export const transferImporterIpfs = async (req, res) => {
    try {
        const { batch_id, exporter_id, document_desc, computedIpfsCid } = req.body;

        if (!batch_id) {
            return res.status(400).json({ success: false, message: "Thiếu mã lô hàng (batch_id) bàn giao" });
        }

        return res.status(200).json({
            success: true,
            message: "Biên bản chuyển giao quyền sở hữu đã sẵn sàng trên IPFS",
            data: {
                batch_id,
                exporter_id,
                document_desc,
                ipfsCid: computedIpfsCid || req.computedIpfsCid || ""
            }
        });
    } catch (error) {
        console.error("Lỗi tại transferImporterIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi băm vận đơn chuyển giao" });
    }
};

export const saveTransferImporterToDb = async (req, res) => {
    try {
        const { batchId, status, exporterId, ipfsCid, txHash } = req.body; 

        if (!batchId || !exporterId || !txHash || !ipfsCid) {
            return res.status(400).json({ success: false, message: "Thiếu tham số chuyển giao chủ quyền bắt buộc!" });
        }

        const result = await prisma.$transaction(async (tx) => {

            const targetReceiver = await tx.users.findUnique({
                where: { id: exporterId }
            });

            if (!targetReceiver) {
                throw new Error("Không tìm thấy đối tác tiếp nhận (Receiver/Importer) trong hệ thống!");
            }

            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: status || "EXPORTED", 
                    current_owner: targetReceiver.id
                }
            });

            await tx.actor_engagement.updateMany({
                where: { 
                    batch_id: batchId,
                    exporter_id: req.user.id
                },
                data: {
                    receiver_id: targetReceiver.id,
                    batch_status: status || "EXPORTED"
                }
            });

            const currentEngagement = await tx.actor_engagement.findFirst({
                where: {
                    batch_id: batchId,
                    exporter_id: req.user.id
                }
            });

            const eventLog = await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "TRANSFER", 
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

            return { updatedBatch, currentEngagement, eventLog };
        });

        return res.status(200).json({
            success: true,
            message: "Bàn giao lô hàng sang Nhà nhập khẩu và cập nhật tiến trình actor_engagement thành công!",
            data: result
        });

    } catch (error) {
        console.error("Lỗi tại saveTransferImporterToDb:", error);
        return res.status(500).json({ success: false, message: error.message || "Lỗi đồng bộ DB luồng kết chuyển chủ quyền" });
    }
};