import { uploadBufferToIPFS } from "../utils/ipfsUtil.js";

export const autoIpfsUpload = async (req, res, next) => {
  try {
    const userWallet = (req.user?.wallet_address || req.body.wallet_address || "").toLowerCase();
    
    if (!userWallet) {
      return res.status(400).json({ success: false, message: "Thiếu địa chỉ ví để thực hiện định danh IPFS!" });
    }

    const docDesc = req.body.document_desc || "";
    const fileNameSeed = req.body.traceability_code || "BatchFile";

    console.log("[Middleware IPFS] Đang tự động xử lý tệp minh chứng...");

    const finalIpfsCid = await uploadBufferToIPFS(
      req.file?.buffer,
      req.file?.originalname || fileNameSeed,
      userWallet,
      docDesc
    );

    req.body.computedIpfsCid = finalIpfsCid;

    console.log(`[Middleware IPFS] Xử lý xong. CID cấp cho Controller: ${finalIpfsCid}`);
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi nghẽn luồng xử lý IPFS tại hệ thống trung gian.",
      error: error.message
    });
  }
};