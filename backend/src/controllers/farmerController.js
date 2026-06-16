import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";
import crypto from 'crypto';
import { pinata } from "../utils/pinata.js";
import { Readable } from 'stream';
import { ethers } from "ethers";

export const createBatch = async (req, res) => {
  try {
    const {
      traceability_code,
      plant_variety,
      weight,
      latitude,
      longitude,
      altitude,
      cultivation_info,
      document_desc,
      computedIpfsCid // Nhận từ Middleware tự động đẩy file lên IPFS
    } = req.body;

    const suggestedBatchId = crypto.randomUUID();
    const finalTraceabilityCode = traceability_code || `CF-${suggestedBatchId.substring(0, 8).toUpperCase()}`;

    // 1. 🌟 ĐÓNG GÓI PAYLOAD OFF-CHAIN
    const eventPayload = {
      batchId: suggestedBatchId,
      traceabilityCode: finalTraceabilityCode,
      weight: parseFloat(weight) || 0,
      plant_variety: plant_variety || "Unknown",
      latitude: parseFloat(latitude) || 0.0,
      longitude: parseFloat(longitude) || 0.0,
      altitude: parseFloat(altitude) || 0.0,
      cultivation_info: cultivation_info || "",
      document_desc: document_desc || "Tài liệu khởi tạo gốc",
      ipfsCid: computedIpfsCid
    };

    const stringifiedData = JSON.stringify(eventPayload);
    const generatedEventHash = ethers.keccak256(ethers.toUtf8Bytes(stringifiedData));

    return res.status(200).json({
      success: true,
      message: "Thiết lập gói tin và sinh mã băm đối soát thành công!",
      data: {
        batchId: suggestedBatchId,             
        traceabilityCode: finalTraceabilityCode, 
        ipfsCid: computedIpfsCid,              
        weight: parseFloat(weight) || 0,       
        eventHash: generatedEventHash,
        metadata: {
          plant_variety: eventPayload.plant_variety,
          latitude: eventPayload.latitude,
          longitude: eventPayload.longitude,
          altitude: eventPayload.altitude,
          cultivation_info: eventPayload.cultivation_info,
          document_desc: eventPayload.document_desc,
          rawPayload: stringifiedData 
        }
      }
    });

  } catch (error) {
    console.error("❌ Lỗi tại Backend createBatch:", error);
    return res.status(500).json({ success: false, message: "Lỗi tạo payload hệ thống." });
  }
};

export const saveBatchToDb = async (req, res) => {
  try {
    const payload = req.body || {};
    const batchId = payload.batchId || payload.batch_id;
    const traceabilityCode = payload.traceabilityCode || payload.traceability_code || payload.traceability || "";
    const ipfsCid = payload.ipfsCid || payload.ipfs_cid || payload.ipfs || "";
    const weight = payload.weight || payload.wt || 0;
    const txHash = payload.txHash || payload.tx_hash || payload.transactionHash || "";

    let metadata = payload.metadata || {};
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (err) {
        metadata = {};
      }
    }

    const userId = metadata.user_id || metadata.userId || req.user?.id;

    if (!batchId || !txHash) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin ID lô hàng hoặc Transaction Hash từ Blockchain." });
    }

    console.log('[saveBatchToDb] request body:', JSON.stringify(payload));
    console.log('[saveBatchToDb] normalized payload:', { batchId, traceabilityCode, ipfsCid, weight, txHash, metadata, userId });

    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu user_id để liên kết lô hàng với người dùng." });
    }

    console.log(`💾 Đang tiến hành lưu lô hàng ${traceabilityCode} vào PostgreSQL...`);

    const newBatch = await prisma.$transaction(async (tx) => {
      const batch = await tx.cafe_batches.upsert({
        where: { id: batchId },
        update: {
          traceability_node: traceabilityCode || "UNKNOWN",
          plant_variety: metadata.plant_variety || metadata.plantVariety || "Unknown",
          longitude: parseFloat(metadata.longitude) || 0.0,
          latitude: parseFloat(metadata.latitude) || 0.0,
          altitude: parseFloat(metadata.altitude) || 0.0,
          weight: parseFloat(weight) || 0,
          cultivation_bio: metadata.cultivation_info || metadata.cultivationInfo || "Standard",
          current_owner: userId,
          status: "INITIAL"
        },
        create: {
          id: batchId,
          traceability_node: traceabilityCode || "UNKNOWN",
          plant_variety: metadata.plant_variety || metadata.plantVariety || "Unknown",
          longitude: parseFloat(metadata.longitude) || 0.0,
          latitude: parseFloat(metadata.latitude) || 0.0,
          altitude: parseFloat(metadata.altitude) || 0.0,
          weight: parseFloat(weight) || 0,
          cultivation_bio: metadata.cultivation_info || metadata.cultivationInfo || "Standard",
          current_owner: userId,
          status: "INITIAL"
        }
      });

      const normalizedIpfsCid = (ipfsCid || "").toString().trim();
      const documentCid = normalizedIpfsCid || `Qm${crypto.randomBytes(24).toString("hex")}`;

      await tx.documents.upsert({
        where: { ipfs_cid: documentCid },
        update: {
          batch_id: batch.id,
          batch_status: "INITIAL",
          description: metadata.document_desc || metadata.documentDesc || "Tài liệu khởi tạo gốc",
          uploaded_by: userId,
          type: "DOCUMENT"
        },
        create: {
          batch_id: batch.id,
          ipfs_cid: documentCid,
          batch_status: "INITIAL",
          description: metadata.document_desc || metadata.documentDesc || "Tài liệu khởi tạo gốc",
          uploaded_by: userId,
          type: "DOCUMENT"
        }
      });

      const batchEvent = await tx.batch_events.findFirst({
        where: { batch_id: batch.id, event_type: "CREATE_BATCH", performed_by: userId }
      });
      if (!batchEvent) {
        await tx.batch_events.create({
          data: {
            batch_id: batch.id,
            event_type: "CREATE_BATCH",
            performed_by: userId,
            ipfs_cid: ipfsCid || "",
            event_data: {
              txHash,
              ipfsCid,
              weight: parseFloat(weight) || 0,
              metadata
            }
          }
        });
      }

      const engagement = await tx.actor_engagement.findFirst({
        where: { batch_id: batch.id, farmer_id: userId }
      });
      if (!engagement) {
        await tx.actor_engagement.create({
          data: {
            batch_id: batch.id,
            farmer_id: userId,
            batch_status: "INITIAL"
          }
        });
      }

      const audit = await tx.audit_logs.findFirst({
        where: { batch_id: batch.id, action: "CREATE_BATCH", performed_by: userId }
      });
      if (!audit) {
        await tx.audit_logs.create({
          data: {
            action: "CREATE_BATCH",
            description: `Tạo lô hàng mới ${traceabilityCode} trên chuỗi`,
            performed_by: userId,
            batch_id: batch.id,
            batch_status: "INITIAL"
          }
        });
      }

      return batch;
    });

    return res.status(200).json({
      success: true,
      message: "Đã tạo mới lô hàng và ghi đồng bộ tới batch_events, actor_engagement, audit_logs, documents.",
      data: newBatch
    });

  } catch (error) {
    console.error("❌ Lỗi lưu DB sau Blockchain:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi ghi nhận dữ liệu vào DB.", error: error.message });
  }
};

/**
 * [Luồng 2] Kiểm tra tính hợp lệ của đối tác nhận (HTX) trước khi tiến hành giao dịch On-chain
 */
export const verifyTransferPartner = async (req, res) => {
  const { batchId, target_cooperative_wallet, wallet_address } = req.body;

  try {
    const senderWallet = wallet_address.toLowerCase();
    const receiverWallet = target_cooperative_wallet.toLowerCase();

    // 1. Kiểm tra lô hàng hiện tại
    const batch = await prisma.cafe_batches.findUnique({ where: { id: batchId } });
    if (!batch || batch.current_owner.toLowerCase() !== senderWallet) {
      return res.status(403).json({ message: "Thao tác không hợp lệ. Bạn không sở hữu lô hàng này." });
    }

    // 2. Xác thực đối tác nhận (HTX) xem đã được Admin đăng ký phân quyền trên hệ thống chưa
    const cooperativeAgent = await prisma.users.findUnique({
      where: { wallet_address: receiverWallet }
    });

    if (!cooperativeAgent || cooperativeAgent.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Địa chỉ ví nhận chưa được đăng ký hoặc chưa được kích hoạt trên hệ thống!"
      });
    }

    if (cooperativeAgent.role !== "COOPERATIVE") {
      return res.status(400).json({
        message: `Địa chỉ ví nhận thuộc vai trò [${cooperativeAgent.role}]. Bạn chỉ được phép bàn giao lô hàng thô cho Hợp Tác Xã (COOPERATIVE).`
      });
    }

    return res.json({
      success: true,
      message: "Đối tác tiếp nhận hợp lệ. Sẵn sàng mở MetaMask ký chuyển giao tài sản."
    });

  } catch (error) {
    console.error("Lỗi xác thực chuyển giao tại Controller:", error);
    return res.status(500).json({ message: "Lỗi hệ thống trong quá trình đối soát ví nhận." });
  }
};

export const harvestBatch = async (req, res) => {
  const { batch_id, harvest_time, harvest_method, tx_hash } = req.body;
  const actorWallet = (req.user?.wallet_address || req.body.wallet_address || "").toLowerCase();
  const jwtUserId = req.user?.id;

  // Kiểm tra dữ liệu đầu vào cơ bản
  if (!batch_id || !harvest_time || !harvest_method || !tx_hash) {
    return res.status(400).json({ success: false, message: "Yêu cầu đầy đủ thông tin thu hoạch và TxHash!" });
  }

  try {
    // 1. CHỨNG THỰC ON-CHAIN (Bảo mật nâng cao)
    // Kết nối đến mạng Blockchain Node (Hardhat/Ganache/Anvil) để quét biên lai
    const txReceipt = await provider.getTransactionReceipt(tx_hash);

    if (!txReceipt) {
      return res.status(400).json({ success: false, message: "Giao dịch không tồn tại trên mạng lưới Blockchain hoặc đang bị nghẽn!" });
    }

    if (Number(txReceipt.status) !== 1) {
      return res.status(400).json({ success: false, message: "Giao dịch Blockchain đã bị Revert (Thất bại) on-chain!" });
    }

    // 2. KIỂM TRA ĐIỀU KIỆN ĐỐI SOÁT TRONG DATABASE
    const existingBatch = await prisma.cafe_batches.findUnique({ where: { id: batch_id } });
    if (!existingBatch) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lô hàng tương ứng trong DB." });
    }
    if (existingBatch.status !== "INITIAL") {
      return res.status(400).json({ success: false, message: "Lô hàng này đã vượt qua giai đoạn khởi tạo." });
    }

    // 2.5. Xác thực người thực hiện thao tác và đảm bảo UUID tồn tại trong users
    let actorUser = null;
    if (jwtUserId) {
      actorUser = await prisma.users.findUnique({ where: { id: jwtUserId } });
    }
    if (!actorUser && actorWallet) {
      actorUser = await prisma.users.findUnique({ where: { wallet_address: actorWallet } });
    }
    if (!actorUser && actorWallet) {
      actorUser = await prisma.users.create({
        data: {
          wallet_address: actorWallet,
          name: `Farmers Web3 ${actorWallet.substring(0, 6).toUpperCase()}`,
          role: "FARMER",
          status: "ACTIVE"
        }
      });
    }
    if (!actorUser) {
      return res.status(400).json({ success: false, message: "Không thể xác định người dùng thực hiện hành động thu hoạch." });
    }

    // 3. ĐỒNG BỘ ATOMIC TRANSACTION VÀO POSTGRESQL
    const dbResult = await prisma.$transaction(async (tx) => {
      // A. Cập nhật trạng thái lõi
      const updatedBatch = await tx.cafe_batches.update({
        where: { id: batch_id },
        data: {
          status: "HARVESTED"
        }
      });

      // B. Cập nhật trạng thái engagement để giữ đồng bộ chuỗi cung ứng
      await tx.actor_engagement.updateMany({
        where: { batch_id: batch_id },
        data: { batch_status: "HARVESTED" }
      });

      // C. Đẩy bản ghi vào bảng chi tiết kỹ thuật
      const batchDetail = await tx.cafe_batch_details.create({
        data: {
          batch_id: batch_id,
          harvest_time: new Date(harvest_time),
          harvest_method: harvest_method,
          processing_method: "",
          fermentation_duration: 0,
          moisture_content: 0,
          defect_count: 0,
          defect_reason: "",
          roasting_temperature: 0,
          roasting_duration: 0,
          roast_batch_size: 0,
          sensory_score: 0,
          quality_grade: "C"
        }
      });

      // D. Khởi tạo dấu mốc trên dòng thời gian Traceability hiển thị UI công khai
      const batchEvent = await tx.batch_events.create({
        data: {
          batch_id: batch_id,
          event_type: "HARVEST",
          performed_by: actorUser.id,
          ipfs_cid: "",
          event_data: {
            harvest_method,
            harvest_time,
            txHash: tx_hash
          }
        }
      });

      // E. Lưu nhật ký Audit bảo mật hệ thống
      await tx.audit_logs.create({
        data: {
          action: "HARVEST",
          description: `Thu hoạch lô hàng ${batch_id} với txHash ${tx_hash}`,
          performed_by: actorUser.id,
          batch_id: batch_id,
          batch_status: "HARVESTED"
        }
      });

      return { updatedBatch, batchDetail, batchEvent };
    });

    return res.status(200).json({
      success: true,
      message: "Đồng bộ dữ liệu sổ cái Blockchain và Database thành công!",
      data: {
        batch_id: dbResult.updatedBatch.id,
        status: dbResult.updatedBatch.status,
        txHash: tx_hash
      }
    });

  } catch (error) {
    console.error("❌ Lỗi xử lý đồng bộ dữ liệu sau thu hoạch:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý nội bộ cơ sở dữ liệu hệ thống.",
      error: error.message
    });
  }
};

/**
 * API: Xác nhận chuyển giao lô hàng sang Hợp Tác Xã (COOPERATIVE)
 * Luồng xử lý: Xác thực TxHash -> Kiểm tra Trạng thái lô -> Đồng bộ Người nhận & Người chuyển -> Cập nhật Database liên tầng
 */
export const transferToCoop = async (req, res) => {
  const { batch_id, cooperative_name, tx_hash, coop_wallet_address } = req.body;
  const actorWallet = (req.user?.wallet_address || req.body.wallet_address || "").toLowerCase();
  const jwtUserId = req.user?.id;

  // 1. Kiểm tra dữ liệu đầu vào cơ bản
  // Cần coop_wallet_address (hoặc lấy từ hệ thống) để liên kết chính xác chủ sở hữu mới
  if (!batch_id || !cooperative_name || !tx_hash || !coop_wallet_address) {
    return res.status(400).json({
      success: false,
      message: "Yêu cầu đầy đủ thông tin: batch_id, cooperative_name, tx_hash và coop_wallet_address!"
    });
  }

  const targetCoopWallet = coop_wallet_address.toLowerCase();

  try {
    // =========================================================================
    // BƯỚC 1: CHỨNG THỰC ON-CHAIN GIAO DỊCH CHUYỂN NHƯỢNG TÀI SẢN
    // =========================================================================
    const txReceipt = await provider.getTransactionReceipt(tx_hash);

    if (!txReceipt) {
      return res.status(400).json({ success: false, message: "Giao dịch không tồn tại trên mạng lưới Blockchain hoặc đang bị nghẽn!" });
    }

    if (Number(txReceipt.status) !== 1) {
      return res.status(400).json({ success: false, message: "Giao dịch Blockchain đã bị Revert (Thất bại) on-chain!" });
    }

    // =========================================================================
    // BƯỚC 2: KIỂM TRA ĐIỀU KIỆN ĐỐI SOÁT LÔ HÀNG TRONG DATABASE
    // =========================================================================
    const existingBatch = await prisma.cafe_batches.findUnique({ where: { id: batch_id } });
    if (!existingBatch) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lô hàng tương ứng trong DB." });
    }

    // Đảm bảo lô hàng đã thu hoạch thì mới được phép chuyển giao sang HTX sơ chế
    if (existingBatch.status !== "HARVESTED") {
      return res.status(400).json({
        success: false,
        message: `Lô hàng đang ở trạng thái [${existingBatch.status}]. Chỉ lô hàng đã thu hoạch (HARVESTED) mới được chuyển giao!`
      });
    }

    // =========================================================================
    // BƯỚC 2.5: XÁC THỰC NGƯỜI GỬI (FARMER) & NGƯỜI NHẬN (COOPERATIVE) TRONG DB
    // =========================================================================
    // A. Xác thực Farmer thực hiện hành động
    let actorUser = null;
    if (jwtUserId) {
      actorUser = await prisma.users.findUnique({ where: { id: jwtUserId } });
    }
    if (!actorUser && actorWallet) {
      actorUser = await prisma.users.findUnique({ where: { wallet_address: actorWallet } });
    }
    if (!actorUser && actorWallet) {
      actorUser = await prisma.users.create({
        data: {
          wallet_address: actorWallet,
          name: `Farmer Web3 ${actorWallet.substring(0, 6).toUpperCase()}`,
          role: "FARMER",
          status: "ACTIVE"
        }
      });
    }
    if (!actorUser) {
      return res.status(400).json({ success: false, message: "Không thể xác định người dùng thực hiện chuyển giao." });
    }

    // B. Xác thực hoặc Tự động khởi tạo tài khoản Hợp Tác Xã nhận bàn giao
    let coopUser = await prisma.users.findUnique({ where: { wallet_address: targetCoopWallet } });
    if (!coopUser) {
      coopUser = await prisma.users.create({
        data: {
          wallet_address: targetCoopWallet,
          name: cooperative_name,
          role: "COOPERATIVE",
          status: "ACTIVE"
        }
      });
    }

    // =========================================================================
    // BƯỚC 3: ĐỒNG BỘ ATOMIC TRANSACTION VÀO POSTGRESQL
    // =========================================================================
    const dbResult = await prisma.$transaction(async (tx) => {

      // A. Cập nhật chủ sở hữu mới (owner_id) cho lô hàng chính. 
      // Trạng thái giữ nguyên hoặc chuyển tiếp tùy thuộc vào thiết kế (ở đây giữ nguyên luồng của bạn là đổi chủ)
      const updatedBatch = await tx.cafe_batches.update({
        where: { id: batch_id },
        data: {
          status: "PRE_PROCESSED",
          current_owner: coopUser.id, // 🌟 Chuyển giao quyền sở hữu tài sản off-chain
          updated_at: new Date()
        }
      });

      // B. Cập nhật trạng thái engagement của các bên tham gia trong chuỗi
      await tx.actor_engagement.updateMany({
        where: { batch_id: batch_id },
        data: {
          coop_id: coopUser.id,
          batch_status: "PRE_PROCESSED"
        }
      });

      // C. Khởi tạo dấu mốc chuyển giao trên dòng thời gian Traceability Timeline hiển thị ngoài UI
      const batchEvent = await tx.batch_events.create({
        data: {
          batch_id: batch_id,
          event_type: "TRANSFER", // 🤝 Sự kiện chuyển giao
          performed_by: actorUser.id,
          ipfs_cid: "",
          event_data: {
            from_farmer: actorUser.name,
            from_wallet: actorWallet,
            to_cooperative: coopUser.name,
            to_wallet: targetCoopWallet,
            status: "PRE_PROCESSED",
            txHash: tx_hash
          }
        }
      });

      // D. Lưu nhật ký Audit bảo mật hệ thống phục vụ thanh tra nội bộ
      await tx.audit_logs.create({
        data: {
          action: "TRANSFER",
          description: `Bàn giao quyền sở hữu lô hàng ${batch_id} từ Farmer (${actorUser.id}) sang HTX ${cooperative_name} (${coopUser.id})`,
          performed_by: actorUser.id,
          batch_id: batch_id,
          batch_status: "PRE_PROCESSED"
        }
      });

      return { updatedBatch, batchEvent };
    });

    // 4. Trả kết quả thành công phản hồi về client
    return res.status(200).json({
      success: true,
      message: "Đồng bộ hợp đồng bàn giao sang Hợp Tác Xã thành công!",
      data: {
        batch_id: dbResult.updatedBatch.id,
        current_owner: dbResult.updatedBatch.current_owner,
        cooperative: cooperative_name,
        txHash: tx_hash
      }
    });

  } catch (error) {
    console.error("❌ Lỗi xử lý đồng bộ dữ liệu chuyển giao HTX:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý nội bộ cơ sở dữ liệu hệ thống khi bàn giao.",
      error: error.message
    });
  }
};