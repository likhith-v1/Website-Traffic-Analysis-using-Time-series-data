import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({ baseURL: BASE, timeout: 60000 })

api.interceptors.response.use(
  r => r,
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
export const getAnalysisResults  = ()              => api.get('/precomputed/analysis').then(r => r.data)
export const getPlotUrl          = (filename)      => `${BASE}/plots/${filename}`

/**
 * Open a Server-Sent Events connection to /run-pipeline and call callbacks
 * as lines arrive.
 *
 * @param {object}   opts
 * @param {string}   opts.article        – article name passed to main.py
 * @param {boolean}  opts.skipAnalysis   – pass --skip-analysis flag
 * @param {number}   opts.d              – differencing order (only used with skipAnalysis)
 * @param {function} opts.onLine         – called with each log line string
 * @param {function} opts.onDone         – called when pipeline finishes successfully
 * @param {function} opts.onError        – called with error message string
 * @returns {EventSource}  – call .close() to cancel
 */
export function streamPipeline({ article = 'Main_Page', skipAnalysis = false, d = 1, onLine, onDone, onError }) {
  const params = new URLSearchParams({ article, d })
  if (skipAnalysis) params.set('skip_analysis', 'true')

  // Use the real backend URL directly — EventSource doesn't go through the
  // Vite proxy so we need the absolute URL.
  const backendBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
  const url = `${backendBase}/run-pipeline?${params}`

  const es = new EventSource(url)

  es.onmessage = (e) => {
    const data = e.data
    if (data === 'DONE') {
      es.close()
      onDone?.()
    } else if (data.startsWith('ERROR:')) {
      es.close()
      onError?.(data.slice(6))
    } else {
      onLine?.(data)
    }
  }

  es.onerror = () => {
    es.close()
    onError?.('Connection to backend lost. Is uvicorn running?')
  }

  return es
}
