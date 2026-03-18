import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

api.interceptors.response.use(
  response => response,
  error => {
    const detail = error.response?.data?.detail
    const message =
      detail ||
      (error.code === 'ECONNABORTED'
        ? 'Request timed out. Make sure the backend is running.'
        : 'Request failed. Check the backend connection and try again.')
    return Promise.reject(new Error(message))
  }
)

export const getStats            = ()              => api.get('/stats').then(r => r.data)
export const getTopArticles      = (n=20, project='en.wikipedia.org', access='all-access') =>
  api.get('/top-articles', { params: { n, project, access } }).then(r => r.data)
export const getArticle          = (name, project='en.wikipedia.org', access='all-access') =>
  api.get('/article', { params: { name, project, access } }).then(r => r.data)
export const getAggregatedDaily  = (project='en.wikipedia.org', access='all-access', start, end) =>
  api.get('/aggregated-daily', { params: { project, access, start, end } }).then(r => r.data)
export const getProjectBreakdown = ()              => api.get('/project-breakdown').then(r => r.data)
export const getAccessBreakdown  = ()              => api.get('/access-breakdown').then(r => r.data)
export const searchArticles      = (q, project='en.wikipedia.org') =>
  api.get('/search', { params: { q, project } }).then(r => r.data)
export const getForecast         = (article)       => api.get('/precomputed/forecast', { params: { article } }).then(r => r.data)
export const getModelComparison  = ()              => api.get('/precomputed/model-comparison').then(r => r.data)
