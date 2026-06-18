import { Readable } from "stream";
import {pinata} from "./pinata.js";
import crypto from "crypto";

export const uploadBufferToIPFS = async (fileBuffer, originalName, walletAddress, description = "") => {
  try {
    if (!fileBuffer) {
      const seedData = (originalName || "Fallback") + Date.now() + walletAddress;
      return "Qm" + crypto.createHash("sha256").update(seedData).digest("hex").substring(0, 44);
    }

    const stream = Readable.from(fileBuffer);

    const options = {
      pinataMetadata: {
        name: `CoffeeDoc_${originalName || "Doc"}_${Date.now()}`,
        keyvalues: {
          uploaderWallet: walletAddress || "unknown",
          description: description || "Tài liệu minh chứng chuỗi cung ứng"
        }
      }
    };

    const pinataResponse = await pinata.pinFileToIPFS(stream, options);
    return pinataResponse.IpfsHash;
  } catch (error) {
    console.error("Lỗi tại ipfsUtil:", error);
    throw new Error(`Thất bại khi đẩy file lên IPFS: ${error.message}`);
  }
};