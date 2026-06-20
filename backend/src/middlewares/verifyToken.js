import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  // Lấy chuỗi token từ header "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Truy cập bị từ chối! Thiếu mã xác thực JWT." });
  }

  try {
    // Giải mã chuỗi token bằng Secret Key
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'MY_SUPER_SECRET_KEY_2026');
    
    // Găm dữ liệu giải mã được (gồm id, wallet_address, role) thẳng vào object `req.user`
    req.user = decoded; 
    
    next(); // Hợp lệ thì cho đi tiếp sang Controller
  } catch (error) {
    return res.status(401).json({ success: false, message: "Mã xác thực JWT đã hết hạn hoặc không hợp lệ!" });
  }
};