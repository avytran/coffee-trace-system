import express from 'express';
import { getUsersByRole } from '../controllers/userController.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

router.get('/', verifyToken, getUsersByRole);

export default router;