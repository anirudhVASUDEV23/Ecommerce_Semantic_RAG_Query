import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

/**
 * POST /chat — get full response
 */
export const sendChat = (query, session_id = 'default') =>
  api.post('/chat', { query, session_id }).then((r) => r.data)

/**
 * POST /chat/stream — get a streaming fetch (not axios)
 * Returns the raw Response so the caller can consume the ReadableStream.
 */
export const sendChatStream = (query, session_id = 'default') =>
  fetch('http://localhost:8000/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id }),
  })

/**
 * GET /health
 */
export const getHealth = () => api.get('/health').then((r) => r.data)

/**
 * GET /admin/stats
 */
export const getStats = () => api.get('/admin/stats').then((r) => r.data)

export default api
