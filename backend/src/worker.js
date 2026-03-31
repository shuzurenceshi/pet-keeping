import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import jwtLib from 'jsonwebtoken'

const app = new Hono()

// CORS
app.use('/*', cors())

// JWT Secret
const JWT_SECRET = 'pet-keeping-secret-2024'

// D1 数据库初始化
async function initDB(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        parent_id INTEGER,
        nickname TEXT,
        avatar TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        hp INTEGER DEFAULT 100,
        hunger INTEGER DEFAULT 100,
        mood INTEGER DEFAULT 100,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        skin TEXT DEFAULT 'default',
        is_alive INTEGER DEFAULT 1,
        last_fed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        reward_food INTEGER DEFAULT 1,
        reward_exp INTEGER DEFAULT 10,
        assigned_to INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_name TEXT,
        quantity INTEGER DEFAULT 0
      )
    `)
  ])
}

// 初始化数据库
app.get('/api/init', async (c) => {
  try {
    await initDB(c.env.DB)
    return c.json({ success: true, message: '数据库初始化成功' })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// ========== 认证 ==========

// 注册
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
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first()

    if (existing) {
      return c.json({ error: '用户名已存在' }, 400)
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    const result = await c.env.DB.prepare(
      'INSERT INTO users (username, password, role, parent_id, nickname) VALUES (?, ?, ?, ?, ?)'
    ).bind(username, hashedPassword, role, parent_id || null, nickname || username).run()

    // 孩子账号初始化食物
    if (role === 'child') {
      await c.env.DB.prepare(
        'INSERT INTO inventory (user_id, item_type, item_name, quantity) VALUES (?, ?, ?, ?)'
      ).bind(result.meta.last_row_id, 'food', '普通食物', 5).run()
    }

    return c.json({ success: true, userId: result.meta.last_row_id })
  } catch (err) {
    return c.json({ error: '注册失败: ' + err.message }, 500)
  }
})

// 登录
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json()

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400)
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first()

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return c.json({ error: '用户名或密码错误' }, 401)
    }

    const token = jwtLib.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

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

// 获取当前用户
app.get('/api/auth/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    const user = await c.env.DB.prepare(
      'SELECT id, username, role, parent_id, nickname, avatar FROM users WHERE id = ?'
    ).bind(decoded.userId).first()

    if (!user) {
      return c.json({ error: '用户不存在' }, 404)
    }

    return c.json({ user })
  } catch (err) {
    return c.json({ error: 'token 无效' }, 401)
  }
})

// 获取孩子列表
app.get('/api/auth/children', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    if (decoded.role !== 'parent') {
      return c.json({ error: '只有家长可以查看' }, 403)
    }

    const children = await c.env.DB.prepare(
      'SELECT id, username, nickname, avatar FROM users WHERE parent_id = ?'
    ).bind(decoded.userId).all()

    return c.json({ children: children.results })
  } catch (err) {
    return c.json({ error: 'token 无效' }, 401)
  }
})

// ========== 宠物 ==========

// 获取我的宠物
app.get('/api/pet', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({ pet })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

// 创建宠物
app.post('/api/pet/create', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  const { name, type } = await c.req.json()

  if (!name || !type) {
    return c.json({ error: '宠物名字和类型不能为空' }, 400)
  }

  if (!['cat', 'dog'].includes(type)) {
    return c.json({ error: '宠物类型只能是 cat 或 dog' }, 400)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const existing = await c.env.DB.prepare(
      'SELECT id FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (existing) {
      return c.json({ error: '你已经有一只宠物了' }, 400)
    }

    await c.env.DB.prepare(
      'INSERT INTO pets (user_id, name, type) VALUES (?, ?, ?)'
    ).bind(decoded.userId, name, type).run()

    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({ success: true, pet, message: `领养成功！${name} 来到了你身边 🎉` })
  } catch (err) {
    return c.json({ error: '领养失败' }, 500)
  }
})

// 喂食
app.post('/api/pet/feed', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (!pet) {
      return c.json({ error: '你还没有宠物' }, 404)
    }

    if (!pet.is_alive) {
      return c.json({ error: '宠物已死亡，请先复活' }, 400)
    }

    const inventory = await c.env.DB.prepare(
      'SELECT * FROM inventory WHERE user_id = ? AND item_type = "food"'
    ).bind(decoded.userId).first()

    if (!inventory || inventory.quantity <= 0) {
      return c.json({ error: '食物不足，快去完成任务获取食物吧！' }, 400)
    }

    // 扣食物
    await c.env.DB.prepare(
      'UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_type = "food"'
    ).bind(decoded.userId).run()

    // 加饱食度
    const newHunger = Math.min(100, pet.hunger + 30)
    const newHp = Math.min(100, pet.hp + 10)
    const newMood = Math.min(100, pet.mood + 5)

    await c.env.DB.prepare(
      'UPDATE pets SET hunger = ?, hp = ?, mood = ?, last_fed_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(newHunger, newHp, newMood, decoded.userId).run()

    const updatedPet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({ success: true, pet: updatedPet, message: `喂食成功！${pet.name} 吃得很开心 😊` })
  } catch (err) {
    return c.json({ error: '喂食失败' }, 500)
  }
})

// 复活
app.post('/api/pet/revive', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (!pet) {
      return c.json({ error: '你还没有宠物' }, 404)
    }

    if (pet.is_alive) {
      return c.json({ error: '宠物还活着呢' }, 400)
    }

    const newLevel = Math.max(1, pet.level - 1)

    await c.env.DB.prepare(
      'UPDATE pets SET hp = 50, hunger = 50, mood = 50, level = ?, exp = 0, is_alive = 1, last_fed_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(newLevel, decoded.userId).run()

    const updatedPet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({
      success: true,
      pet: updatedPet,
      message: `${pet.name} 复活了！等级降低为 ${newLevel}，记得好好照顾它 💪`
    })
  } catch (err) {
    return c.json({ error: '复活失败' }, 500)
  }
})

// ========== 宠物互动 ==========

// 洗澡 - 增加心情和生命
app.post('/api/pet/bath', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (!pet) {
      return c.json({ error: '你还没有宠物' }, 404)
    }

    if (!pet.is_alive) {
      return c.json({ error: '宠物已死亡，请先复活' }, 400)
    }

    // 洗澡效果：心情+15，生命+5
    const newMood = Math.min(100, pet.mood + 15)
    const newHp = Math.min(100, pet.hp + 5)

    await c.env.DB.prepare(
      'UPDATE pets SET mood = ?, hp = ? WHERE user_id = ?'
    ).bind(newMood, newHp, decoded.userId).run()

    const updatedPet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({
      success: true,
      pet: updatedPet,
      animation: 'bath',
      message: `${pet.name} 洗了个香香的澡 🛁✨ 心情变好了！`
    })
  } catch (err) {
    return c.json({ error: '洗澡失败' }, 500)
  }
})

// 读书 - 增加经验和心情
app.post('/api/pet/read', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (!pet) {
      return c.json({ error: '你还没有宠物' }, 404)
    }

    if (!pet.is_alive) {
      return c.json({ error: '宠物已死亡，请先复活' }, 400)
    }

    // 读书效果：经验+10，心情+10
    let newExp = pet.exp + 10
    let newLevel = pet.level
    let levelUp = false

    while (newExp >= newLevel * 50) {
      newExp -= newLevel * 50
      newLevel++
      levelUp = true
    }

    const newMood = Math.min(100, pet.mood + 10)

    await c.env.DB.prepare(
      'UPDATE pets SET exp = ?, level = ?, mood = ? WHERE user_id = ?'
    ).bind(newExp, newLevel, newMood, decoded.userId).run()

    const updatedPet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({
      success: true,
      pet: updatedPet,
      animation: 'read',
      levelUp: levelUp ? newLevel : null,
      message: levelUp 
        ? `${pet.name} 认真读书 📚💡 升级到 ${newLevel} 级了！`
        : `${pet.name} 认真读书 📚💡 变聪明了！`
    })
  } catch (err) {
    return c.json({ error: '读书失败' }, 500)
  }
})

// 运动 - 增加生命和经验，减少饱食度
app.post('/api/pet/exercise', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (!pet) {
      return c.json({ error: '你还没有宠物' }, 404)
    }

    if (!pet.is_alive) {
      return c.json({ error: '宠物已死亡，请先复活' }, 400)
    }

    if (pet.hunger < 20) {
      return c.json({ error: `${pet.name} 太饿了，没力气运动，先喂点东西吧！` }, 400)
    }

    // 运动效果：生命+10，经验+8，饱食度-20
    const newHp = Math.min(100, pet.hp + 10)
    const newHunger = Math.max(0, pet.hunger - 20)
    let newExp = pet.exp + 8
    let newLevel = pet.level
    let levelUp = false

    while (newExp >= newLevel * 50) {
      newExp -= newLevel * 50
      newLevel++
      levelUp = true
    }

    await c.env.DB.prepare(
      'UPDATE pets SET hp = ?, hunger = ?, exp = ?, level = ? WHERE user_id = ?'
    ).bind(newHp, newHunger, newExp, newLevel, decoded.userId).run()

    const updatedPet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({
      success: true,
      pet: updatedPet,
      animation: 'exercise',
      levelUp: levelUp ? newLevel : null,
      message: levelUp
        ? `${pet.name} 开心运动 🏃‍♂️💨 升级到 ${newLevel} 级了！`
        : `${pet.name} 开心运动 🏃‍♂️💨 身体更健康了！`
    })
  } catch (err) {
    return c.json({ error: '运动失败' }, 500)
  }
})

// 玩耍 - 增加心情，减少饱食度
app.post('/api/pet/play', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    if (!pet) {
      return c.json({ error: '你还没有宠物' }, 404)
    }

    if (!pet.is_alive) {
      return c.json({ error: '宠物已死亡，请先复活' }, 400)
    }

    if (pet.hunger < 10) {
      return c.json({ error: `${pet.name} 太饿了，先喂点东西吧！` }, 400)
    }

    // 玩耍效果：心情+20，饱食度-10
    const newMood = Math.min(100, pet.mood + 20)
    const newHunger = Math.max(0, pet.hunger - 10)

    await c.env.DB.prepare(
      'UPDATE pets SET mood = ?, hunger = ? WHERE user_id = ?'
    ).bind(newMood, newHunger, decoded.userId).run()

    const updatedPet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    return c.json({
      success: true,
      pet: updatedPet,
      animation: 'play',
      message: `${pet.name} 玩得超级开心 🎾🎉`
    })
  } catch (err) {
    return c.json({ error: '玩耍失败' }, 500)
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

// 获取我的任务
app.get('/api/tasks/my', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const tasks = await c.env.DB.prepare(`
      SELECT t.*, u.nickname as created_by_name
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `).bind(decoded.userId).all()

    return c.json({ tasks: tasks.results })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

// 获取孩子的任务
app.get('/api/tasks/children', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    if (decoded.role !== 'parent') {
      return c.json({ error: '只有家长可以查看' }, 403)
    }

    const tasks = await c.env.DB.prepare(`
      SELECT t.*, u.nickname as child_name
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = ?
      ORDER BY t.created_at DESC
    `).bind(decoded.userId).all()

    return c.json({ tasks: tasks.results })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

// 创建任务
app.post('/api/tasks', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  const { title, type, assigned_to } = await c.req.json()

  if (!title || !type || !assigned_to) {
    return c.json({ error: '信息不完整' }, 400)
  }

  if (!TASK_CONFIG[type]) {
    return c.json({ error: '无效的任务类型' }, 400)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    if (decoded.role !== 'parent') {
      return c.json({ error: '只有家长可以发布任务' }, 403)
    }

    const child = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ? AND parent_id = ?'
    ).bind(assigned_to, decoded.userId).first()

    if (!child) {
      return c.json({ error: '只能给自己的账号分配任务' }, 400)
    }

    const config = TASK_CONFIG[type]
    
    await c.env.DB.prepare(
      'INSERT INTO tasks (title, type, reward_food, reward_exp, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(title, type, config.food, config.exp, assigned_to, decoded.userId).run()

    return c.json({ success: true, message: '任务发布成功', rewards: config })
  } catch (err) {
    return c.json({ error: '创建失败' }, 500)
  }
})

// 完成任务
app.post('/api/tasks/:id/complete', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  const taskId = c.req.param('id')

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const task = await c.env.DB.prepare(
      'SELECT * FROM tasks WHERE id = ? AND assigned_to = ?'
    ).bind(taskId, decoded.userId).first()

    if (!task) {
      return c.json({ error: '任务不存在' }, 404)
    }

    if (task.status !== 'pending') {
      return c.json({ error: '任务已完成或已领取奖励' }, 400)
    }

    await c.env.DB.prepare(
      'UPDATE tasks SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(taskId).run()

    return c.json({ success: true, message: '任务完成！快去领取奖励吧 🎁' })
  } catch (err) {
    return c.json({ error: '操作失败' }, 500)
  }
})

// 领取奖励
app.post('/api/tasks/:id/claim', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  const taskId = c.req.param('id')

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const task = await c.env.DB.prepare(
      'SELECT * FROM tasks WHERE id = ? AND assigned_to = ?'
    ).bind(taskId, decoded.userId).first()

    if (!task) {
      return c.json({ error: '任务不存在' }, 404)
    }

    if (task.status === 'pending') {
      return c.json({ error: '请先完成任务' }, 400)
    }

    if (task.status === 'claimed') {
      return c.json({ error: '奖励已领取' }, 400)
    }

    // 给食物
    const existing = await c.env.DB.prepare(
      'SELECT * FROM inventory WHERE user_id = ? AND item_type = "food"'
    ).bind(decoded.userId).first()

    if (existing) {
      await c.env.DB.prepare(
        'UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND item_type = "food"'
      ).bind(task.reward_food, decoded.userId).run()
    } else {
      await c.env.DB.prepare(
        'INSERT INTO inventory (user_id, item_type, item_name, quantity) VALUES (?, "food", "普通食物", ?)'
      ).bind(decoded.userId, task.reward_food).run()
    }

    // 给经验
    const pet = await c.env.DB.prepare(
      'SELECT * FROM pets WHERE user_id = ?'
    ).bind(decoded.userId).first()

    let levelUp = null
    if (pet) {
      let newExp = pet.exp + task.reward_exp
      let newLevel = pet.level

      while (newExp >= newLevel * 50) {
        newExp -= newLevel * 50
        newLevel++
      }

      levelUp = newLevel > pet.level ? { level: newLevel } : null

      await c.env.DB.prepare(
        'UPDATE pets SET exp = ?, level = ? WHERE user_id = ?'
      ).bind(newExp, newLevel, decoded.userId).run()
    }

    // 标记已领取
    await c.env.DB.prepare(
      'UPDATE tasks SET status = "claimed" WHERE id = ?'
    ).bind(taskId).run()

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
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  try {
    const decoded = jwtLib.verify(auth.slice(7), JWT_SECRET)
    
    const items = await c.env.DB.prepare(
      'SELECT * FROM inventory WHERE user_id = ?'
    ).bind(decoded.userId).all()

    return c.json({ items: items.results })
  } catch (err) {
    return c.json({ error: '获取失败' }, 500)
  }
})

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
