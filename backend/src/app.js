import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import petRoutes from './routes/pet.js';
import taskRoutes from './routes/task.js';
import { startHungerJob } from './jobs/hunger.js';

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/tasks', taskRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动定时任务
startHungerJob();

app.listen(PORT, () => {
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
});
