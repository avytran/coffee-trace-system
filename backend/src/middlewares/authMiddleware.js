import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Chưa đăng nhập; vui lòng cung cấp token xác thực.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const agent = await prisma.agent.findUnique({
      where: { walletAddress: decoded.walletAddress.toLowerCase() }
    });

    if (!agent || !agent.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.'
      });
    }

    req.user = agent;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token không hợp lệ hoặc đã hết hạn.'
    });
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Vai trò "${req.user.role}" không có quyền thực hiện hành động này. Yêu cầu: ${roles.join(', ')}.`
      });
    }
    next();
  };
};
