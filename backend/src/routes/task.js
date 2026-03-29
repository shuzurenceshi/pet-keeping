import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../models/database.js';
import { addExp } from './pet.js';

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
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token 无效' });
  }
};

// 任务类型配置
const TASK_CONFIG = {
  '作业': { food: 3, exp: 20 },
  '阅读': { food: 2, exp: 15 },
  '运动': { food: 2, exp: 15 },
  '背单词': { food: 2, exp: 15 },
  '刷碗': { food: 1, exp: 10 }
};

// 获取我的任务（孩子）
router.get('/my', auth, (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT t.*, u.nickname as created_by_name
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `).all(req.userId);

    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取任务失败' });
  }
});

// 获取孩子的任务（家长）
router.get('/children', auth, (req, res) => {
  if (req.userRole !== 'parent') {
    return res.status(403).json({ error: '只有家长可以查看' });
  }

  try {
    const tasks = db.prepare(`
      SELECT t.*, u.nickname as child_name
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = ?
      ORDER BY t.created_at DESC
    `).all(req.userId);

    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取任务失败' });
  }
});

// 创建任务（家长）
router.post('/', auth, (req, res) => {
  if (req.userRole !== 'parent') {
    return res.status(403).json({ error: '只有家长可以发布任务' });
  }

  const { title, type, assigned_to } = req.body;

  if (!title || !type || !assigned_to) {
    return res.status(400).json({ error: '任务标题、类型和分配对象不能为空' });
  }

  if (!TASK_CONFIG[type]) {
    return res.status(400).json({ error: '无效的任务类型' });
  }

  try {
    // 验证 assigned_to 是自己的孩子
    const child = db.prepare(`
      SELECT id FROM users WHERE id = ? AND parent_id = ?
    `).get(assigned_to, req.userId);

    if (!child) {
      return res.status(400).json({ error: '只能给自己的账号分配任务' });
    }

    const config = TASK_CONFIG[type];
    
    const stmt = db.prepare(`
      INSERT INTO tasks (title, type, reward_food, reward_exp, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(title, type, config.food, config.exp, assigned_to, req.userId);

    res.json({ 
      success: true, 
      message: '任务发布成功',
      rewards: { food: config.food, exp: config.exp }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建任务失败' });
  }
});

// 标记完成
router.post('/:id/complete', auth, (req, res) => {
  const taskId = req.params.id;

  try {
    const task = db.prepare(`
      SELECT * FROM tasks WHERE id = ? AND assigned_to = ?
    `).get(taskId, req.userId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({ error: '任务已完成或已领取奖励' });
    }

    db.prepare(`
      UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId);

    res.json({ 
      success: true, 
      message: '任务完成！快去领取奖励吧 🎁' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '操作失败' });
  }
});

// 领取奖励
router.post('/:id/claim', auth, (req, res) => {
  const taskId = req.params.id;

  try {
    const task = db.prepare(`
      SELECT * FROM tasks WHERE id = ? AND assigned_to = ?
    `).get(taskId, req.userId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (task.status === 'pending') {
      return res.status(400).json({ error: '请先完成任务' });
    }

    if (task.status === 'claimed') {
      return res.status(400).json({ error: '奖励已领取' });
    }

    // 给予食物
    db.prepare(`
      INSERT INTO inventory (user_id, item_type, item_name, quantity)
      VALUES (?, 'food', '普通食物', ?)
      ON CONFLICT(user_id, item_type, item_name)
      DO UPDATE SET quantity = quantity + ?
    `).run(req.userId, task.reward_food, task.reward_food);

    // 给予经验
    const levelUp = addExp(req.userId, task.reward_exp);

    // 标记已领取
    db.prepare(`UPDATE tasks SET status = 'claimed' WHERE id = ?`).run(taskId);

    res.json({
      success: true,
      rewards: {
        food: task.reward_food,
        exp: task.reward_exp
      },
      levelUp: levelUp?.leveledUp ? levelUp.level : null,
      message: levelUp?.leveledUp 
        ? `领取成功！宠物升级到 ${levelUp.level} 级了！🎉` 
        : '奖励领取成功！'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '领取失败' });
  }
});

export default router;
