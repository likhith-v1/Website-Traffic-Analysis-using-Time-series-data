import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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
