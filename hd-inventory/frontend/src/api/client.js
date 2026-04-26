/**
 * Cliente Axios con interceptores JWT.
 * - Añade Bearer token a cada request
 * - Renueva automáticamente el access token con el refresh token
 */
import axios from 'axios'

const apiBaseEnv = import.meta.env.VITE_API_URL
const apiBase = (apiBaseEnv && !apiBaseEnv.includes('backend:'))
  ? `${apiBaseEnv}/api`
  : '/api'

console.log('API Base URL:', apiBase)

const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Interceptor de request — inyecta access token ───────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// ─── Interceptor de response — renueva token en error 401 ────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          original.headers['Authorization'] = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      const refresh = localStorage.getItem('refresh_token')
      if (!refresh) {
        // Sin refresh token — redirigir a login
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${apiBase}/auth/token/refresh/`, { refresh })
        const newToken = data.access
        localStorage.setItem('access_token', newToken)
        api.defaults.headers['Authorization'] = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers['Authorization'] = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
