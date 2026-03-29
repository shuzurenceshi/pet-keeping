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
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token 无效' });
  }
};

// 获取我的宠物
router.get('/', auth, (req, res) => {
  try {
    const pet = db.prepare(`
      SELECT * FROM pets WHERE user_id = ?
    `).get(req.userId);

    if (!pet) {
      return res.json({ pet: null, message: '还没有宠物，快去领养一只吧！' });
    }

    res.json({ pet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取宠物信息失败' });
  }
});

// 创建宠物（领养）
router.post('/create', auth, (req, res) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: '宠物名字和类型不能为空' });
  }

  if (!['cat', 'dog'].includes(type)) {
    return res.status(400).json({ error: '宠物类型只能是 cat 或 dog' });
  }

  try {
    // 检查是否已有宠物
    const existing = db.prepare('SELECT id FROM pets WHERE user_id = ?').get(req.userId);
    if (existing) {
      return res.status(400).json({ error: '你已经有一只宠物了' });
    }

    const stmt = db.prepare(`
      INSERT INTO pets (user_id, name, type) VALUES (?, ?, ?)
    `);
    stmt.run(req.userId, name, type);

    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(req.userId);

    res.json({ 
      success: true, 
      pet,
      message: `领养成功！${name} 来到了你身边 🎉` 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '领养失败' });
  }
});

// 喂食
router.post('/feed', auth, (req, res) => {
  try {
    // 检查宠物
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(req.userId);
    if (!pet) {
      return res.status(404).json({ error: '你还没有宠物' });
    }

    if (!pet.is_alive) {
      return res.status(400).json({ error: '宠物已死亡，请先复活' });
    }

    // 检查食物库存
    const inventory = db.prepare(`
      SELECT * FROM inventory 
      WHERE user_id = ? AND item_type = 'food'
    `).get(req.userId);

    if (!inventory || inventory.quantity <= 0) {
      return res.status(400).json({ error: '食物不足，快去完成任务获取食物吧！' });
    }

    // 扣除食物
    db.prepare(`
      UPDATE inventory SET quantity = quantity - 1 
      WHERE user_id = ? AND item_type = 'food'
    `).run(req.userId);

    // 增加饱食度，恢复生命值
    const newHunger = Math.min(100, pet.hunger + 30);
    const newHp = Math.min(100, pet.hp + 10);

    db.prepare(`
      UPDATE pets 
      SET hunger = ?, hp = ?, mood = MIN(100, mood + 5), last_fed_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newHunger, newHp, req.userId);

    const updatedPet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(req.userId);

    res.json({
      success: true,
      pet: updatedPet,
      message: `喂食成功！${pet.name} 吃得很开心 😊`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '喂食失败' });
  }
});

// 复活宠物
router.post('/revive', auth, (req, res) => {
  try {
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(req.userId);
    
    if (!pet) {
      return res.status(404).json({ error: '你还没有宠物' });
    }

    if (pet.is_alive) {
      return res.status(400).json({ error: '宠物还活着呢' });
    }

    // 复活惩罚：等级 -1，经验清零
    const newLevel = Math.max(1, pet.level - 1);
    const newExp = 0;

    db.prepare(`
      UPDATE pets 
      SET hp = 50, hunger = 50, mood = 50, level = ?, exp = ?, is_alive = 1, last_fed_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newLevel, newExp, req.userId);

    const updatedPet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(req.userId);

    res.json({
      success: true,
      pet: updatedPet,
      message: `${pet.name} 复活了！等级降低为 ${newLevel}，记得好好照顾它 💪`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '复活失败' });
  }
});

// 增加经验（内部调用）
export const addExp = (userId, expGain) => {
  const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId);
  if (!pet) return;

  let newExp = pet.exp + expGain;
  let newLevel = pet.level;
  
  // 升级计算：每级需要 level * 50 经验
  while (newExp >= newLevel * 50) {
    newExp -= newLevel * 50;
    newLevel++;
  }

  db.prepare(`
    UPDATE pets SET exp = ?, level = ? WHERE user_id = ?
  `).run(newExp, newLevel, userId);

  return { level: newLevel, exp: newExp, leveledUp: newLevel > pet.level };
};

export default router;
