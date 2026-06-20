import { prisma } from "../utils/prisma.js";
import { provider } from "../../config/blockchain.js";

const USER_ROLE_MAP = {
  ADMIN_ROLE: "ADMIN",
  FARMER_ROLE: "FARMER",
  COOPERATIVE_ROLE: "COOPERATIVE",
  PROCESSOR_ROLE: "PROCESSOR",
  EXPORTER_ROLE: "EXPORTER",
  RECEIVER_ROLE: "RECEIVER",
  ANONYMOUS_ROLE: "ANONYMOUS",
};

const VALID_USER_ROLES = new Set(["ADMIN", "FARMER", "COOPERATIVE", "PROCESSOR", "EXPORTER", "RECEIVER", "ANONYMOUS"]);

const normalizeUserRole = (role) => {
  if (!role || typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase().replace(/\s+/g, '_');

  if (USER_ROLE_MAP[normalized]) return USER_ROLE_MAP[normalized];
  if (VALID_USER_ROLES.has(normalized)) return normalized;
  return null;
};

export const createPendingUser = async (req, res) => {
  try {
    const { name, wallet_address, role } = req.body;

    console.log('[createPendingUser] req.body:', req.body);

    const walletAddress = wallet_address?.toString().trim();

    if (!name || !walletAddress || !role) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ các trường bắt buộc!" });
    }

    console.log('[createPendingUser] wallet_address:', walletAddress);

    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletAddress.match(walletRegex)) {
      return res.status(400).json({ message: "Định dạng địa chỉ ví không hợp lệ." });
    }

    const normalizedWallet = walletAddress.toLowerCase();
    const dbRole = normalizeUserRole(role);

    if (!dbRole) {
      return res.status(400).json({
        message: "Vai trò không hợp lệ. Vui lòng gửi role ở dạng ADMIN_ROLE, FARMER_ROLE, COOPERATIVE_ROLE, PROCESSOR_ROLE, EXPORTER_ROLE, RECEIVER_ROLE, ANONYMOUS_ROLE hoặc tương ứng plain values ADMIN, FARMER, COOPERATIVE, PROCESSOR, EXPORTER, RECEIVER, ANONYMOUS."
      });
    }

    const existingUser = await prisma.users.findUnique({
      where: { wallet_address: normalizedWallet },
    });

    if (existingUser) {
      if (existingUser.status === "ACTIVE") {
        return res.status(400).json({
          message: "Địa chỉ ví đối tác này đã tồn tại và đang HOẠT ĐỘNG trên hệ thống!"
        });
      }

      console.log(`[createPendingUser] Ví ${normalizedWallet} đã tồn tại với trạng thái SUSPENDED. Cho phép tái kích hoạt.`);

      return res.status(200).json({
        success: true,
        message: "Tài khoản đang ở trạng thái chờ kích hoạt. Vui lòng ký MetaMask để hoàn tất.",
        userId: existingUser.id,
      });
    }

    const newUser = await prisma.users.create({
      data: {
        name,
        wallet_address: normalizedWallet,
        role: dbRole,
        status: "SUSPENDED",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Đã khởi tạo thông tin tạm thời. Vui lòng ký MetaMask để hoàn tất.",
      userId: newUser.id,
    });

  } catch (error) {
    console.error("Lỗi tại createPendingUser (Prisma):", error);
    return res.status(500).json({ message: "Lỗi hệ thống khi tạo tài khoản chờ duyệt." });
  }
};

export const syncBlockchainSuccess = async (req, res) => {
  try {
    const { userId, txHash } = req.body;

    if (!userId || !txHash) {
      return res.status(400).json({ message: "Thiếu dữ liệu đối chiếu (userId hoặc txHash)." });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy thông tin tài khoản tương ứng trong DB." });
    }

    if (user.status === "ACTIVE") {
      return res.status(400).json({ message: "Tài khoản này đã được kích hoạt từ trước." });
    }

    console.log(`[Prisma] Đang xác thực giao dịch ${txHash} trên Blockchain...`);

    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status !== 1) {
      await prisma.users.update({
        where: { id: user.id },
        data: { status: "SUSPENDED" },
      });
      return res.status(400).json({
        message: "Giao dịch On-chain thất bại (Reverted)! Vui lòng kiểm tra ví Admin."
      });
    }

    const updatedUser = await prisma.users.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Xác thực thành công. Tài khoản đã chuyển sang trạng thái ACTIVE.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        wallet_address: updatedUser.wallet_address,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });

  } catch (error) {
    console.error("Lỗi tại syncBlockchainSuccess (Prisma):", error);
    return res.status(500).json({
      message: "Không thể xác thực giao dịch Blockchain. RPC node có thể đang chậm, vui lòng thử lại."
    });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, activeUsers, suspendedUsers] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { status: "ACTIVE" } }),
      prisma.users.count({ where: { status: "SUSPENDED" } }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu thống kê Dashboard thành công.",
      data: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalTransactions: 0
      }
    });

  } catch (error) {
    console.error("Lỗi tại getDashboardStats (Prisma):", error);
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi hệ thống khi thu thập số liệu thống kê." 
    });
  }
};

export const getPermissionsList = async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : "";
    const roleFilter = req.query.role ? String(req.query.role).trim().toUpperCase() : "";
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereCondition = {};

    if (search) {
      whereCondition.OR = [
        { wallet_address: { contains: search.toLowerCase() } },
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (roleFilter) {
      whereCondition.role = roleFilter;
    }

    const [totalRecords, users] = await Promise.all([
      prisma.users.count({ where: whereCondition }),
      prisma.users.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        orderBy: {
          id: 'desc'
        },
        select: { 
          id: true,
          name: true,
          wallet_address: true,
          role: true,
          status: true,
        }
      })
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit
      }
    });

  } catch (error) {
    console.error("Lỗi tại getPermissionsList (Prisma):", error);
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi hệ thống khi tải danh sách phân quyền." 
    });
  }
};