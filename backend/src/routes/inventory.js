import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../models/database.js';

const router = express.Router();
const JWT_SECRET = 'pet-keeping-secret-2024';

// 认证中间件
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token 无效' });
  }
};

// 获取我的物品
router.get('/', auth, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT * FROM inventory WHERE user_id = ?
    `).all(req.userId);

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取物品失败' });
  }
});

export default router;
