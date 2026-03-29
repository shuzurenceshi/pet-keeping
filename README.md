# 萌宠养成 - 家庭任务激励系统

## 核心理念

**用宠物绑定任务，让孩子为了"照顾宠物"主动完成任务。**

- 完成任务 → 获得食物 → 喂养宠物 → 宠物成长
- 不完成任务 → 没有食物 → 宠物饿肚子 → 生命值下降
- 培养责任感：宠物是你的伙伴，它需要你

---

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      家长端                              │
│  - 管理两个孩子账号                                      │
│  - 发布/分配任务                                         │
│  - 查看孩子完成情况                                      │
│  - 设置任务奖励（食物数量）                               │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      孩子端                              │
│  - 登录自己的账号                                        │
│  - 查看我的宠物状态                                      │
│  - 完成任务 → 领取食物                                   │
│  - 喂养宠物                                              │
│  - 宠物成长/升级                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 游戏化设计

### 宠物状态
| 属性 | 说明 | 影响 |
|------|------|------|
| 生命值 | 0-100 | 0 时死亡 |
| 饱食度 | 0-100 | 每小时自动下降 10 |
| 心情值 | 0-100 | 影响宠物动作表情 |
| 等级 | 1-10 | 完成任务获得经验升级 |
| 皮肤 | 解锁外观 | 等级解锁新皮肤 |

### 饥饿机制
```
饱食度每小时 -10
饱食度 = 0 时，生命值每小时 -20
生命值 = 0 → 宠物死亡（可复活，但有惩罚）
```

### 任务 → 食物
| 任务类型 | 食物奖励 | 经验值 |
|---------|---------|--------|
| 作业 | 🍖 3份 | 20 exp |
| 阅读 | 🍖 2份 | 15 exp |
| 运动 | 🍖 2份 | 15 exp |
| 背单词 | 🍖 2份 | 15 exp |
| 刷碗 | 🍖 1份 | 10 exp |

### 宠物成长
```
等级: 1 → 10
升级所需经验: 等级 × 50

等级 3: 解锁新皮肤
等级 5: 解锁新动作
等级 8: 解锁稀有皮肤
等级 10: 进化（小 → 大）
```

---

## 技术栈

### 前端
- **H5 + Vue 3** - 跨平台，手机直接用
- **Vant UI** - 移动端组件库
- **Pixi.js** - 宠物动画渲染

### 后端
- **Node.js + Express** - 快速开发
- **SQLite** - 轻量级，单文件数据库
- **JWT** - 登录认证

### 定时任务
- **node-cron** - 定时减少饱食度/生命值

---

## 数据库设计

### 用户表 (users)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,  -- bcrypt 加密
  role TEXT,      -- 'parent' | 'child'
  parent_id INTEGER,  -- 孩子关联家长
  nickname TEXT,
  avatar TEXT,
  created_at DATETIME
);
```

### 宠物表 (pets)
```sql
CREATE TABLE pets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,  -- 属于哪个孩子
  name TEXT,        -- 宠物名字
  type TEXT,        -- 'cat' | 'dog'
  hp INTEGER DEFAULT 100,
  hunger INTEGER DEFAULT 100,
  mood INTEGER DEFAULT 100,
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  skin TEXT DEFAULT 'default',
  is_alive INTEGER DEFAULT 1,
  last_fed_at DATETIME,
  created_at DATETIME
);
```

### 任务表 (tasks)
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT,
  type TEXT,  -- '作业' | '阅读' | '运动' | '背单词' | '刷碗'
  reward_food INTEGER,  -- 食物奖励
  reward_exp INTEGER,   -- 经验奖励
  assigned_to INTEGER,  -- 分配给孩子
  created_by INTEGER,   -- 家长创建
  status TEXT DEFAULT 'pending',  -- 'pending' | 'completed' | 'claimed'
  completed_at DATETIME,
  created_at DATETIME
);
```

### 物品表 (inventory)
```sql
CREATE TABLE inventory (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  item_type TEXT,  -- 'food' | 'skin'
  quantity INTEGER DEFAULT 0
);
```

---

## API 设计

### 认证
```
POST /api/auth/register   # 注册（家长/孩子）
POST /api/auth/login      # 登录
GET  /api/auth/me         # 获取当前用户信息
```

### 宠物
```
GET  /api/pet             # 获取我的宠物
POST /api/pet/create      # 创建宠物（选猫/狗，起名字）
POST /api/pet/feed        # 喂食
POST /api/pet/revive      # 复活（扣经验/等级）
```

### 任务
```
GET  /api/tasks           # 获取我的任务列表
POST /api/tasks           # 创建任务（家长）
POST /api/tasks/:id/complete  # 标记完成
POST /api/tasks/:id/claim     # 领取奖励
```

### 物品
```
GET  /api/inventory       # 获取我的物品
```

---

## 目录结构

```
pet-keeping/
├── frontend/           # Vue 3 前端
│   ├── src/
│   │   ├── views/
│   │   │   ├── Login.vue
│   │   │   ├── Parent.vue      # 家长端
│   │   │   ├── Child.vue       # 孩子端
│   │   │   └── Pet.vue         # 宠物页面
│   │   ├── components/
│   │   │   ├── PetSprite.vue   # 宠物动画
│   │   │   └── TaskCard.vue
│   │   └── stores/
│   │       └── user.js
│   └── package.json
│
├── backend/            # Node.js 后端
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── pet.js
│   │   │   └── task.js
│   │   ├── models/
│   │   │   └── database.js
│   │   ├── jobs/
│   │   │   └── hunger.js   # 定时减饱食度
│   │   └── app.js
│   └── package.json
│
├── database/
│   └── pet.db          # SQLite 数据库文件
│
└── README.md
```

---

## 开发计划

### Phase 1: MVP (2-3天)
- [x] 需求梳理
- [ ] 数据库设计
- [ ] 后端 API
  - [ ] 用户注册/登录
  - [ ] 宠物 CRUD
  - [ ] 任务 CRUD
- [ ] 前端页面
  - [ ] 登录页
  - [ ] 孩子端 - 宠物展示
  - [ ] 孩子端 - 任务列表
  - [ ] 家长端 - 发布任务

### Phase 2: 游戏化 (1-2天)
- [ ] 宠物动画（Pixi.js）
- [ ] 等级系统
- [ ] 皮肤解锁
- [ ] 定时任务（饥饿机制）

### Phase 3: 优化 (1天)
- [ ] 响应式适配
- [ ] 性能优化
- [ ] 通知提醒

---

## 启动方式

```bash
# 后端
cd backend
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

访问: http://localhost:5173
