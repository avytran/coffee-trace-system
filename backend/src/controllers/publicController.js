
import { prisma } from '../server.js';

const serializeBigInt = (obj) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
};

export const getPublicLotExplorer = async (req, res) => {
  try {
    const { id_or_qrcode } = req.params;
    
    const isId = /^\d+$/.test(id_or_qrcode);

    const lotData = await prisma.coffeeLot.findUnique({
      where: isId 
        ? { lotId: BigInt(id_or_qrcode) } 
        : { qrCode: id_or_qrcode },
      include: {
        stageDetails: { 
          orderBy: {
            blockchainTimestamp: 'asc' 
          }
        },
        farmer: { 
          select: {
            name: true,
            physicalAddress: true
          }
        }
      }
    });

    if (!lotData) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy dữ liệu nguồn gốc của mã sản phẩm này."
      });
    }

    return res.status(200).json({
      status: "success",
      data: serializeBigInt(lotData)
    });

  } catch (error) {
    console.error("❌ Error at Public Explorer API:", error);
    return res.status(500).json({ error: "Lỗi xử lý hệ thống tra cứu công khai." });
  }
};