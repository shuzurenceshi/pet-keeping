<template>
  <div class="page login-page">
    <div class="card">
      <h1 class="title">🐱 萌宠养成 🐶</h1>
      
      <!-- 切换标签 -->
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <!-- 登录表单 -->
      <div v-if="mode === 'login'" class="form">
        <div class="form-group">
          <label class="label">用户名</label>
          <input v-model="form.username" class="input" placeholder="请输入用户名" />
        </div>
        <div class="form-group">
          <label class="label">密码</label>
          <input v-model="form.password" type="password" class="input" placeholder="请输入密码" />
        </div>
        <button class="btn" @click="login">登录</button>
      </div>

      <!-- 注册表单 -->
      <div v-else class="form">
        <div class="form-group">
          <label class="label">用户名</label>
          <input v-model="form.username" class="input" placeholder="请输入用户名" />
        </div>
        <div class="form-group">
          <label class="label">密码</label>
          <input v-model="form.password" type="password" class="input" placeholder="请输入密码" />
        </div>
        <div class="form-group">
          <label class="label">昵称</label>
          <input v-model="form.nickname" class="input" placeholder="请输入昵称（可选）" />
        </div>
        <div class="form-group">
          <label class="label">角色</label>
          <div class="role-select">
            <button 
              :class="{ active: form.role === 'parent' }" 
              @click="form.role = 'parent'"
            >
              👨‍👩‍👧 家长
            </button>
            <button 
              :class="{ active: form.role === 'child' }" 
              @click="form.role = 'child'"
            >
              👧 孩子
            </button>
          </div>
        </div>
        
        <!-- 孩子需要填写家长账号 -->
        <div v-if="form.role === 'child'" class="form-group">
          <label class="label">家长账号 ID</label>
          <input v-model.number="form.parent_id" type="number" class="input" placeholder="请输入家长账号 ID" />
          <p class="hint">请联系家长获取账号 ID</p>
        </div>
        
        <button class="btn" @click="register">注册</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import axios from 'axios'

const router = useRouter()
const userStore = useUserStore()

const mode = ref('login')
const form = ref({
  username: '',
  password: '',
  nickname: '',
  role: 'parent',
  parent_id: null
})

const login = async () => {
  if (!form.value.username || !form.value.password) {
    alert('请填写用户名和密码')
    return
  }

  try {
    const res = await axios.post('/api/auth/login', {
      username: form.value.username,
      password: form.value.password
    })

    userStore.setUser(res.data.token, res.data.user)
    
    // 根据角色跳转
    if (res.data.user.role === 'parent') {
      router.push('/parent')
    } else {
      router.push('/child')
    }
  } catch (err) {
    alert(err.response?.data?.error || '登录失败')
  }
}

const register = async () => {
  if (!form.value.username || !form.value.password) {
    alert('请填写用户名和密码')
    return
  }

  if (form.value.role === 'child' && !form.value.parent_id) {
    alert('请填写家长账号 ID')
    return
  }

  try {
    const res = await axios.post('/api/auth/register', form.value)
    alert(`注册成功！你的账号 ID 是: ${res.data.userId}（请保存好）`)
    mode.value = 'login'
  } catch (err) {
    alert(err.response?.data?.error || '注册失败')
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  background: #f5f5f5;
  border-radius: 12px;
  overflow: hidden;
}

.tabs button {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.tabs button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.role-select {
  display: flex;
  gap: 12px;
}

.role-select button {
  flex: 1;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
}

.role-select button.active {
  border-color: #667eea;
  background: #f0f3ff;
}

.hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
