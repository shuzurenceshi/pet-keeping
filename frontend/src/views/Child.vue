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
        <!-- 3D 宠物容器 -->
        <div class="pet-3d-wrapper" :class="animation">
          <div class="pet-3d">
            <div class="pet-sprite" :class="{ dead: !pet.is_alive }">
              {{ pet.type === 'cat' ? '🐱' : '🐶' }}
            </div>
          </div>
          <!-- 洗澡特效 -->
          <div v-if="animation === 'bath'" class="fx bath-fx">
            <span v-for="i in 8" :key="'d'+i" class="drop" :style="{ '--d': i*0.1+'s', '--x': (i*15-60)+'px' }">💧</span>
            <span class="bubble">🫧</span>
            <span class="bubble b2">🫧</span>
          </div>
          <!-- 读书特效 -->
          <div v-if="animation === 'read'" class="fx read-fx">
            <span class="book">📖</span>
            <span class="idea">💡</span>
            <span v-for="i in 3" :key="'s'+i" class="spark" :style="{ '--d': i*0.2+'s' }">✨</span>
          </div>
          <!-- 运动特效 -->
          <div v-if="animation === 'exercise'" class="fx run-fx">
            <span v-for="i in 4" :key="'r'+i" class="puff" :style="{ '--d': i*0.2+'s' }">💨</span>
            <span class="pulse">💓</span>
          </div>
          <!-- 玩耍特效 -->
          <div v-if="animation === 'play'" class="fx play-fx">
            <span class="ball">🎾</span>
            <span v-for="i in 6" :key="'st'+i" class="star" :style="{ '--d': i*0.1+'s', '--a': (i*60)+'deg' }">⭐</span>
          </div>
          <!-- 喂食特效 -->
          <div v-if="animation === 'feed'" class="fx feed-fx">
            <span class="meat">🍖</span>
            <span class="love">❤️</span>
          </div>
        </div>

        <div class="pet-info">
          <h3>{{ pet.name }}</h3>
          <p class="level">Lv.{{ pet.level }} ({{ pet.exp }}/{{ pet.level * 50 }})</p>
        </div>
        
        <div class="stats">
          <div class="stat">
            <span class="label">❤️</span>
            <div class="bar"><div class="fill hp" :style="{ width: pet.hp + '%' }"></div></div>
            <span class="val">{{ pet.hp }}</span>
          </div>
          <div class="stat">
            <span class="label">🍖</span>
            <div class="bar"><div class="fill hunger" :style="{ width: pet.hunger + '%' }"></div></div>
            <span class="val">{{ pet.hunger }}</span>
          </div>
          <div class="stat">
            <span class="label">😊</span>
            <div class="bar"><div class="fill mood" :style="{ width: pet.mood + '%' }"></div></div>
            <span class="val">{{ pet.mood }}</span>
          </div>
        </div>

        <div class="actions">
          <button class="act-btn feed" @click="feedPet" :disabled="!pet.is_alive || foodCount <= 0">🍖 {{ foodCount }}</button>
          <button class="act-btn bath" @click="bathPet" :disabled="!pet.is_alive">🛁 洗澡</button>
          <button class="act-btn read" @click="readPet" :disabled="!pet.is_alive">📚 读书</button>
          <button class="act-btn run" @click="exercisePet" :disabled="!pet.is_alive">🏃 运动</button>
          <button class="act-btn play" @click="playPet" :disabled="!pet.is_alive">🎾 玩耍</button>
          <button v-if="!pet.is_alive" class="act-btn revive" @click="revivePet">✨ 复活</button>
        </div>

        <!-- 底部消息 -->
        <transition name="msg">
          <div v-if="msg" class="msg-bar">{{ msg }}</div>
        </transition>
      </div>
    </div>

    <!-- 领养弹窗 -->
    <div v-if="showAdopt" class="modal">
      <div class="modal-box">
        <h2>领养宠物</h2>
        <input v-model="newPet.name" class="inp" placeholder="给宠物起个名字" />
        <div class="pick">
          <button :class="{ on: newPet.type === 'cat' }" @click="newPet.type = 'cat'">🐱 猫咪</button>
          <button :class="{ on: newPet.type === 'dog' }" @click="newPet.type = 'dog'">🐶 狗狗</button>
        </div>
        <div class="btns">
          <button class="btn primary" @click="adoptPet">领养</button>
          <button class="btn" @click="showAdopt = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="card">
      <h2>📋 我的任务</h2>
      <div v-if="tasks.length === 0" class="empty">暂无任务</div>
      <div v-else class="tasks">
        <div v-for="t in tasks" :key="t.id" class="task">
          <div class="t-info">
            <b>{{ t.title }}</b>
            <span>🍖×{{ t.reward_food }} +{{ t.reward_exp }}exp</span>
          </div>
          <button v-if="t.status === 'pending'" class="t-btn ok" @click="completeTask(t.id)">完成</button>
          <button v-if="t.status === 'completed'" class="t-btn get" @click="claimTask(t.id)">领奖</button>
          <span v-if="t.status === 'claimed'" class="done">✅</span>
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
const msg = ref(null)
const newPet = ref({ name: '', type: 'cat' })

const auth = () => ({ headers: { Authorization: `Bearer ${userStore.token}` } })

const loadPet = async () => {
  try { pet.value = (await axios.get('/api/pet', auth())).data.pet } catch {}
}
const loadTasks = async () => {
  try { tasks.value = (await axios.get('/api/tasks/my', auth())).data.tasks } catch {}
}
const loadInv = async () => {
  try {
    const res = (await axios.get('/api/inventory', auth())).data.items
    const f = res.find(i => i.item_type === 'food')
    foodCount.value = f ? f.quantity : 0
  } catch {}
}

const adoptPet = async () => {
  if (!newPet.value.name) return alert('请给宠物起个名字')
  try {
    const res = await axios.post('/api/pet/create', newPet.value, auth())
    pet.value = res.data.pet
    showAdopt.value = false
    alert(res.data.message)
  } catch (e) { alert(e.response?.data?.error || '领养失败') }
}

const showAnim = (type, message) => {
  animation.value = type
  msg.value = message
  setTimeout(() => { animation.value = null; msg.value = null }, 2000)
}

const feedPet = async () => {
  try {
    const res = await axios.post('/api/pet/feed', {}, auth())
    pet.value = res.data.pet
    loadInv()
    showAnim('feed', res.data.message)
  } catch (e) { showAnim(null, e.response?.data?.error || '喂食失败') }
}

const bathPet = async () => {
  try {
    const res = await axios.post('/api/pet/bath', {}, auth())
    pet.value = res.data.pet
    showAnim('bath', res.data.message)
  } catch (e) { showAnim(null, e.response?.data?.error || '洗澡失败') }
}

const readPet = async () => {
  try {
    const res = await axios.post('/api/pet/read', {}, auth())
    pet.value = res.data.pet
    const m = res.data.levelUp ? `${res.data.message} 🎉升级到${res.data.levelUp}级！` : res.data.message
    showAnim('read', m)
  } catch (e) { showAnim(null, e.response?.data?.error || '读书失败') }
}

const exercisePet = async () => {
  try {
    const res = await axios.post('/api/pet/exercise', {}, auth())
    pet.value = res.data.pet
    const m = res.data.levelUp ? `${res.data.message} 🎉升级到${res.data.levelUp}级！` : res.data.message
    showAnim('exercise', m)
  } catch (e) { showAnim(null, e.response?.data?.error || '运动失败') }
}

const playPet = async () => {
  try {
    const res = await axios.post('/api/pet/play', {}, auth())
    pet.value = res.data.pet
    showAnim('play', res.data.message)
  } catch (e) { showAnim(null, e.response?.data?.error || '玩耍失败') }
}

const revivePet = async () => {
  try {
    const res = await axios.post('/api/pet/revive', {}, auth())
    pet.value = res.data.pet
    alert(res.data.message)
  } catch (e) { alert(e.response?.data?.error || '复活失败') }
}

const completeTask = async (id) => {
  try {
    await axios.post(`/api/tasks/${id}/complete`, {}, auth())
    loadTasks()
  } catch (e) { alert(e.response?.data?.error) }
}

const claimTask = async (id) => {
  try {
    const res = await axios.post(`/api/tasks/${id}/claim`, {}, auth())
    if (res.data.levelUp) alert(`🎉 升级到 ${res.data.levelUp} 级！`)
    loadTasks(); loadPet(); loadInv()
  } catch (e) { alert(e.response?.data?.error) }
}

const logout = () => { userStore.logout(); router.push('/') }

onMounted(async () => { await loadPet(); await loadTasks(); await loadInv() })
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; color: white; }
.header h1 { font-size: 20px; }
.logout-btn { background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; }

.pet-card { text-align: center; }

/* 3D 宠物容器 */
.pet-3d-wrapper {
  position: relative;
  display: inline-block;
  perspective: 800px;
  margin: 16px 0;
}

.pet-3d {
  transform-style: preserve-3d;
  transition: transform 0.3s;
}

.pet-sprite {
  font-size: 100px;
  animation: idle 2s ease-in-out infinite;
  display: block;
}
.pet-sprite.dead { filter: grayscale(1); animation: none; }

@keyframes idle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 洗澡动画 */
.pet-3d-wrapper.bath .pet-3d { animation: wiggle 1.5s ease-in-out; }
@keyframes wiggle {
  0%, 100% { transform: rotateY(0deg); }
  25% { transform: rotateY(-20deg); }
  75% { transform: rotateY(20deg); }
}

.bath-fx .drop {
  position: absolute;
  font-size: 20px;
  animation: splash 1s ease-out forwards;
  animation-delay: var(--d);
  top: 30%;
  left: 50%;
}
@keyframes splash {
  0% { transform: translate(0,0) scale(0); opacity: 1; }
  50% { transform: translate(var(--x), -60px) scale(1.2); opacity: 1; }
  100% { transform: translate(var(--x), -100px) scale(0.5); opacity: 0; }
}
.bath-fx .bubble { position: absolute; font-size: 32px; animation: bub 1.5s ease-out; top: 10%; left: 60%; }
.bath-fx .b2 { left: 30%; animation-delay: 0.3s; }
@keyframes bub { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(0.5); opacity: 0; } }

/* 读书动画 */
.pet-3d-wrapper.read .pet-3d { animation: nod 2s ease-in-out; }
@keyframes nod {
  0%, 100% { transform: rotateX(0deg); }
  30% { transform: rotateX(-15deg); }
  60% { transform: rotateX(10deg); }
}

.read-fx .book { position: absolute; font-size: 40px; animation: floatIn 1.5s ease-out; top: 10%; left: 20%; }
@keyframes floatIn { 0% { transform: translateY(30px) rotate(-20deg); opacity: 0; } 40% { transform: translateY(0) rotate(0); opacity: 1; } 100% { opacity: 0; } }
.read-fx .idea { position: absolute; font-size: 32px; animation: pop 1s ease-out 0.5s forwards; top: 5%; right: 25%; opacity: 0; }
@keyframes pop { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.5); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
.read-fx .spark { position: absolute; font-size: 20px; animation: twinkle 1s ease-out forwards; animation-delay: var(--d); top: 15%; left: 50%; }
@keyframes twinkle { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0); opacity: 0; } }

/* 运动动画 */
.pet-3d-wrapper.exercise .pet-3d { animation: jump 1.5s ease-in-out; }
@keyframes jump {
  0%, 100% { transform: translateX(0) translateY(0); }
  20% { transform: translateX(-30px) translateY(-20px); }
  40% { transform: translateX(30px) translateY(-15px); }
  60% { transform: translateX(-20px) translateY(-25px); }
  80% { transform: translateX(20px) translateY(-10px); }
}

.run-fx .puff { position: absolute; font-size: 18px; animation: puff 1s ease-out forwards; animation-delay: var(--d); top: 40%; left: 40%; }
@keyframes puff { 0% { transform: scale(0) translateX(0); opacity: 0; } 30% { transform: scale(1) translateX(-20px); opacity: 0.8; } 100% { transform: scale(0.5) translateX(-50px); opacity: 0; } }
.run-fx .pulse { position: absolute; font-size: 28px; animation: beat 1s ease-out 0.5s; top: 20%; right: 30%; }
@keyframes beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }

/* 玩耍动画 */
.pet-3d-wrapper.play .pet-3d { animation: roll 2s ease-in-out; }
@keyframes roll {
  0% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(90deg) scale(1.2); }
  50% { transform: rotate(180deg) scale(1); }
  75% { transform: rotate(270deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

.play-fx .ball { position: absolute; font-size: 36px; animation: bounce 1.5s ease-out; top: 30%; left: 20%; }
@keyframes bounce {
  0% { transform: translateX(0) translateY(0); }
  25% { transform: translateX(80px) translateY(-60px); }
  50% { transform: translateX(120px) translateY(0); }
  75% { transform: translateX(80px) translateY(-30px); }
  100% { transform: translateX(40px) translateY(0); opacity: 0; }
}
.play-fx .star { position: absolute; font-size: 24px; animation: burst 1.5s ease-out forwards; animation-delay: var(--d); top: 50%; left: 50%; }
@keyframes burst {
  0% { transform: translate(0,0) scale(0); opacity: 0; }
  30% { transform: translate(calc(cos(var(--a)) * 60px), calc(sin(var(--a)) * 60px)) scale(1.2); opacity: 1; }
  100% { transform: translate(calc(cos(var(--a)) * 100px), calc(sin(var(--a)) * 100px)) scale(0.5); opacity: 0; }
}

/* 喂食动画 */
.pet-3d-wrapper.feed .pet-3d { animation: eat 1.5s ease-in-out; }
@keyframes eat {
  0%, 100% { transform: scale(1); }
  30% { transform: scale(1.2); }
  50% { transform: scale(1.1) translateY(-5px); }
  70% { transform: scale(1.15); }
}

.feed-fx .meat { position: absolute; font-size: 40px; animation: fallDown 1.5s ease-out; top: -20%; left: 45%; }
@keyframes fallDown { 0% { transform: translateY(-50px); opacity: 0; } 40% { transform: translateY(20px); opacity: 1; } 60% { transform: translateY(0); } 100% { transform: translateY(10px) scale(1.5); opacity: 0; } }
.feed-fx .love { position: absolute; font-size: 28px; animation: floatUp 1.5s ease-out 0.3s; top: 35%; left: 55%; }
@keyframes floatUp { 0% { transform: translateY(0) scale(0); opacity: 0; } 30% { transform: translateY(-20px) scale(1.2); opacity: 1; } 100% { transform: translateY(-60px) scale(0.8); opacity: 0; } }

/* 特效通用 */
.fx { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }

.pet-info h3 { font-size: 24px; margin: 8px 0 4px; }
.level { color: #666; font-size: 14px; }

.stats { margin-top: 16px; text-align: left; }
.stat { display: flex; align-items: center; margin-bottom: 10px; }
.stat .label { width: 24px; }
.stat .bar { flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; margin: 0 8px; overflow: hidden; }
.stat .fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.stat .fill.hp { background: linear-gradient(90deg, #ff6b6b, #ee5a5a); }
.stat .fill.hunger { background: linear-gradient(90deg, #ffd93d, #ffb800); }
.stat .fill.mood { background: linear-gradient(90deg, #6bcb77, #4caf50); }
.stat .val { width: 30px; text-align: right; font-size: 14px; }

.actions { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.act-btn { padding: 10px 16px; border: none; border-radius: 20px; font-size: 14px; cursor: pointer; transition: transform 0.2s; }
.act-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.act-btn.feed { background: linear-gradient(135deg, #ffd93d, #ffb800); color: #333; }
.act-btn.bath { background: linear-gradient(135deg, #74b9ff, #0984e3); color: white; }
.act-btn.read { background: linear-gradient(135deg, #a29bfe, #6c5ce7); color: white; }
.act-btn.run { background: linear-gradient(135deg, #fd79a8, #e84393); color: white; }
.act-btn.play { background: linear-gradient(135deg, #ffeaa7, #fdcb6e); color: #333; }
.act-btn.revive { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
.act-btn:not(:disabled):active { transform: scale(0.95); }

/* 底部消息 */
.msg-bar {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 13px;
  max-width: 85%;
  text-align: center;
  z-index: 100;
}
.msg-enter-active, .msg-leave-active { transition: opacity 0.3s; }
.msg-enter-from, .msg-leave-to { opacity: 0; }

.no-pet { padding: 40px 0; }
.no-pet p { color: #999; margin-bottom: 16px; }

/* 弹窗 */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: white; padding: 24px; border-radius: 16px; width: 90%; max-width: 300px; }
.modal-box h2 { text-align: center; margin-bottom: 16px; }
.inp { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px; box-sizing: border-box; }
.pick { display: flex; gap: 10px; margin-bottom: 16px; }
.pick button { flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; }
.pick button.on { border-color: #667eea; background: #f0f3ff; }
.btns { display: flex; gap: 10px; }
.btn { flex: 1; padding: 10px; border: none; border-radius: 8px; cursor: pointer; }
.btn.primary { background: #667eea; color: white; }

/* 任务 */
.card h2 { font-size: 16px; margin-bottom: 12px; }
.tasks { display: flex; flex-direction: column; gap: 10px; }
.task { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f5f5f5; border-radius: 10px; }
.t-info { display: flex; flex-direction: column; }
.t-info span { font-size: 12px; color: #666; margin-top: 4px; }
.t-btn { padding: 6px 14px; border: none; border-radius: 14px; font-size: 13px; cursor: pointer; }
.t-btn.ok { background: #e3f2fd; color: #1976d2; }
.t-btn.get { background: #ffd93d; color: #333; }
.done { color: #4caf50; }
.empty { text-align: center; color: #999; padding: 20px; }
</style>
