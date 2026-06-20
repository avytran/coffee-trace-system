import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";

export const getBatches = async (req, res) => {
  try {
    const userWallet = (req.user?.wallet_address || req.body.wallet_address || "").toLowerCase();
    if (!userWallet) {
      return res.status(400).json({ success: false, message: "Thiếu địa chỉ ví người thực hiện giao dịch!" });
    }

    const user = await prisma.users.findUnique({ where: { wallet_address: userWallet } });
    if (!user) {
      return res.status(404).json({ success: false, message: `Tài khoản ví ${userWallet} chưa đăng ký trên hệ thống.` });
    }

    const userId = user.id;
    const userRole = user.role;

    if (userRole === "ADMIN") {
      const allBatches = await prisma.cafe_batches.findMany({
        orderBy: { created_at: 'desc' },
        include: {
          documents: true,
          batch_events: true
        }
      });
      return res.status(200).json({
        success: true,
        message: "Lấy toàn bộ danh sách lô hàng thành công (Quyền ADMIN).",
        role: userRole,
        data: allBatches
      });
    }

    let roleFilter = {};
    
    switch (userRole) {
      case "FARMER":
        roleFilter = { farmer_id: userId };
        break;
      case "COOPERATIVE":
        roleFilter = { coop_id: userId };
        break;
      case "PROCESSOR":
        roleFilter = { processor_id: userId };
        break;
      case "EXPORTER":
        roleFilter = { exporter_id: userId };
        break;
      case "RECEIVER":
        roleFilter = { receiver_id: userId };
        break;
      default:
        return res.status(200).json({
          success: true,
          message: "Tài khoản vãng lai hoặc không có vai trò tham gia chuỗi cung ứng.",
          role: userRole,
          data: []
        });
    }

    const engagements = await prisma.actor_engagement.findMany({
      where: roleFilter,
      include: {
        cafe_batch: {
          include: {
            documents: true,
            batch_events: {
              orderBy: { created_at: 'asc' }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    const relatedBatches = engagements
      .map(eng => eng.cafe_batch)
      .filter(batch => batch !== null);

    return res.status(200).json({
      success: true,
      message: `Lấy danh sách lô hàng liên quan đến vai trò [${userRole}] thành công.`,
      role: userRole,
      count: relatedBatches.length,
      data: relatedBatches
    });

  } catch (error) {
    console.error("Lỗi xử lý lấy danh sách lô hàng theo quyền tại Controller:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tra cứu dữ liệu lô hàng.",
      error: error.message
    });
  }
};

export const getBatchDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: "Thiếu ID lô hàng để tra cứu!" });
    }

    const batch = await prisma.cafe_batches.findUnique({
      where: { id: id },
      include: {
        owner: {
          select: { id: true, name: true, wallet_address: true, role: true }
        },
        cafe_batch_details: true,
        documents: true,
        shipping_info: true,
        actor_engagements: {
          include: {
            farmer: { select: { name: true, wallet_address: true } },
            coop: { select: { name: true, wallet_address: true } },
            processor: { select: { name: true, wallet_address: true } },
            exporter: { select: { name: true, wallet_address: true } },
            receiver: { select: { name: true, wallet_address: true } },
          }
        },
        batch_events: {
          orderBy: { created_at: 'asc' },
          include: {
            user: { select: { name: true, role: true } }
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin lô hàng này trong hệ thống!" });
    }

    return res.status(200).json({
      success: true,
      message: "Tải dữ liệu chi tiết truy xuất nguồn gốc lô hàng thành công.",
      data: batch
    });

  } catch (error) {
    console.error("Lỗi xử lý lấy chi tiết lô hàng tại Controller:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tra cứu chi tiết lô hàng.",
      error: error.message
    });
  }
};