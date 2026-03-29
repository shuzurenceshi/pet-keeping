import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/pet.db');
const dataDir = dirname(dbPath);

// 确保数据目录存在
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// 初始化 sql.js
const SQL = await initSqlJs();

// 加载或创建数据库
let db;
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// 保存数据库到文件的辅助函数
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

// 包装 db.run 以自动保存
const originalRun = db.run.bind(db);
db.run = function(...args) {
  const result = originalRun(...args);
  saveDatabase();
  return result;
};

// 初始化表
const initTables = () => {
  // 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent', 'child')),
      parent_id INTEGER,
      nickname TEXT,
      avatar TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES users(id)
    )
  `);

  // 宠物表
  db.run(`
    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cat', 'dog')),
      hp INTEGER DEFAULT 100,
      hunger INTEGER DEFAULT 100,
      mood INTEGER DEFAULT 100,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      skin TEXT DEFAULT 'default',
      is_alive INTEGER DEFAULT 1,
      last_fed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('作业', '阅读', '运动', '背单词', '刷碗')),
      reward_food INTEGER DEFAULT 1,
      reward_exp INTEGER DEFAULT 10,
      assigned_to INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'claimed')),
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 物品表
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('food', 'skin')),
      item_name TEXT,
      quantity INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, item_type, item_name)
    )
  `);

  saveDatabase();
  console.log('✅ 数据库表初始化完成');
};

// 兼容 better-sqlite3 API
db.exec = function(sql) {
  db.run(sql);
  saveDatabase();
};

db.prepare = function(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDatabase();
      return { changes: db.getRowsModified() };
    },
    get: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const results = [];
      const stmt = db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
};

// pragma 模拟（sql.js 不支持 WAL）
db.pragma = function(_pragma) {
  // sql.js 不支持 WAL，忽略
};

// 立即初始化
initTables();

export default db;
