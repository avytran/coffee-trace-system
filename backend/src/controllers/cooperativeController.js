import { prisma } from "../utils/prisma.js";
import crypto from 'crypto';
import { ethers } from "ethers";
import { provider } from "../../config/blockchain.js";

export const approveBatchIpfs = async (req, res) => {
    try {
        const {
            batch_id,
            moisture,
            impurity,
            broken_ratio,
            cupping_score,
            document_desc,
            computedIpfsCid
        } = req.body;

        if (!batch_id || moisture === undefined || impurity === undefined || broken_ratio === undefined || cupping_score === undefined) {
            return res.status(400).json({ success: false, message: "Thiếu thông số kiểm định chất lượng hạt!" });
        }

        const eventPayload = {
            batchId: batch_id,
            moisture: parseFloat(moisture) || 0,
            impurity: parseFloat(impurity) || 0,
            broken_ratio: parseFloat(broken_ratio) || 0,
            cupping_score: parseFloat(cupping_score) || 0,
            document_desc: document_desc || "Chứng nhận kiểm định chất lượng hạt",
            ipfsCid: computedIpfsCid || ""
        };

        const stringifiedData = JSON.stringify(eventPayload);
        const generatedEventHash = ethers.keccak256(ethers.toUtf8Bytes(stringifiedData));

        return res.status(200).json({
            success: true,
            message: "Thiết lập gói tin phê duyệt và sinh mã băm đối soát thành công!",
            data: {
                batchId: batch_id,
                ipfsCid: computedIpfsCid || "",
                moisture: eventPayload.moisture,
                impurity: eventPayload.impurity,
                broken_ratio: eventPayload.broken_ratio,
                cupping_score: eventPayload.cupping_score,
                eventHash: generatedEventHash,
                metadata: {
                    document_desc: eventPayload.document_desc,
                    rawPayload: stringifiedData
                }
            }
        });

    } catch (error) {
        console.error("Lỗi tại Backend approveBatchIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi tạo payload hệ thống phê duyệt." });
    }
};

export const saveApproveToDb = async (req, res) => {
    try {
        const payload = req.body || {};
        const batchId = payload.batchId || payload.batch_id;
        const ipfsCid = payload.ipfsCid || payload.ipfs_cid || "";
        const txHash = payload.txHash || payload.tx_hash || payload.transactionHash;
        const moisture = parseFloat(payload.moisture || 0);
        const impurity = parseFloat(payload.impurity || 0);
        const broken_ratio = parseFloat(payload.broken_ratio || 0);
        const cupping_score = parseFloat(payload.cupping_score || 0);

        let metadata = payload.metadata || {};
        if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch (err) { metadata = {}; }
        }

        const userId = req.user?.id || metadata.userId || metadata.user_id;

        if (!batchId || !txHash) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin ID lô hàng hoặc Transaction Hash từ Blockchain." });
        }
        if (!userId) {
            return res.status(400).json({ success: false, message: "Thiếu định danh người dùng thực hiện ký duyệt." });
        }


        const txReceipt = await provider.getTransactionReceipt(txHash);

        if (!txReceipt || Number(txReceipt.status) !== 1) {
            return res.status(400).json({ success: false, message: "Giao dịch Blockchain không tồn tại hoặc đã bị Revert thất bại!" });
        }

        console.log(`💾 Đang tiến hành đồng bộ kết quả phê duyệt lô hàng ${batchId} vào hệ thống...`);

        const result = await prisma.$transaction(async (tx) => {
            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: "PROCESSED",
                    updated_at: new Date()
                }
            });

            await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: { batch_status: "PROCESSED" }
            });

            const normalizedIpfsCid = (ipfsCid || "").toString().trim();
            const documentCid = normalizedIpfsCid || `Qm${crypto.randomBytes(24).toString("hex")}`;

            await tx.documents.upsert({
                where: { ipfs_cid: documentCid },
                update: {
                    batch_id: batchId,
                    batch_status: "PROCESSED",
                    description: metadata.document_desc || "Chứng nhận kiểm định chất lượng hạt (HTX phê duyệt)",
                    uploaded_by: userId
                },
                create: {
                    batch_id: batchId,
                    ipfs_cid: documentCid,
                    batch_status: "PROCESSED",
                    description: metadata.document_desc || "Chứng nhận kiểm định chất lượng hạt (HTX phê duyệt)",
                    uploaded_by: userId,
                    type: "DOCUMENT"
                }
            });

            let assignedGrade = "C";
            if (cupping_score >= 85) assignedGrade = "S";
            else if (cupping_score >= 80) assignedGrade = "A";
            else if (cupping_score >= 75) assignedGrade = "B";

            await tx.cafe_batch_details.upsert({
                where: { batch_id: batchId },
                update: {
                    moisture_content: moisture,
                    sensory_score: cupping_score,
                    quality_grade: assignedGrade,
                    roasting_temperature: 0,
                    roasting_duration: 0,
                    roast_batch_size: 0
                },
                create: {
                    batch_id: batchId,
                    harvest_time: new Date(),
                    harvest_method: "UNKNOWN",
                    processing_method: "WET",
                    fermentation_duration: 24,
                    moisture_content: moisture,
                    defect_count: Math.floor(impurity),
                    defect_reason: `Impurity ratio: ${impurity}%, Broken ratio: ${broken_ratio}%`,
                    sensory_score: cupping_score,
                    quality_grade: assignedGrade,
                    roasting_temperature: 0,
                    roasting_duration: 0,
                    roast_batch_size: 0
                }
            });

            await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "PROCESS",
                    performed_by: userId,
                    ipfs_cid: ipfsCid || "",
                    event_data: {
                        txHash: txHash,
                        moisture,
                        impurity,
                        broken_ratio,
                        cupping_score,
                        metadata
                    }
                }
            });

            await tx.audit_logs.create({
                data: {
                    action: "PROCESS",
                    description: `Hợp tác xã phê duyệt chất lượng lô hàng #${batchId}. Điểm Cupping: ${cupping_score}`,
                    performed_by: userId,
                    batch_id: batchId,
                    batch_status: "PROCESSED"
                }
            });

            return updatedBatch;
        });

        return res.status(200).json({
            success: true,
            message: "Đã phê duyệt lô hàng thành công và đồng bộ dữ liệu PostgreSQL toàn diện.",
            data: result
        });

    } catch (error) {
        console.error("Lỗi lưu DB sau phê duyệt:", error);
        return res.status(500).json({ success: false, message: "Lỗi đồng bộ hệ thống sau phê duyệt.", error: error.message });
    }
};

export const rejectBatchIpfs = async (req, res) => {
    try {
        const { batch_id, reject_reason, document_desc, computedIpfsCid } = req.body;

        if (!batch_id || !reject_reason) {
            return res.status(400).json({ success: false, message: "Yêu cầu cung cấp ID lô hàng và lý do trả về lô hàng!" });
        }

        const eventPayload = {
            batchId: batch_id,
            rejectReason: reject_reason.trim(),
            document_desc: document_desc || "Biên bản lỗi hàng / Trả về nông dân",
            ipfsCid: computedIpfsCid || ""
        };

        const stringifiedData = JSON.stringify(eventPayload);
        const generatedEventHash = ethers.keccak256(ethers.toUtf8Bytes(stringifiedData));

        return res.status(200).json({
            success: true,
            message: "Thiết lập gói tin từ chối và sinh mã băm đối soát thành công!",
            data: {
                batchId: batch_id,
                rejectReason: eventPayload.rejectReason,
                ipfsCid: computedIpfsCid || "",
                eventHash: generatedEventHash,
                metadata: {
                    document_desc: eventPayload.document_desc,
                    rawPayload: stringifiedData
                }
            }
        });
    } catch (error) {
        console.error("Lỗi tại Backend rejectBatchIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi tạo payload hệ thống từ chối." });
    }
};

export const saveRejectToDb = async (req, res) => {
    try {
        const { batchId, rejectReason, ipfsCid, txHash } = req.body;
        const userId = req.user?.id;

        if (!batchId || !txHash || !rejectReason) {
            return res.status(400).json({ success: false, message: "Yêu cầu đầy đủ batchId, lý do từ chối và txHash từ Blockchain!" });
        }

        const txReceipt = await provider.getTransactionReceipt(txHash);
        if (!txReceipt || Number(txReceipt.status) !== 1) {
            return res.status(400).json({ success: false, message: "Giao dịch Blockchain lỗi hoặc không tồn tại!" });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    status: "REJECTED",
                    updated_at: new Date()
                }
            });

            await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: { batch_status: "REJECTED" }
            });

            if (ipfsCid) {
                await tx.documents.upsert({
                    where: { ipfs_cid: ipfsCid },
                    update: { batch_status: "REJECTED" },
                    create: {
                        batch_id: batchId,
                        ipfs_cid: ipfsCid,
                        batch_status: "REJECTED",
                        description: `Biên bản lỗi hàng: ${rejectReason}`,
                        uploaded_by: userId || updatedBatch.current_owner,
                        type: "DOCUMENT"
                    }
                });
            }

            await tx.batch_events.create({
                data: {
                    batch_id: batchId,
                    event_type: "REJECT",
                    performed_by: userId || updatedBatch.current_owner,
                    ipfs_cid: ipfsCid || "",
                    event_data: { txHash, rejectReason }
                }
            });

            await tx.audit_logs.create({
                data: {
                    action: "REJECT",
                    description: `Hợp tác xã từ chối tiếp nhận lô hàng #${batchId}. Lý do: ${rejectReason}`,
                    performed_by: userId || updatedBatch.current_owner,
                    batch_id: batchId,
                    batch_status: "REJECTED"
                }
            });

            return updatedBatch;
        });

        return res.status(200).json({
            success: true,
            message: "Đã hủy bỏ/từ chối lô hàng thành công và trả trạng thái về PostgreSQL.",
            data: result
        });

    } catch (error) {
        console.error("Lỗi lưu DB sau từ chối:", error);
        return res.status(500).json({ success: false, message: "Lỗi đồng bộ hệ thống sau từ chối.", error: error.message });
    }
};

export const transferProcessorIpfs = async (req, res) => {
    try {
        const { batch_id, processor_id, document_desc, computedIpfsCid } = req.body;

        if (!batch_id || !processor_id) {
            return res.status(400).json({ success: false, message: "Cần cung cấp ID lô hàng và ID Nhà chế biến tiếp nhận!" });
        }

        const eventPayload = {
            batchId: batch_id,
            processorId: processor_id,
            document_desc: document_desc || "Biên bản/Vận đơn bàn giao nhà chế biến sâu",
            ipfsCid: computedIpfsCid || ""
        };

        const stringifiedData = JSON.stringify(eventPayload);
        const generatedEventHash = ethers.keccak256(ethers.toUtf8Bytes(stringifiedData));

        return res.status(200).json({
            success: true,
            message: "Thiết lập gói tin chuyển giao sang Nhà chế biến thành công!",
            data: {
                batchId: batch_id,
                processorId: processor_id,
                ipfsCid: computedIpfsCid || "",
                eventHash: generatedEventHash,
                metadata: {
                    document_desc: eventPayload.document_desc,
                    rawPayload: stringifiedData
                }
            }
        });
    } catch (error) {
        console.error("Lỗi tại Backend transferProcessorIpfs:", error);
        return res.status(500).json({ success: false, message: "Lỗi tạo payload hệ thống chuyển giao." });
    }
};

export const saveTransferProcessorToDb = async (req, res) => {
    try {
        const { batchId, processorId, ipfsCid, txHash } = req.body;
        const userId = req.user?.id;

        if (!batchId || !processorId || !txHash) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin đồng bộ chuyển quyền sở hữu (batchId, processorId, txHash)." });
        }

        const txReceipt = await provider.getTransactionReceipt(txHash);
        if (!txReceipt || Number(txReceipt.status) !== 1) {
            return res.status(400).json({ success: false, message: "Chứng thực Blockchain Revert hoặc TxHash giao dịch không tồn tại!" });
        }

        const processorUser = await prisma.users.findUnique({ where: { id: processorId } });
        if (!processorUser) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Nhà chế biến mục tiêu trên cơ sở dữ liệu hệ thống!" });
        }

        console.log(`🤝 Tiến hành chuyển giao quyền quản lý lô hàng ${batchId} sang chủ mới: ${processorUser.name}`);

        const result = await prisma.$transaction(async (tx) => {
            const currentBatch = await tx.cafe_batches.findUnique({
                where: { id: batchId },
                select: { status: true }
            });

            if (!currentBatch) {
                throw new Error("Không tìm thấy lô hàng cần bàn giao trong cơ sở dữ liệu!");
            }

            const activeStatus = currentBatch.status;

            const updatedBatch = await tx.cafe_batches.update({
                where: { id: batchId },
                data: {
                    current_owner: processorUser.id,
                    updated_at: new Date()
                }
            });

            await tx.actor_engagement.updateMany({
                where: { batch_id: batchId },
                data: {
                    processor_id: processorUser.id,
                }
            });

            if (ipfsCid) {
                await tx.documents.upsert({
                    where: { ipfs_cid: ipfsCid },
                    update: { batch_status: activeStatus },
                    create: {
                        batch_id: batchId,
                        ipfs_cid: ipfsCid,
                        batch_status: activeStatus,
                        description: `Vận đơn bàn giao chuyển tài sản sang Nhà chế biến: ${processorUser.name}`,
                        uploaded_by: userId || updatedBatch.current_owner,
                        type: "DOCUMENT"
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
                        receiver_id: processorUser.id,
                        receiver_name: processorUser.name,
                        receiver_wallet: processorUser.wallet_address
                    }
                }
            });

            await tx.audit_logs.create({
                data: {
                    action: "TRANSFER",
                    description: `Hợp tác xã chuyển giao quyền sở hữu lô hàng #${batchId} sang Nhà Chế Biến (${processorUser.name})`,
                    performed_by: userId || updatedBatch.current_owner,
                    batch_id: batchId,
                    batch_status: activeStatus
                }
            });

            return updatedBatch;
        });

        return res.status(200).json({
            success: true,
            message: "Đồng bộ giao dịch ký chuyển giao sang Nhà chế biến thành công!",
            data: result
        });

    } catch (error) {
        console.error("Lỗi lưu DB sau chuyển giao Nhà chế biến:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi đồng bộ dữ liệu bàn giao thương mại.", error: error.message });
    }
};