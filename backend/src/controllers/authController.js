import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { prisma } from "../utils/prisma.js";

export const verifyWalletAndGetRole = async (req, res) => {
  try {
    const { wallet_address, signature, message } = req.body;

    if (!wallet_address || !signature || !message) {
      return res.status(400).json({ 
        success: false,
        message: "Yêu cầu không hợp lệ. Thiếu địa chỉ ví, chữ ký số hoặc thông điệp gốc." 
      });
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
      return res.status(401).json({ 
        success: false,
        isAuthenticated: false,
        message: "Xác thực chữ ký số thất bại! Phát hiện hành vi giả mạo gói tin dữ liệu." 
      });
    }

    const user = await prisma.users.findUnique({
      where: { 
        wallet_address: wallet_address.toLowerCase() 
      },
    });

    if (!user) {
      return res.status(200).json({
        isAuthenticated: false,
        role: "ANONYMOUS",
        status: "UNREGISTERED",
        message: "Địa chỉ ví này chưa được đăng ký trong hệ thống cung ứng."
      });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({
        isAuthenticated: false,
        role: user.role,
        status: user.status,
        message: "Tài khoản của bạn đang bị tạm ngưng hoạt động bởi Admin."
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        wallet_address: user.wallet_address, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'MY_SUPER_SECRET_KEY_2026',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      isAuthenticated: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        wallet_address: user.wallet_address,
        role: user.role, 
        status: user.status
      }
    });

  } catch (error) {
    console.error("Lỗi xác thực chữ ký ví:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xác thực chữ ký." });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const decodedUser = req.user; 

    if (!decodedUser) {
      return res.status(401).json({ success: false, message: "Không tìm thấy thông tin xác thực." });
    }

    const user = await prisma.users.findUnique({
      where: { id: decodedUser.id },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Tài khoản không tồn tại trên hệ thống." });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ success: false, message: "Tài khoản này đã bị Admin khóa." });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        wallet_address: user.wallet_address,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error("Lỗi khi lấy thông tin Profile:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy thông tin profile." });
  }
};