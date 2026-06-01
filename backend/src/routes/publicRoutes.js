import express from 'express';
import { getPublicLotExplorer } from '../controllers/publicController.js';

const router = express.Router();

router.get('/lots/:id_or_qrcode', getPublicLotExplorer);

export default router;