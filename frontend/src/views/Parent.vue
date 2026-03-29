<template>
  <div class="page parent-page">
    <div class="header">
      <h1>👨‍👩‍👧 家长管理</h1>
      <button class="logout-btn" @click="logout">退出</button>
    </div>

    <!-- 我的孩子 -->
    <div class="card">
      <h2>我的孩子</h2>
      <div v-if="children.length === 0" class="empty">
        还没有添加孩子账号
      </div>
      <div v-else class="children-list">
        <div v-for="child in children" :key="child.id" class="child-item">
          <span>{{ child.nickname || child.username }}</span>
          <span class="child-id">ID: {{ child.id }}</span>
        </div>
      </div>
    </div>

    <!-- 发布任务 -->
    <div class="card">
      <h2>📝 发布任务</h2>
      
      <div class="form-group">
        <label class="label">任务标题</label>
        <input v-model="task.title" class="input" placeholder="如：完成数学作业" />
      </div>
      
      <div class="form-group">
        <label class="label">任务类型</label>
        <div class="type-grid">
          <button 
            v-for="(config, type) in TASK_CONFIG" 
            :key="type"
            :class="{ active: task.type === type }"
            @click="task.type = type"
          >
            {{ type }}
            <br>
            <small>🍖×{{ config.food }} +{{ config.exp }}exp</small>
          </button>
        </div>
      </div>
      
      <div class="form-group">
        <label class="label">分配给</label>
        <select v-model="task.assigned_to" class="input">
          <option value="">请选择</option>
          <option v-for="child in children" :key="child.id" :value="child.id">
            {{ child.nickname || child.username }}
          </option>
        </select>
      </div>
      
      <button class="btn" @click="createTask">发布任务</button>
    </div>

    <!-- 任务列表 -->
    <div class="card">
      <h2>📋 任务记录</h2>
      <div v-if="tasks.length === 0" class="empty">暂无任务</div>
      <div v-else class="task-list">
        <div v-for="task in tasks" :key="task.id" class="task-item">
          <div class="task-info">
            <span class="task-title">{{ task.title }}</span>
            <span class="task-meta">{{ task.child_name }} · {{ task.type }}</span>
          </div>
          <span :class="['task-status', task.status]">
            {{ statusText(task.status) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import axios from 'axios'

const router = useRouter()
const userStore = useUserStore()

const TASK_CONFIG = {
  '作业': { food: 3, exp: 20 },
  '阅读': { food: 2, exp: 15 },
  '运动': { food: 2, exp: 15 },
  '背单词': { food: 2, exp: 15 },
  '刷碗': { food: 1, exp: 10 }
}

const children = ref([])
const tasks = ref([])
const task = ref({
  title: '',
  type: '作业',
  assigned_to: ''
})

const authHeader = () => ({
  headers: { Authorization: `Bearer ${userStore.token}` }
})

const loadChildren = async () => {
  try {
    const res = await axios.get('/api/auth/me', authHeader())
    // 查询所有 parent_id = 当前用户的孩子
    // 这里需要后端支持，暂时简化
  } catch (err) {
    console.error(err)
  }
}

const loadTasks = async () => {
  try {
    const res = await axios.get('/api/tasks/children', authHeader())
    tasks.value = res.data.tasks
  } catch (err) {
    console.error(err)
  }
}

const createTask = async () => {
  if (!task.value.title || !task.value.assigned_to) {
    alert('请填写完整信息')
    return
  }

  try {
    await axios.post('/api/tasks', task.value, authHeader())
    alert('任务发布成功！')
    task.value.title = ''
    loadTasks()
  } catch (err) {
    alert(err.response?.data?.error || '发布失败')
  }
}

const statusText = (status) => {
  const map = {
    pending: '待完成',
    completed: '已完成',
    claimed: '已领奖'
  }
  return map[status] || status
}

const logout = () => {
  userStore.logout()
  router.push('/')
}

onMounted(() => {
  loadChildren()
  loadTasks()
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  color: white;
}

.header h1 {
  font-size: 20px;
}

.logout-btn {
  background: rgba(255,255,255,0.2);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
}

.card h2 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #333;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.type-grid button {
  padding: 12px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  text-align: center;
}

.type-grid button.active {
  border-color: #667eea;
  background: #f0f3ff;
}

.type-grid button small {
  color: #999;
  font-size: 11px;
}

.children-list, .task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.child-item, .task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.child-id {
  color: #999;
  font-size: 12px;
}

.task-info {
  display: flex;
  flex-direction: column;
}

.task-title {
  font-weight: 500;
}

.task-meta {
  font-size: 12px;
  color: #999;
}

.task-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.task-status.pending {
  background: #fff3cd;
  color: #856404;
}

.task-status.completed {
  background: #d1ecf1;
  color: #0c5460;
}

.task-status.claimed {
  background: #d4edda;
  color: #155724;
}

.empty {
  text-align: center;
  color: #999;
  padding: 20px;
}
</style>
