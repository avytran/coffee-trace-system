import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";

export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp tham số 'role' trên query string! (Ví dụ: ?role=COOPERATIVE)"
      });
    }

    const users = await prisma.users.findMany({
      where: {
        role: role.toUpperCase(),
        status: "ACTIVE"
      },
      select: {
        id: true,
        name: true,
        wallet_address: true,
        role: true,
        status: true,
        created_at: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error("Lỗi khi lấy danh sách user theo role:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống, không thể tải danh sách người dùng.",
      error: error.message
    });
  }
};