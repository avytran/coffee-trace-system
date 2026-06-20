import { prisma } from "../utils/prisma.js";
import crypto from 'crypto';
import { ethers } from "ethers";
import { provider } from "../../config/blockchain.js";

export const roastBatchIpfs = async (req, res) => {
    try {
        const {
            batch_id,
            roasting_temperature,
            roasting_duration,
            roast_batch_size,
            moisture,
            cupping_score,
            document_desc,
            computedIpfsCid
        } = req.body;

        if (!batch_id || !roasting_temperature || !roasting_duration || !roast_batch_size || !cupping_score) {
            return res.status(400).json({ success: false, message: "Thiếu thông số vận hành mẻ rang hoặc điểm Cupping cảm quan!" });
        }

        const eventPayload = {
            batchId: batch_id,
            roasting_temperature: parseInt(roasting_temperature),
            roasting_duration: parseInt(roasting_duration),
            roast_batch_size: parseInt(roast_batch_size),
            moisture: parseInt(moisture) || 12,
            cupping_score: parseFloat(cupping_score) || 80,
            document_desc: document_desc || "Hồ sơ kỹ thuật mẻ rang & Kết quả Cupping",
            ipfsCid: computedIpfsCid || ""
        };

        const stringifiedData = JSON.stringify(eventPayload);
        const generatedEventHash = ethers.keccak256(ethers.toUtf8Bytes(stringifiedData));

        return res.status(200).json({
            success: true,
            message: "Thiết lập gói tin nhật ký mẻ rang và sinh mã băm đối soát thành công!",
            data: {
                batch_id: batch_id,
                roasting_temperature: eventPayload.roasting_temperature,
                roasting_duration: eventPayload.roasting_duration,
                roast_batch_size: eventPayload.roast_batch_size,
                moisture: eventPayload.moisture,
                cupping_score: eventPayload.cupping_score,
                ipfsCid: eventPayload.ipfsCid,
                eventHash: generatedEventHash,
                document_desc: eventPayload.document_desc,
                rawPayload: stringifiedData
            }
        });

    } catch (error) {
        console.error("Lỗi tại Backend roastBatchIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi tạo cấu trúc payload mẻ rang nhà máy." });
    }
};

export const saveRoastToDb = async (req, res) => {
    try {
        const {
            batchId,
            status,
            roastingTemperature,
            roastingDuration,
            roastBatchSize,
            moisture,
            cuppingScore,
            ipfsCid,
            txHash
        } = req.body;

        const userId = req.user?.id;

        if (!batchId || !txHash) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin ID lô hàng hoặc mã giao dịch TxHash Blockchain." });
        }
        if (!userId) {
            return res.status(400).json({ success: false, message: "Yêu cầu định danh của Processor thực hiện đóng mẻ." });
        }

        const txReceipt = await provider.getTransactionReceipt(txHash);
        if (!txReceipt || Number(txReceipt.status) !== 1) {
            return res.status(400).json({ success: false, message: "Giao dịch Blockchain mẻ rang chưa được đào hoặc đã bị Revert thất bại!" });
        }

        const result = await prisma.$transaction(async (tx) => {
            const targetStatus = status || "ASSESSED";

            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: targetStatus,
                    updated_at: new Date()
                }
            });

            await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: { batch_status: targetStatus }
            });

            const normalizedIpfsCid = (ipfsCid || "").toString().trim();
            const documentCid = normalizedIpfsCid || `Qm${crypto.randomBytes(24).toString("hex")}`;

            await tx.documents.upsert({
                where: { ipfs_cid: documentCid },
                update: {
                    batch_id: batchId,
                    batch_status: targetStatus,
                    description: "Hồ sơ kỹ thuật mẻ rang & Kết quả Cupping đánh giá chất lượng hạt (Nhà chế biến)",
                    uploaded_by: userId
                },
                create: {
                    batch_id: batchId,
                    ipfs_cid: documentCid,
                    batch_status: targetStatus,
                    description: "Hồ sơ kỹ thuật mẻ rang & Kết quả Cupping đánh giá chất lượng hạt (Nhà chế biến)",
                    uploaded_by: userId,
                    type: "DOCUMENT"
                }
            });

            let assignedGrade = "C";
            const score = parseFloat(cuppingScore || 0);
            if (score >= 85) assignedGrade = "S";
            else if (score >= 80) assignedGrade = "A";
            else if (score >= 75) assignedGrade = "B";

            await tx.cafe_batch_details.upsert({
                where: { batch_id: batchId },
                update: {
                    roasting_temperature: parseInt(roastingTemperature || 0),
                    roasting_duration: parseInt(roastingDuration || 0),
                    roast_batch_size: parseInt(roastBatchSize || 0),
                    moisture_content: parseFloat(moisture || 0),
                    sensory_score: score,
                    quality_grade: assignedGrade
                },
                create: {
                    batch_id: batchId,
                    harvest_time: new Date(),
                    harvest_method: "UNKNOWN",
                    processing_method: "WET",
                    fermentation_duration: 24,
                    roasting_temperature: parseInt(roastingTemperature || 0),
                    roasting_duration: parseInt(roastingDuration || 0),
                    roast_batch_size: parseInt(roastBatchSize || 0),
                    moisture_content: parseFloat(moisture || 0),
                    sensory_score: score,
                    quality_grade: assignedGrade,
                    defect_count: 0,
                    defect_reason: "NONE"
                }
            });

            await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "ASSESS",
                    performed_by: userId,
                    ipfs_cid: ipfsCid || "",
                    event_data: {
                        txHash,
                        roastingTemperature,
                        roastingDuration,
                        roastBatchSize,
                        moisture,
                        cuppingScore,
                        qualityGrade: assignedGrade
                    }
                }
            });

            await tx.audit_logs.create({
                data: {
                    action: "ASSESS",
                    description: `Nhà chế biến đóng mẻ rang sâu cho lô hàng #${batchId}. Nhiệt độ: ${roastingTemperature}°C, Điểm Cupping: ${cuppingScore}`,
                    performed_by: userId,
                    batch_id: batchId,
                    batch_status: targetStatus
                }
            });

            return updatedBatch;
        });

        return res.status(200).json({
            success: true,
            message: "Nhật ký vận hành mẻ rang đã được đồng bộ hóa thành công xuống hệ thống PostgreSQL.",
            data: result
        });

    } catch (error) {
        console.error("Lỗi đồng bộ DB mẻ rang:", error);
        return res.status(500).json({ success: false, message: "Lỗi đồng bộ hệ thống sau mẻ rang.", error: error.message });
    }
};

export const transferExporterIpfs = async (req, res) => {
    try {
        const { batch_id, exporter_id, document_desc, computedIpfsCid } = req.body;

        if (!batch_id || !exporter_id) {
            return res.status(400).json({ success: false, message: "Cần chỉ định mã lô hàng và định danh Nhà xuất khẩu đối tác nhận hàng!" });
        }

        const eventPayload = {
            batchId: batch_id,
            exporterId: exporter_id,
            document_desc: document_desc || "Vận đơn thương mại bàn giao sang Nhà Xuất Khẩu đạt chuẩn",
            ipfsCid: computedIpfsCid || ""
        };

        const stringifiedData = JSON.stringify(eventPayload);
        const generatedEventHash = ethers.keccak256(ethers.toUtf8Bytes(stringifiedData));

        return res.status(200).json({
            success: true,
            message: "Thiết lập gói tin vận đơn chuyển giao sang Nhà xuất khẩu thành công!",
            data: {
                batchId: batch_id,
                exporterId: exporter_id,
                ipfsCid: computedIpfsCid || "",
                eventHash: generatedEventHash,
                document_desc: eventPayload.document_desc,
                rawPayload: stringifiedData
            }
        });
    } catch (error) {
        console.error("Lỗi tại Backend transferExporterIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi cấu trúc payload hệ thống chuyển giao xuất khẩu." });
    }
};

export const saveTransferExporterToDb = async (req, res) => {
    try {
        const { batchId, status, exporterId, ipfsCid, txHash } = req.body;
        const userId = req.user?.id;

        if (!batchId || !exporterId || !txHash) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin đồng bộ bàn giao (batchId, exporterId, txHash)." });
        }

        const txReceipt = await provider.getTransactionReceipt(txHash);
        if (!txReceipt || Number(txReceipt.status) !== 1) {
            return res.status(400).json({ success: false, message: "Chứng thực Blockchain Revert hoặc giao dịch không tồn tại!" });
        }

        const exporterUser = await prisma.users.findUnique({ where: { id: exporterId } });
        if (!exporterUser) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Nhà xuất khẩu đối tác mục tiêu trên hệ thống!" });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    current_owner: exporterUser.id,
                    updated_at: new Date()
                }
            });

            await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: {
                    exporter_id: exporterUser.id
                }
            });

            if (ipfsCid) {
                const currentStatus = status || "ASSESSED";

                await tx.documents.upsert({
                    where: { ipfs_cid: ipfsCid },
                    update: {
                        batch_id: batchId,
                        description: `Vận đơn thương mại bàn giao tài sản sang Nhà Xuất Khẩu: ${exporterUser.name}`,
                        batch_status: currentStatus
                    },
                    create: {
                        batch_id: batchId,
                        ipfs_cid: ipfsCid,
                        description: `Vận đơn thương mại bàn giao tài sản sang Nhà Xuất Khẩu: ${exporterUser.name}`,
                        uploaded_by: userId || updatedBatch.current_owner,
                        type: "DOCUMENT",
                        batch_status: currentStatus
                    }
                });
            }

            await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "TRANSFER",
                    performed_by: userId || updatedBatch.current_owner,
                    ipfs_cid: ipfsCid || "",
                    event_data: {
                        txHash,
                        receiver_id: exporterUser.id,
                        receiver_name: exporterUser.name,
                        receiver_wallet: exporterUser.wallet_address
                    }
                }
            });

            await tx.audit_logs.create({
                data: {
                    action: "TRANSFER",
                    description: `Nhà chế biến ký bàn giao và chuyển quyền sở hữu lô hàng #${batchId} sang Nhà Xuất Khẩu (${exporterUser.name})`,
                    performed_by: userId || updatedBatch.current_owner,
                    batch_id: batchId,
                    batch_status: status || "ASSESSED"
                }
            });

            return updatedBatch;
        });

        return res.status(200).json({
            success: true,
            message: "Đồng bộ giao dịch ký chuyển giao tài sản sang Nhà xuất khẩu thành công!",
            data: result
        });

    } catch (error) {
        console.error("Lỗi lưu DB sau bàn giao Nhà xuất khẩu:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi thực hiện cấu trúc đồng bộ bàn giao thương mại.", error: error.message });
    }
};