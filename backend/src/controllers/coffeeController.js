/*
export const getAllLots = async (req, res) => {};
export const getLotById = async (req, res) => {};
*/
exports.getMyLots = async (req, res) => {
    try {
        const { status } = req.query; 
        const lots = await prisma.coffeeLot.findMany({
            where: status ? { currentStatus: status } : {}
        });
        res.json(lots);
    } catch (error) {
        res.status(500).json({ error: "Khong the lay danh sach lot" });
    }
};