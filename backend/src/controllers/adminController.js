import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

export const getAgents = async (req, res) => {
    try {
        const agents = await prisma.agent.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ success: true, data: agents });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

export const updateAgentStatus = async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ message: "Field 'isActive' must be a boolean." });
        }

        const updatedAgent = await prisma.agent.update({
            where: { walletAddress: walletAddress.toLowerCase() },
            data: { isActive }
        });

        return res.json({
            success: true,
            message: `Agent status updated to ${isActive ? 'ACTIVE' : 'INACTIVE'}`,
            data: updatedAgent
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}