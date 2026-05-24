import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: "Business APIs haven't implemented yet" });
});

export default router;