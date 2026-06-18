import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { prisma } from "../utils/prisma.js";

/**
 * POST /api/auth/verify-wallet
 * API xác thực người dùng dựa trên Chữ ký số MetaMask & Cấp JWT Token
 */
export const verifyWalletAndGetRole = async (req, res) => {
  try {
    const { wallet_address, signature, message } = req.body;

    // 🌟 Kiểm tra nghiêm ngặt dữ liệu đầu vào theo chuẩn chữ ký số
    if (!wallet_address || !signature || !message) {
      return res.status(400).json({ 
        success: false,
        message: "Yêu cầu không hợp lệ. Thiếu địa chỉ ví, chữ ký số hoặc thông điệp gốc." 
      });
    }

    // 🌟 BƯỚC MẤY CHỐT: Khôi phục địa chỉ ví thực tế từ chữ ký (Signature Verification)
    // ethers.verifyMessage sẽ giải mã signature + message để tìm ra Public Key (Ví) đã ký nó
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
      return res.status(401).json({ 
        success: false,
        isAuthenticated: false,
        message: "Xác thực chữ ký số thất bại! Phát hiện hành vi giả mạo gói tin dữ liệu." 
      });
    }

    // Tìm kiếm thông tin người dùng trong PostgreSQL qua Prisma
    const user = await prisma.users.findUnique({
      where: { 
        wallet_address: wallet_address.toLowerCase() 
      },
    });

    // Trường hợp 1: Ví chưa được Admin đăng ký trong hệ thống
    if (!user) {
      return res.status(200).json({
        isAuthenticated: false,
        role: "ANONYMOUS",
        status: "UNREGISTERED",
        message: "Địa chỉ ví này chưa được đăng ký trong hệ thống cung ứng."
      });
    }

    // Trường hợp 2: Tài khoản bị khóa (Thu hồi quyền)
    if (user.status === "SUSPENDED") {
      return res.status(403).json({
        isAuthenticated: false,
        role: user.role,
        status: user.status,
        message: "Tài khoản của bạn đang bị tạm ngưng hoạt động bởi Admin."
      });
    }

    // 🌟 BƯỚC TẠO JWT: Ký mã hóa thông tin User thành một chuỗi Token (Hạn dùng 1 ngày)
    // 'MY_SUPER_SECRET_KEY_2026' là khóa bí mật, bạn nên ném vào file .env (JWT_SECRET)
    const token = jwt.sign(
      { 
        id: user.id, 
        wallet_address: user.wallet_address, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'MY_SUPER_SECRET_KEY_2026',
      { expiresIn: '1d' }
    );

    // Trường hợp 3: Hợp lệ -> Trả về thông tin, vai trò VÀ CHUỖI TOKEN JWT
    return res.status(200).json({
      success: true,
      isAuthenticated: true,
      token: token, // 🌟 Frontend sẽ nhận chuỗi này và lưu vào localStorage
      user: {
        id: user.id,
        name: user.name,
        wallet_address: user.wallet_address,
        role: user.role, 
        status: user.status
      }
    });

  } catch (error) {
    console.error("❌ Lỗi xác thực chữ ký ví:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xác thực chữ ký." });
  }
};