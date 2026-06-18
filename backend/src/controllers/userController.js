import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";

/**
 * API: Lấy danh sách người dùng theo Role
 * URL: /api/users?role=COOPERATIVE
 */
export const getUsersByRole = async (req, res) => {
  try {
    // 1. Lấy role từ query string trên URL (ép thành chữ in hoa để khớp với DB)
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp tham số 'role' trên query string! (Ví dụ: ?role=COOPERATIVE)"
      });
    }

    // 2. Truy vấn database bằng Prisma
    const users = await prisma.users.findMany({
      where: {
        role: role.toUpperCase(),
        status: "ACTIVE" // Chỉ lấy các tài khoản đang hoạt động
      },
      select: {
        id: true,
        name: true,
        wallet_address: true,
        role: true,
        status: true,
        created_at: true
        // Không select mật khẩu hoặc các thông tin nhạy cảm ở đây
      },
      orderBy: {
        name: 'asc' // Sắp xếp theo tên từ A-Z để dễ hiển thị lên Dropdown
      }
    });

    // 3. Trả kết quả về cho Client
    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách user theo role:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống, không thể tải danh sách người dùng.",
      error: error.message
    });
  }
};