import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import Parent from './views/Parent.vue'
import Child from './views/Child.vue'

const routes = [
  { path: '/', component: Login },
  { path: '/parent', component: Parent },
  { path: '/child', component: Child }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  if (to.path !== '/' && !token) {
    return next('/')
  }
  
  next()
})

export default router
