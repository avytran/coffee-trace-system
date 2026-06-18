import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";

/**
 * Lấy danh sách các lô hàng có liên quan đến người dùng hiện tại dựa trên vai trò của họ.
 * Tra cứu thông qua bảng actor_engagement để tối ưu hiệu năng và đảm bảo tính chính xác.
 */
export const getBatches = async (req, res) => {
  try {
    // 1. Xác định ví người dùng đang gửi request (Lấy từ JWT middleware)
    const userWallet = (req.user?.wallet_address || req.body.wallet_address || "").toLowerCase();
    if (!userWallet) {
      return res.status(400).json({ success: false, message: "Thiếu địa chỉ ví người thực hiện giao dịch!" });
    }

    // 2. Tìm thông tin người dùng trong cơ sở dữ liệu off-chain để lấy ID và Role
    const user = await prisma.users.findUnique({ where: { wallet_address: userWallet } });
    if (!user) {
      return res.status(404).json({ success: false, message: `Tài khoản ví ${userWallet} chưa đăng ký trên hệ thống.` });
    }

    const userId = user.id;
    const userRole = user.role; // ADMIN, FARMER, COOPERATIVE, PROCESSOR, EXPORTER, RECEIVER, ANONYMOUS

    // Nếu là ADMIN, hiển thị tất cả các lô hàng (không cần lọc theo vai trò trong engagement)
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

    // 3. Xây dựng bộ lọc điều kiện động tùy theo từng Role cụ thể dựa trên Schema actor_engagement
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
        // ANONYMOUS hoặc các role không hợp lệ thì không trả về lô hàng nào
        return res.status(200).json({
          success: true,
          message: "Tài khoản vãng lai hoặc không có vai trò tham gia chuỗi cung ứng.",
          role: userRole,
          data: []
        });
    }

    // 4. Truy vấn tìm các bản ghi engagement thỏa mãn điều kiện lọc vai trò
    // Đồng thời dùng `include` để nạp kèm (Eager Loading) thông tin chi tiết của lô hàng từ bảng cafe_batches
    const engagements = await prisma.actor_engagement.findMany({
      where: roleFilter,
      include: {
        cafe_batch: {
          include: {
            documents: true, // Lấy kèm các tệp tài liệu chứng minh nếu cần hiển thị ở FE
            batch_events: {
              orderBy: { created_at: 'asc' } // Lấy kèm lịch sử sự kiện của lô hàng đó
            }
          }
        }
      },
      orderBy: {
        id: 'desc' // Sắp xếp theo thứ tự engagement mới nhất
      }
    });

    // 5. Bóc tách và định hình lại cấu trúc dữ liệu trả về cho Frontend gọn gàng
    // Loại bỏ các trường ID trung gian của bảng engagement, chỉ giữ lại Object lô hàng nguyên vẹn
    const relatedBatches = engagements
      .map(eng => eng.cafe_batch)
      .filter(batch => batch !== null); // Phòng trường hợp lô hàng bị xóa nhầm trong DB nhưng engagement vẫn còn

    return res.status(200).json({
      success: true,
      message: `Lấy danh sách lô hàng liên quan đến vai trò [${userRole}] thành công.`,
      role: userRole,
      count: relatedBatches.length,
      data: relatedBatches
    });

  } catch (error) {
    console.error("❌ Lỗi xử lý lấy danh sách lô hàng theo quyền tại Controller:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tra cứu dữ liệu lô hàng.",
      error: error.message
    });
  }
};

/**
 * Lấy thông tin chi tiết toàn diện của một lô hàng cụ thể bằng ID (UUID)
 * Gộp toàn bộ các bảng liên quan phục vụ hiển thị giao diện Traceability chi tiết
 */
export const getBatchDetail = async (req, res) => {
  try {
    const { id } = req.params; // Lấy batch_id từ URL kiểu /api/batch/:id

    if (!id) {
      return res.status(400).json({ success: false, message: "Thiếu ID lô hàng để tra cứu!" });
    }

    // Truy vấn một lượt toàn bộ các bảng vệ tinh xoay quanh thực thể lô hàng
    const batch = await prisma.cafe_batches.findUnique({
      where: { id: id },
      include: {
        owner: {
          select: { id: true, name: true, wallet_address: true, role: true }
        },
        cafe_batch_details: true,   // Thông tin chi tiết thu hoạch, độ ẩm, sensory...
        documents: true,            // Tất cả chứng từ, tệp đính kèm trên IPFS
        shipping_info: true,        // Dữ liệu vận chuyển, container
        actor_engagements: {        // Danh sách các actor tham gia chuỗi cung ứng lô này
          include: {
            farmer: { select: { name: true, wallet_address: true } },
            coop: { select: { name: true, wallet_address: true } },
            processor: { select: { name: true, wallet_address: true } },
            exporter: { select: { name: true, wallet_address: true } },
            receiver: { select: { name: true, wallet_address: true } },
          }
        },
        batch_events: {             // Dòng thời gian sự kiện (Timeline Traceability)
          orderBy: { created_at: 'asc' }, // Sắp xếp từ cũ đến mới theo luồng đi quả cà phê
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
    console.error("❌ Lỗi xử lý lấy chi tiết lô hàng tại Controller:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tra cứu chi tiết lô hàng.",
      error: error.message
    });
  }
};