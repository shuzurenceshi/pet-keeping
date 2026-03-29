import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../models/database.js';

const router = express.Router();

const JWT_SECRET = 'pet-keeping-secret-2024'; // 生产环境应从环境变量读取

// 注册
router.post('/register', (req, res) => {
  const { username, password, role, parent_id, nickname } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: '用户名、密码和角色不能为空' });
  }

  if (!['parent', 'child'].includes(role)) {
    return res.status(400).json({ error: '角色只能是 parent 或 child' });
  }

  // 孩子账号必须关联家长
  if (role === 'child' && !parent_id) {
    return res.status(400).json({ error: '孩子账号必须关联家长账号' });
  }

  try {
    // 检查用户名是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 插入用户
    const stmt = db.prepare(
      'INSERT INTO users (username, password, role, parent_id, nickname) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(username, hashedPassword, role, parent_id || null, nickname || username);

    // 如果是孩子账号，自动初始化食物库存
    if (role === 'child') {
      db.prepare(
        'INSERT INTO inventory (user_id, item_type, item_name, quantity) VALUES (?, ?, ?, ?)'
      ).run(result.lastInsertRowid, 'food', '普通食物', 5);
    }

    res.json({
      success: true,
      userId: result.lastInsertRowid,
      message: '注册成功'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        parent_id: user.parent_id,
        nickname: user.nickname,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, parent_id, nickname, avatar FROM users WHERE id = ?').get(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'token 无效或已过期' });
  }
});

export default router;
