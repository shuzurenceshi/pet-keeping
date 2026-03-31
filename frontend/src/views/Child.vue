<template>
  <div class="page child-page">
    <div class="header">
      <h1>🏠 我的空间</h1>
      <button class="logout-btn" @click="logout">退出</button>
    </div>

    <!-- 宠物状态 -->
    <div class="card pet-card">
      <div v-if="!pet" class="no-pet">
        <p>你还没有宠物</p>
        <button class="btn" @click="showAdopt = true">领养宠物</button>
      </div>
      
      <div v-else class="pet-container">
        <div class="pet-sprite" :class="{ dead: !pet.is_alive }">
          {{ pet.type === 'cat' ? '🐱' : '🐶' }}
        </div>
        <div class="pet-info">
          <h3>{{ pet.name }}</h3>
          <p class="level">Lv.{{ pet.level }} ({{ pet.exp }}/{{ pet.level * 50 }} exp)</p>
        </div>
        
        <div class="stats">
          <div class="stat">
            <span class="stat-label">❤️ 生命</span>
            <div class="stat-bar">
              <div class="stat-fill hp" :style="{ width: pet.hp + '%' }"></div>
            </div>
            <span class="stat-value">{{ pet.hp }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">🍖 饱食</span>
            <div class="stat-bar">
              <div class="stat-fill hunger" :style="{ width: pet.hunger + '%' }"></div>
            </div>
            <span class="stat-value">{{ pet.hunger }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">😊 心情</span>
            <div class="stat-bar">
              <div class="stat-fill mood" :style="{ width: pet.mood + '%' }"></div>
            </div>
            <span class="stat-value">{{ pet.mood }}</span>
          </div>
        </div>

        <!-- 互动按钮 -->
        <div class="interactions">
          <button class="action-btn feed" @click="feedPet" :disabled="!pet.is_alive || foodCount <= 0">
            🍖 喂食 ({{ foodCount }})
          </button>
          <button class="action-btn bath" @click="bathPet" :disabled="!pet.is_alive">
            🛁 洗澡
          </button>
          <button class="action-btn read" @click="readPet" :disabled="!pet.is_alive">
            📚 读书
          </button>
          <button class="action-btn exercise" @click="exercisePet" :disabled="!pet.is_alive">
            🏃 运动
          </button>
          <button class="action-btn play" @click="playPet" :disabled="!pet.is_alive">
            🎾 玩耍
          </button>
          <button v-if="!pet.is_alive" class="action-btn revive" @click="revivePet">
            ✨ 复活
          </button>
        </div>

        <!-- 3D 动画效果 -->
        <div class="pet-3d-container" :class="animation">
          <div class="pet-3d">
            <div class="pet-sprite-3d" :class="{ dead: !pet.is_alive }">
              {{ pet.type === 'cat' ? '🐱' : '🐶' }}
            </div>
          </div>
          <!-- 特效 -->
          <div v-if="animation === 'bath'" class="effects bath-effects">
            <span v-for="i in 8" :key="i" class="splash droplet" :style="{ '--delay': i * 0.1 + 's', '--x': (Math.random() * 100 - 50) + 'px' }">💧</span>
            <span class="bubbles">🫧</span>
          </div>
          <div v-if="animation === 'read'" class="effects read-effects">
            <span class="book float">📖</span>
            <span class="lightbulb">💡</span>
            <span v-for="i in 3" :key="i" class="star twinkle" :style="{ '--delay': i * 0.2 + 's' }">✨</span>
          </div>
          <div v-if="animation === 'exercise'" class="effects exercise-effects">
            <span v-for="i in 5" :key="i" class="sweat" :style="{ '--delay': i * 0.15 + 's', '--x': (i * 20 - 50) + 'px' }">💨</span>
            <span class="heart-beat">💓</span>
          </div>
          <div v-if="animation === 'play'" class="effects play-effects">
            <span class="ball bounce">🎾</span>
            <span v-for="i in 6" :key="i" class="sparkle" :style="{ '--delay': i * 0.1 + 's', '--angle': i * 60 + 'deg' }">⭐</span>
          </div>
          <div v-if="animation === 'feed'" class="effects feed-effects">
            <span class="food fall">🍖</span>
            <span class="heart float-up">❤️</span>
          </div>
        </div>

        <!-- 提示消息（非弹窗） -->
        <div v-if="actionMessage" class="action-message" :class="{ show: actionMessage }">
          {{ actionMessage }}
        </div>
      </div>
    </div>

    <!-- 领养弹窗 -->
    <div v-if="showAdopt" class="modal">
      <div class="modal-content">
        <h2>领养宠物</h2>
        <div class="form-group">
          <label class="label">给宠物起个名字</label>
          <input v-model="newPet.name" class="input" placeholder="如：小黑" />
        </div>
        <div class="form-group">
          <label class="label">选择类型</label>
          <div class="pet-select">
            <button 
              :class="{ active: newPet.type === 'cat' }"
              @click="newPet.type = 'cat'"
            >
              🐱 猫咪
            </button>
            <button 
              :class="{ active: newPet.type === 'dog' }"
              @click="newPet.type = 'dog'"
            >
              🐶 狗狗
            </button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="adoptPet">确认领养</button>
          <button class="btn cancel" @click="showAdopt = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 我的任务 -->
    <div class="card">
      <h2>📋 我的任务</h2>
      <div v-if="tasks.length === 0" class="empty">暂无任务</div>
      <div v-else class="task-list">
        <div v-for="task in tasks" :key="task.id" class="task-item">
          <div class="task-info">
            <span class="task-title">{{ task.title }}</span>
            <span class="task-reward">
              🍖×{{ task.reward_food }} +{{ task.reward_exp }}exp
            </span>
          </div>
          <div class="task-actions">
            <button 
              v-if="task.status === 'pending'" 
              class="task-btn complete"
              @click="completeTask(task.id)"
            >
              完成
            </button>
            <button 
              v-if="task.status === 'completed'" 
              class="task-btn claim"
              @click="claimTask(task.id)"
            >
              领奖
            </button>
            <span v-if="task.status === 'claimed'" class="task-status done">✅ 已领取</span>
          </div>
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

const pet = ref(null)
const tasks = ref([])
const foodCount = ref(0)
const showAdopt = ref(false)
const animation = ref(null)
const actionMessage = ref(null)
const newPet = ref({
  name: '',
  type: 'cat'
})

const authHeader = () => ({
  headers: { Authorization: `Bearer ${userStore.token}` }
})

const loadPet = async () => {
  try {
    const res = await axios.get('/api/pet', authHeader())
    pet.value = res.data.pet
  } catch (err) {
    console.error(err)
  }
}

const loadTasks = async () => {
  try {
    const res = await axios.get('/api/tasks/my', authHeader())
    tasks.value = res.data.tasks
  } catch (err) {
    console.error(err)
  }
}

const loadInventory = async () => {
  try {
    const res = await axios.get('/api/inventory', authHeader())
    const foodItem = res.data.items.find(i => i.item_type === 'food')
    foodCount.value = foodItem ? foodItem.quantity : 0
  } catch (err) {
    console.error(err)
  }
}

const adoptPet = async () => {
  if (!newPet.value.name) {
    alert('请给宠物起个名字')
    return
  }

  try {
    const res = await axios.post('/api/pet/create', newPet.value, authHeader())
    pet.value = res.data.pet
    showAdopt.value = false
    alert(res.data.message)
  } catch (err) {
    alert(err.response?.data?.error || '领养失败')
  }
}

const feedPet = async () => {
  try {
    const res = await axios.post('/api/pet/feed', {}, authHeader())
    pet.value = res.data.pet
    loadInventory()
    showAnimation('feed', res.data.message)
  } catch (err) {
    actionMessage.value = err.response?.data?.error || '喂食失败'
    setTimeout(() => actionMessage.value = null, 2000)
  }
}

const revivePet = async () => {
  try {
    const res = await axios.post('/api/pet/revive', {}, authHeader())
    pet.value = res.data.pet
    alert(res.data.message)
  } catch (err) {
    alert(err.response?.data?.error || '复活失败')
  }
}

// 显示动画效果 + 底部消息提示
const showAnimation = (type, message) => {
  animation.value = type
  actionMessage.value = message
  setTimeout(() => {
    animation.value = null
    actionMessage.value = null
  }, 2000)
}

// 洗澡
const bathPet = async () => {
  try {
    const res = await axios.post('/api/pet/bath', {}, authHeader())
    pet.value = res.data.pet
    showAnimation('bath', res.data.message)
  } catch (err) {
    actionMessage.value = err.response?.data?.error || '洗澡失败'
    setTimeout(() => actionMessage.value = null, 2000)
  }
}

// 读书
const readPet = async () => {
  try {
    const res = await axios.post('/api/pet/read', {}, authHeader())
    pet.value = res.data.pet
    const msg = res.data.levelUp 
      ? `${res.data.message}`
      : res.data.message
    showAnimation('read', msg)
  } catch (err) {
    actionMessage.value = err.response?.data?.error || '读书失败'
    setTimeout(() => actionMessage.value = null, 2000)
  }
}

// 运动
const exercisePet = async () => {
  try {
    const res = await axios.post('/api/pet/exercise', {}, authHeader())
    pet.value = res.data.pet
    showAnimation('exercise', res.data.message)
  } catch (err) {
    actionMessage.value = err.response?.data?.error || '运动失败'
    setTimeout(() => actionMessage.value = null, 2000)
  }
}

// 玩耍
const playPet = async () => {
  try {
    const res = await axios.post('/api/pet/play', {}, authHeader())
    pet.value = res.data.pet
    showAnimation('play', res.data.message)
  } catch (err) {
    actionMessage.value = err.response?.data?.error || '玩耍失败'
    setTimeout(() => actionMessage.value = null, 2000)
  }
}

const completeTask = async (id) => {
  try {
    const res = await axios.post(`/api/tasks/${id}/complete`, {}, authHeader())
    alert(res.data.message)
    loadTasks()
  } catch (err) {
    alert(err.response?.data?.error || '操作失败')
  }
}

const claimTask = async (id) => {
  try {
    const res = await axios.post(`/api/tasks/${id}/claim`, {}, authHeader())
    alert(res.data.message + (res.data.levelUp ? `\n🎉 升级到 ${res.data.levelUp} 级！` : ''))
    loadTasks()
    loadPet()
    loadInventory()
  } catch (err) {
    alert(err.response?.data?.error || '领取失败')
  }
}

const logout = () => {
  userStore.logout()
  router.push('/')
}

onMounted(async () => {
  await loadPet()
  await loadTasks()
  await loadInventory()
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

.pet-card {
  text-align: center;
}

.pet-sprite {
  font-size: 80px;
  animation: bounce 1s infinite;
}

.pet-sprite.dead {
  filter: grayscale(1);
  animation: none;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.pet-info h3 {
  font-size: 24px;
  margin: 8px 0 4px;
}

.level {
  color: #666;
  font-size: 14px;
}

.stats {
  margin-top: 20px;
  text-align: left;
}

.stat {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.stat-label {
  width: 60px;
  font-size: 14px;
}

.stat-bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin: 0 8px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.stat-fill.hp { background: linear-gradient(90deg, #ff6b6b, #ee5a5a); }
.stat-fill.hunger { background: linear-gradient(90deg, #ffd93d, #ffb800); }
.stat-fill.mood { background: linear-gradient(90deg, #6bcb77, #4caf50); }

.stat-value {
  width: 30px;
  text-align: right;
  font-size: 14px;
  font-weight: 500;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 24px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.feed {
  background: linear-gradient(135deg, #ffd93d, #ffb800);
  color: #333;
}

.action-btn.revive {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

/* 互动按钮样式 */
.interactions {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.action-btn.bath {
  background: linear-gradient(135deg, #74b9ff, #0984e3);
  color: white;
}

.action-btn.read {
  background: linear-gradient(135deg, #a29bfe, #6c5ce7);
  color: white;
}

.action-btn.exercise {
  background: linear-gradient(135deg, #fd79a8, #e84393);
  color: white;
}

.action-btn.play {
  background: linear-gradient(135deg, #ffeaa7, #fdcb6e);
  color: #333;
}

/* 动画效果 */
.animation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1000;
}

.animation-content {
  font-size: 100px;
  opacity: 0;
  transform: scale(0.5);
}

.animation.feed .animation-content {
  animation: feedAnim 1s ease-out forwards;
}

.animation.bath .animation-content {
  animation: bathAnim 1.5s ease-out forwards;
}

.animation.read .animation-content {
  animation: readAnim 1.2s ease-out forwards;
}

.animation.exercise .animation-content {
  animation: exerciseAnim 1s ease-out forwards;
}

.animation.play .animation-content {
  animation: playAnim 1.5s ease-out forwards;
}

@keyframes feedAnim {
  0% { opacity: 1; transform: scale(0.5) translateY(0); }
  50% { opacity: 1; transform: scale(1.2) translateY(-20px); }
  100% { opacity: 0; transform: scale(1.5) translateY(-50px); }
}

@keyframes bathAnim {
  0% { opacity: 1; transform: scale(0.5) rotate(0deg); }
  30% { opacity: 1; transform: scale(1) rotate(-10deg); }
  60% { opacity: 1; transform: scale(1.1) rotate(10deg); }
  100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
}

@keyframes readAnim {
  0% { opacity: 1; transform: translateX(-100px) scale(1); }
  50% { opacity: 1; transform: translateX(0) scale(1.2); }
  100% { opacity: 0; transform: translateX(100px) scale(1); }
}

@keyframes exerciseAnim {
  0% { opacity: 1; transform: translateX(-50px) scale(1); }
  25% { opacity: 1; transform: translateX(50px) scale(1.1); }
  50% { opacity: 1; transform: translateX(-50px) scale(1); }
  75% { opacity: 1; transform: translateX(50px) scale(1.1); }
  100% { opacity: 0; transform: translateX(0) scale(1); }
}

@keyframes playAnim {
  0% { opacity: 1; transform: scale(0.3) rotate(0deg); }
  25% { opacity: 1; transform: scale(1) rotate(90deg); }
  50% { opacity: 1; transform: scale(1.3) rotate(180deg); }
  75% { opacity: 1; transform: scale(1) rotate(270deg); }
  100% { opacity: 0; transform: scale(0.5) rotate(360deg); }
}

.no-pet {
  padding: 40px 0;
}

.no-pet p {
  color: #999;
  margin-bottom: 16px;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 16px;
  width: 90%;
  max-width: 320px;
}

.modal-content h2 {
  text-align: center;
  margin-bottom: 20px;
}

.pet-select {
  display: flex;
  gap: 12px;
}

.pet-select button {
  flex: 1;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  font-size: 16px;
}

.pet-select button.active {
  border-color: #667eea;
  background: #f0f3ff;
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.modal-actions .btn {
  flex: 1;
}

.modal-actions .btn.cancel {
  background: #e0e0e0;
  color: #666;
}

/* Tasks */
.card h2 {
  font-size: 16px;
  margin-bottom: 16px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 12px;
}

.task-info {
  display: flex;
  flex-direction: column;
}

.task-title {
  font-weight: 500;
}

.task-reward {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 16px;
  font-size: 14px;
  cursor: pointer;
}

.task-btn.complete {
  background: #e3f2fd;
  color: #1976d2;
}

.task-btn.claim {
  background: #ffd93d;
  color: #333;
}

.task-status.done {
  color: #4caf50;
  font-size: 14px;
}

.empty {
  text-align: center;
  color: #999;
  padding: 20px;
}
</style>
