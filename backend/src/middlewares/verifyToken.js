import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Truy cập bị từ chối! Thiếu mã xác thực JWT." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'MY_SUPER_SECRET_KEY_2026');
    
    req.user = decoded; 
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Mã xác thực JWT đã hết hạn hoặc không hợp lệ!" });
  }
};