import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from './db.js'

const app = new Hono()
const JWT_SECRET = 'pet-keeping-secret-2024'

app.use('/*', cors())

// ========== 认证 ==========

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json()
  const { username, password, role, parent_id, nickname } = body

  if (!username || !password || !role) {
    return c.json({ error: '用户名、密码和角色不能为空' }, 400)
  }

  if (!['parent', 'child'].includes(role)) {
    return c.json({ error: '角色只能是 parent 或 child' }, 400)
  }

  if (role === 'child' && !parent_id) {
    return c.json({ error: '孩子账号必须关联家长账号' }, 400)
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      return c.json({ error: '用户名已存在' }, 400)
    }

    const hashedPassword = bcrypt.hashSync(password, 10)
    const result = db.prepare(
      'INSERT INTO users (username, password, role, parent_id, nickname) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hashedPassword, role, parent_id || null, nickname || username)

    if (role === 'child') {
      db.prepare('INSERT INTO inventory (user_id, item_type, item_name, quantity) VALUES (?, ?, ?, ?)')
        .run(result.lastInsertRowid, 'food', '普通食物', 5)
    }

    return c.json({ success: true, userId: result.lastInsertRowid })
  } catch (err) {
    return c.json({ error: '注册失败: ' + err.message }, 500)
  }
})

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json()

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400)
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return c.json({ error: '用户名或密码错误' }, 401)
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        parent_id: user.parent_id,
        nickname: user.nickname
      }
    })
  } catch (err) {
    return c.json({ error: '登录失败' }, 500)
  }
})

app.get('/api/auth/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const user = db.prepare('SELECT id, username, role, parent_id, nickname, avatar FROM users WHERE id = ?').get(decoded.userId)
    if (!user) return c.json({ error: '用户不存在' }, 404)
    return c.json({ user })
  } catch (err) {
    return c.json({ error: 'token 无效' }, 401)
  }
})

app.get('/api/auth/children', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (decoded.role !== 'parent') return c.json({ error: '只有家长可以查看' }, 403)

    const children = db.prepare('SELECT id, username, nickname, avatar FROM users WHERE parent_id = ?').all(decoded.userId)
    return c.json({ children })
  } catch (err) {
    return c.json({ error: 'token 无效' }, 401)
  }
})

// ========== 宠物 ==========

app.get('/api/pet', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)
    return c.json({ pet })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

app.post('/api/pet/create', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  const { name, type } = await c.req.json()
  if (!name || !type) return c.json({ error: '宠物名字和类型不能为空' }, 400)
  if (!['cat', 'dog'].includes(type)) return c.json({ error: '宠物类型只能是 cat 或 dog' }, 400)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const existing = db.prepare('SELECT id FROM pets WHERE user_id = ?').get(decoded.userId)
    if (existing) return c.json({ error: '你已经有一只宠物了' }, 400)

    db.prepare('INSERT INTO pets (user_id, name, type) VALUES (?, ?, ?)').run(decoded.userId, name, type)
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)

    return c.json({ success: true, pet, message: `领养成功！${name} 来到了你身边 🎉` })
  } catch (err) {
    return c.json({ error: '领养失败' }, 500)
  }
})

app.post('/api/pet/feed', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)
    if (!pet) return c.json({ error: '你还没有宠物' }, 404)
    if (!pet.is_alive) return c.json({ error: '宠物已死亡，请先复活' }, 400)

    const inventory = db.prepare('SELECT * FROM inventory WHERE user_id = ? AND item_type = "food"').get(decoded.userId)
    if (!inventory || inventory.quantity <= 0) return c.json({ error: '食物不足，快去完成任务获取食物吧！' }, 400)

    db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_type = "food"').run(decoded.userId)

    const newHunger = Math.min(100, pet.hunger + 30)
    const newHp = Math.min(100, pet.hp + 10)
    const newMood = Math.min(100, pet.mood + 5)

    db.prepare('UPDATE pets SET hunger = ?, hp = ?, mood = ?, last_fed_at = CURRENT_TIMESTAMP WHERE user_id = ?')
      .run(newHunger, newHp, newMood, decoded.userId)

    const updatedPet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)
    return c.json({ success: true, pet: updatedPet, message: `喂食成功！${pet.name} 吃得很开心 😊` })
  } catch (err) {
    return c.json({ error: '喂食失败' }, 500)
  }
})

app.post('/api/pet/revive', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)
    if (!pet) return c.json({ error: '你还没有宠物' }, 404)
    if (pet.is_alive) return c.json({ error: '宠物还活着呢' }, 400)

    const newLevel = Math.max(1, pet.level - 1)
    db.prepare('UPDATE pets SET hp = 50, hunger = 50, mood = 50, level = ?, exp = 0, is_alive = 1, last_fed_at = CURRENT_TIMESTAMP WHERE user_id = ?')
      .run(newLevel, decoded.userId)

    const updatedPet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)
    return c.json({ success: true, pet: updatedPet, message: `${pet.name} 复活了！等级降低为 ${newLevel}，记得好好照顾它 💪` })
  } catch (err) {
    return c.json({ error: '复活失败' }, 500)
  }
})

// ========== 任务 ==========

const TASK_CONFIG = {
  '作业': { food: 3, exp: 20 },
  '阅读': { food: 2, exp: 15 },
  '运动': { food: 2, exp: 15 },
  '背单词': { food: 2, exp: 15 },
  '刷碗': { food: 1, exp: 10 }
}

app.get('/api/tasks/my', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const tasks = db.prepare(`
      SELECT t.*, u.nickname as created_by_name
      FROM tasks t JOIN users u ON t.created_by = u.id
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `).all(decoded.userId)
    return c.json({ tasks })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

app.get('/api/tasks/children', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (decoded.role !== 'parent') return c.json({ error: '只有家长可以查看' }, 403)

    const tasks = db.prepare(`
      SELECT t.*, u.nickname as child_name
      FROM tasks t JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = ?
      ORDER BY t.created_at DESC
    `).all(decoded.userId)
    return c.json({ tasks })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

app.post('/api/tasks', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  const { title, type, assigned_to } = await c.req.json()
  if (!title || !type || !assigned_to) return c.json({ error: '信息不完整' }, 400)
  if (!TASK_CONFIG[type]) return c.json({ error: '无效的任务类型' }, 400)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (decoded.role !== 'parent') return c.json({ error: '只有家长可以发布任务' }, 403)

    const child = db.prepare('SELECT id FROM users WHERE id = ? AND parent_id = ?').get(assigned_to, decoded.userId)
    if (!child) return c.json({ error: '只能给自己的账号分配任务' }, 400)

    const config = TASK_CONFIG[type]
    db.prepare('INSERT INTO tasks (title, type, reward_food, reward_exp, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(title, type, config.food, config.exp, assigned_to, decoded.userId)

    return c.json({ success: true, message: '任务发布成功', rewards: config })
  } catch (err) {
    return c.json({ error: '创建失败' }, 500)
  }
})

app.post('/api/tasks/:id/complete', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  const taskId = c.req.param('id')

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND assigned_to = ?').get(taskId, decoded.userId)
    if (!task) return c.json({ error: '任务不存在' }, 404)
    if (task.status !== 'pending') return c.json({ error: '任务已完成或已领取奖励' }, 400)

    db.prepare('UPDATE tasks SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?').run(taskId)
    return c.json({ success: true, message: '任务完成！快去领取奖励吧 🎁' })
  } catch (err) {
    return c.json({ error: '操作失败' }, 500)
  }
})

app.post('/api/tasks/:id/claim', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  const taskId = c.req.param('id')

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND assigned_to = ?').get(taskId, decoded.userId)
    if (!task) return c.json({ error: '任务不存在' }, 404)
    if (task.status === 'pending') return c.json({ error: '请先完成任务' }, 400)
    if (task.status === 'claimed') return c.json({ error: '奖励已领取' }, 400)

    // 给食物
    const existing = db.prepare('SELECT * FROM inventory WHERE user_id = ? AND item_type = "food"').get(decoded.userId)
    if (existing) {
      db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND item_type = "food"')
        .run(task.reward_food, decoded.userId)
    } else {
      db.prepare('INSERT INTO inventory (user_id, item_type, item_name, quantity) VALUES (?, "food", "普通食物", ?)')
        .run(decoded.userId, task.reward_food)
    }

    // 给经验
    const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(decoded.userId)
    let levelUp = null
    if (pet) {
      let newExp = pet.exp + task.reward_exp
      let newLevel = pet.level
      while (newExp >= newLevel * 50) {
        newExp -= newLevel * 50
        newLevel++
      }
      levelUp = newLevel > pet.level ? { level: newLevel } : null
      db.prepare('UPDATE pets SET exp = ?, level = ? WHERE user_id = ?').run(newExp, newLevel, decoded.userId)
    }

    db.prepare('UPDATE tasks SET status = "claimed" WHERE id = ?').run(taskId)

    return c.json({
      success: true,
      rewards: { food: task.reward_food, exp: task.reward_exp },
      levelUp: levelUp?.level,
      message: levelUp ? `领取成功！宠物升级到 ${levelUp.level} 级了！🎉` : '奖励领取成功！'
    })
  } catch (err) {
    return c.json({ error: '领取失败' }, 500)
  }
})

// ========== 物品 ==========

app.get('/api/inventory', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const items = db.prepare('SELECT * FROM inventory WHERE user_id = ?').all(decoded.userId)
    return c.json({ items })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = process.env.PORT || 3001
console.log(`🚀 Server running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
