import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  getModelComparison, getForecast, streamPipeline,
  getAnalysisResults, getPlotUrl, searchArticles,
} from '../api/client'
import {
  Play, Square, RefreshCw, X, TrendingUp,
  AlertCircle, Settings2, Activity, Search,
} from 'lucide-react'
import { cx } from '../lib/utils'

/* ── constants ────────────────────────────────────────────────── */
const ALL_METRICS     = ['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'R2', 'Bias']
const LOWER_IS_BETTER = new Set(['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'Bias'])
const CHART_COLORS    = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const ANALYSIS_PLOTS = [
  { base: '01_time_plot',          label: 'Time Plot'          },
  { base: '02_moving_averages',    label: 'Moving Averages'    },
  { base: '03_stl_decomposition',  label: 'STL Decomposition'  },
  { base: '04_acf_pacf',           label: 'ACF / PACF'         },
  { base: '05_seasonal_subseries', label: 'Seasonal Subseries' },
  { base: '06_lag_scatter',        label: 'Lag Scatter'        },
]
const FORECAST_PLOTS = [
  { base: '07_linear_trend', label: 'Linear Trend' },
  { base: '08_holt_winters', label: 'Holt-Winters'  },
  { base: '09_arima',        label: 'ARIMA'         },
  { base: '10_sarima',       label: 'SARIMA'        },
]

/* ── helpers ──────────────────────────────────────────────────── */
const fmtMetric = v =>
  v == null ? '—'
  : typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  : v

function presentMetrics(rows) {
  if (!rows?.length) return ALL_METRICS
  return ALL_METRICS.filter(m => rows.some(r => r[m] != null))
}

function sortRows(rows, metric) {
  const factor = LOWER_IS_BETTER.has(metric) ? 1 : -1
  return [...rows].sort((a, b) => ((a[metric] ?? Infinity) - (b[metric] ?? Infinity)) * factor)
}

function statusBadge(rank, mape) {
  if (rank === 0) return { label: 'Optimal',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400' }
  if (mape != null && mape > 20) return { label: 'Heavy',   cls: 'bg-secondary-fixed text-on-secondary-fixed-variant dark:bg-yellow-400/10 dark:text-yellow-400' }
  return { label: 'Ready', cls: 'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300' }
}

/* ── sub-components ───────────────────────────────────────────── */
function PlotGrid({ plots, theme, onClickImg }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {plots.map(({ base, label }) => {
        const file = `${base}_${theme}.png`
        return (
          <div
            key={base}
            onClick={() => onClickImg(getPlotUrl(file))}
            className="overflow-hidden rounded-xl border border-surface-container dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-900 cursor-zoom-in hover:-translate-y-0.5 transition-transform"
          >
            <img
              src={getPlotUrl(file)}
              alt={label}
              className="w-full block"
              style={{ aspectRatio: '16/7', objectFit: 'cover' }}
            />
            <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant dark:text-slate-400">
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SectionCard({ title, subtitle, children, className }) {
  return (
    <div className={cx(
      'bg-surface-container-lowest dark:bg-slate-900',
      'rounded-xl border border-surface-container dark:border-slate-800 shadow-sm',
      className,
    )}>
      {(title || subtitle) && (
        <div className="px-6 py-5 border-b border-surface-container dark:border-slate-800">
          {title   && <h3 className="font-bold text-primary dark:text-white font-display">{title}</h3>}
          {subtitle && <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

/* ── main component ───────────────────────────────────────────── */
export default function Models() {
  const [comparison,     setComparison]     = useState(null)
  const [forecast,       setForecast]       = useState(null)
  const [analysis,       setAnalysis]       = useState(null)
  const [metric,         setMetric]         = useState('MAPE (%)')
  const [loadError,      setLoadError]      = useState('')
  const [lightboxImg,    setLightboxImg]    = useState(null)
  const [effectiveTheme, setEffectiveTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  )
  const [article,        setArticle]        = useState('Main_Page')
  const [skipAnalysis,   setSkipAnalysis]   = useState(false)
  const [running,        setRunning]        = useState(false)
  const [logLines,       setLogLines]       = useState([])
  const [pipelineError,  setPipelineError]  = useState('')
  const [pipelineDone,   setPipelineDone]   = useState(false)

  const [articleQuery,  setArticleQuery]  = useState('Main_Page')
  const [suggestions,   setSuggestions]   = useState([])
  const [sugLoading,    setSugLoading]    = useState(false)
  const [showDrop,      setShowDrop]      = useState(false)
  const [focusedIdx,    setFocusedIdx]    = useState(-1)

  const esRef      = useRef(null)
  const logRef     = useRef(null)
  const timerRef   = useRef(null)
  const dropRef    = useRef(null)
  const abortRef   = useRef(null)

  const loadResults = () => {
    setLoadError('')
    getModelComparison()
      .then(d => {
        const rows = Array.isArray(d) ? d : []
        setComparison(rows)
        if (rows.length > 0)
          setMetric(rows[0]['MAPE (%)'] !== undefined ? 'MAPE (%)' : presentMetrics(rows)[0])
      })
      .catch(err => setLoadError(err.message || 'Unable to load precomputed results'))
    getForecast(article).then(setForecast).catch(() => {})
    getAnalysisResults().then(setAnalysis).catch(() => {})
  }

  useEffect(() => { loadResults() }, []) // eslint-disable-line

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setEffectiveTheme(document.documentElement.dataset.theme || 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setLightboxImg(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* debounced article autocomplete */
  useEffect(() => {
    if (articleQuery.length < 2) { setSuggestions([]); setShowDrop(false); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      setSugLoading(true)
      try {
        const res = await searchArticles(articleQuery, 'en.wikipedia.org', abortRef.current.signal)
        setSuggestions(res.slice(0, 6))
        setShowDrop(true)
        setFocusedIdx(-1)
      } catch (e) {
        if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') setSuggestions([])
      }
      setSugLoading(false)
    }, 320)
    return () => clearTimeout(timerRef.current)
  }, [articleQuery])

  /* close dropdown on outside click */
  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectArticle = (r) => {
    setArticle(r.article)
    setArticleQuery(r.article)
    setShowDrop(false)
  }

  const startPipeline = () => {
    if (running) return
    setRunning(true); setLogLines([]); setPipelineError(''); setPipelineDone(false)
    esRef.current = streamPipeline({
      article, skipAnalysis, d: analysis?.d ?? 1,
      onLine:  line => setLogLines(prev => [...prev, line]),
      onDone:  ()   => { setRunning(false); setPipelineDone(true); loadResults() },
      onError: msg  => { setRunning(false); setPipelineError(msg) },
    })
  }

  const stopPipeline = () => {
    esRef.current?.close()
    setRunning(false)
    setLogLines(prev => [...prev, '— stopped by user —'])
  }

  const availableMetrics  = presentMetrics(comparison)
  const sortedComparison  = comparison ? sortRows(comparison, metric) : []
  const bestRow           = sortedComparison[0]

  const futureCombined = (() => {
    if (!forecast?.future?.length || !forecast?.test_dates?.length) return null
    const lastDate = new Date(forecast.test_dates[forecast.test_dates.length - 1])
    const testData = forecast.actual.map((v, i) => ({
      date: forecast.test_dates[i], actual: v, modelForecast: forecast.forecast?.[i],
    }))
    const futureData = forecast.future.map((v, i) => {
      const d = new Date(lastDate); d.setDate(d.getDate() + i + 1)
      return { date: d.toISOString().slice(0, 10), future: v }
    })
    return [...testData, ...futureData]
  })()

  /* sparkline bars from comparison MAPE (inverted for "better = taller") */
  const sparkBars = (() => {
    if (!sortedComparison.length) return null
    const mapes = sortedComparison.map(r => r['MAPE (%)'] ?? 0)
    const maxM = Math.max(...mapes, 1)
    return mapes.map((m, i) => ({
      model: sortedComparison[i].Model,
      pct: Math.round(((maxM - m) / maxM) * 100),
      best: i === 0,
    }))
  })()

  /* health score from best R² */
  const healthScore = bestRow?.R2 != null
    ? `${(bestRow.R2 * 100).toFixed(1)}%`
    : '—'

  return (
    <div className="p-6 lg:p-8 bg-surface dark:bg-slate-950 min-h-full">
      <div className="max-w-7xl mx-auto">

        {/* ── Page title ───────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-secondary mb-2">
            <Activity size={13} />
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] font-bold">ML Pipeline</span>
          </div>
          <h2 className="text-4xl font-extrabold text-primary dark:text-white tracking-tight font-display">
            System Health
          </h2>
          <p className="text-on-surface-variant dark:text-slate-400 mt-2 text-sm">
            Run the forecasting pipeline, monitor live training logs, and benchmark all model architectures.
          </p>
        </div>

        {/* ── Hero metric cards ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Active pipeline */}
          <div className="bg-surface-container-low dark:bg-slate-900 border border-surface-container dark:border-slate-800 rounded-xl p-6">
            <p className="text-sm font-medium text-on-surface-variant dark:text-slate-400 mb-1">Active Pipeline</p>
            <h2 className="text-xl font-extrabold text-primary dark:text-white font-display truncate">
              {analysis?.article ?? article}
            </h2>
            <div className="mt-4 flex items-center gap-2">
              <span className={cx(
                'h-2 w-2 rounded-full flex-shrink-0',
                running ? 'bg-secondary-container animate-pulse' : pipelineDone ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600',
              )} />
              <span className={cx(
                'text-xs font-mono font-medium',
                running ? 'text-secondary dark:text-secondary-fixed-dim'
                : pipelineDone ? 'text-green-600 dark:text-green-400'
                : 'text-slate-400 dark:text-slate-500',
              )}>
                {running ? 'MODEL TRAINING IN PROGRESS' : pipelineDone ? 'PIPELINE COMPLETE' : 'IDLE · READY'}
              </span>
            </div>
          </div>

          {/* Best model score (spans 2 cols) */}
          <div className="bg-surface-container-low dark:bg-slate-900 border border-surface-container dark:border-slate-800 rounded-xl p-6 md:col-span-2 flex justify-between items-center flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium text-on-surface-variant dark:text-slate-400 mb-1">Best Model R² Score</p>
              <h2 className="text-3xl font-extrabold text-primary dark:text-white font-mono">{healthScore}</h2>
              <p className="text-xs font-mono text-on-surface-variant dark:text-slate-400 mt-1">
                {bestRow?.Model ?? (loadError ? 'Run pipeline first' : 'No data yet')}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">MAPE</p>
                <p className="font-mono text-xl font-bold text-primary dark:text-white">
                  {bestRow?.['MAPE (%)'] != null ? `${fmtMetric(bestRow['MAPE (%)'])}%` : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">RMSE</p>
                <p className="font-mono text-xl font-bold text-primary dark:text-white">
                  {bestRow?.RMSE != null ? fmtMetric(bestRow.RMSE) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bento grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-6 mb-6">

          {/* Left: Pipeline config + sparkline */}
          <section className="col-span-12 lg:col-span-4 space-y-6">

            {/* Pipeline configuration */}
            <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl border border-surface-container dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-primary dark:text-white font-display">Pipeline Configuration</h3>
                <Settings2 size={16} className="text-on-surface-variant dark:text-slate-400" />
              </div>

              <div className="space-y-4">
                {/* Article search */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant dark:text-slate-400 mb-2 block tracking-widest">
                    Article
                  </label>
                  <div ref={dropRef} className="relative">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        value={articleQuery}
                        onChange={e => { setArticleQuery(e.target.value); setArticle(e.target.value.replace(/ /g, '_')); setFocusedIdx(-1) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (showDrop && suggestions.length) {
                              const t = focusedIdx >= 0 ? suggestions[focusedIdx] : suggestions[0]
                              if (t) selectArticle(t)
                            }
                          } else if (showDrop && suggestions.length) {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, suggestions.length - 1)) }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)) }
                            else if (e.key === 'Escape') { setShowDrop(false); setFocusedIdx(-1) }
                          }
                        }}
                        disabled={running}
                        placeholder="Search article…"
                        className={cx(
                          'w-full bg-surface-container-low dark:bg-slate-800',
                          'border-none rounded-lg text-sm font-mono py-3 pl-9 pr-3',
                          'text-primary dark:text-slate-200 placeholder:text-slate-400',
                          'focus:outline-none focus:ring-2 focus:ring-primary-container/25',
                          'transition-all disabled:opacity-50',
                        )}
                      />
                      {sugLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
                      )}
                    </div>

                    {/* Dropdown */}
                    {showDrop && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest dark:bg-slate-900 border border-surface-container-high dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                        {suggestions.map((r, i) => (
                          <button
                            key={i}
                            onMouseDown={e => { e.preventDefault(); selectArticle(r) }}
                            className={cx(
                              'w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors text-left border-b border-surface-container-low dark:border-slate-800 last:border-0',
                              i === focusedIdx
                                ? 'bg-surface-container dark:bg-slate-700'
                                : 'hover:bg-surface-container-low dark:hover:bg-slate-800',
                            )}
                          >
                            <span className="font-mono font-medium text-on-surface dark:text-slate-200 truncate">
                              {r.article.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-[10px] text-secondary dark:text-secondary-fixed-dim flex-shrink-0 ml-2">
                              {(r.total_views / 1e6).toFixed(1)}M
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* selected article chip */}
                  {article !== articleQuery && (
                    <p className="mt-1.5 text-[10px] font-mono text-on-surface-variant dark:text-slate-500">
                      Will run: <span className="text-secondary dark:text-secondary-fixed-dim">{article}</span>
                    </p>
                  )}
                </div>

                {/* Models info row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant dark:text-slate-400 mb-2 block tracking-widest">
                      Diff. Order (d)
                    </label>
                    <div className="bg-surface-container-low dark:bg-slate-800 rounded-lg p-3 text-sm font-mono font-bold text-primary dark:text-white">
                      {analysis?.d ?? '—'}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant dark:text-slate-400 mb-2 block tracking-widest">
                      Season Period
                    </label>
                    <div className="bg-surface-container-low dark:bg-slate-800 rounded-lg p-3 text-sm font-mono font-bold text-primary dark:text-white">
                      7 days
                    </div>
                  </div>
                </div>

                {/* Models */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant dark:text-slate-400 mb-2 block tracking-widest">
                    Forecasting Models
                  </label>
                  <div className="bg-surface-container-low dark:bg-slate-800 rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant dark:text-slate-300">
                    Linear · Holt-Winters · ARIMA · SARIMA
                  </div>
                </div>

                {/* Skip analysis toggle */}
                <label className={cx(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-colors',
                  'border-surface-container dark:border-slate-700 text-on-surface-variant dark:text-slate-400',
                  skipAnalysis && 'border-primary-container/30 bg-primary-container/5 text-primary-container dark:text-primary-fixed-dim',
                  running && 'opacity-50 cursor-default',
                )}>
                  <input
                    type="checkbox"
                    checked={skipAnalysis}
                    onChange={e => setSkipAnalysis(e.target.checked)}
                    disabled={running}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="font-mono text-xs">Skip analysis (faster)</span>
                </label>

                {/* Run / Stop button */}
                <div className="pt-2">
                  {!running ? (
                    <button
                      onClick={startPipeline}
                      className={cx(
                        'w-full bg-secondary dark:bg-secondary text-white font-bold py-3 rounded-xl',
                        'flex items-center justify-center gap-2 transition-all',
                        'hover:opacity-90 active:scale-95 shadow-lg shadow-secondary/20',
                      )}
                    >
                      <Play size={14} />
                      RUN PIPELINE
                    </button>
                  ) : (
                    <button
                      onClick={stopPipeline}
                      className="w-full bg-error text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-error/20"
                    >
                      <Square size={14} />
                      STOP
                    </button>
                  )}
                  {pipelineDone && (
                    <button
                      onClick={loadResults}
                      className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-surface-container dark:border-slate-700 text-on-surface-variant dark:text-slate-400 py-2.5 text-xs font-mono hover:bg-surface-container-low dark:hover:bg-slate-800 transition-colors"
                    >
                      <RefreshCw size={12} /> Reload Results
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* MAPE sparkline */}
            <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl border border-surface-container dark:border-slate-800 shadow-sm p-6 group overflow-hidden relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-primary dark:text-white font-display">Model Performance Delta</h3>
              </div>

              <div className="h-28 w-full flex items-end gap-1.5">
                {sparkBars ? sparkBars.map((b, i) => (
                  <div
                    key={i}
                    title={b.model}
                    className={cx(
                      'flex-1 rounded-t-lg transition-colors',
                      b.best ? 'bg-secondary-container' : 'bg-surface-container dark:bg-slate-700 group-hover:bg-primary-container/60',
                    )}
                    style={{ height: `${Math.max(b.pct, 8)}%` }}
                  />
                )) : (
                  // Placeholder bars
                  [50, 65, 75, 100, 80, 65, 50, 60].map((h, i) => (
                    <div
                      key={i}
                      className={cx(
                        'flex-1 rounded-t-lg',
                        i === 3 ? 'bg-secondary-container' : 'bg-surface-container dark:bg-slate-700 group-hover:bg-primary-container/60 transition-colors',
                      )}
                      style={{ height: `${h}%` }}
                    />
                  ))
                )}
              </div>

              <div className="mt-4 flex justify-between items-center">
                <span className="font-mono text-xs text-on-surface-variant dark:text-slate-400">
                  {sparkBars ? `Best MAPE: ${fmtMetric(bestRow?.['MAPE (%)'])}%` : 'MAPE by Model'}
                </span>
                <TrendingUp size={14} className="text-secondary" />
              </div>

              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />
            </div>
          </section>

          {/* Right: STL plot + terminal */}
          <section className="col-span-12 lg:col-span-8 space-y-6">

            {/* STL Decomposition */}
            <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl border border-surface-container dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-primary dark:text-white font-display">STL Decomposition Analysis</h3>
                  <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">
                    Trend, Seasonal, and Residual extraction from Wikipedia traffic data
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-surface-container-low dark:bg-slate-800 rounded-full text-[10px] font-bold text-primary dark:text-white uppercase tracking-wider">
                    {analysis ? 'CACHED' : 'REAL-TIME'}
                  </span>
                  <span className="px-3 py-1 bg-surface-container-low dark:bg-slate-800 rounded-full text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">
                    HISTORICAL
                  </span>
                </div>
              </div>

              {/* If plot available, show it; otherwise show SVG mockup */}
              {analysis ? (
                <div
                  className="cursor-zoom-in rounded-lg overflow-hidden"
                  onClick={() => setLightboxImg(getPlotUrl(`03_stl_decomposition_${effectiveTheme}.png`))}
                >
                  <img
                    src={getPlotUrl(`03_stl_decomposition_${effectiveTheme}.png`)}
                    alt="STL Decomposition"
                    className="w-full rounded-lg"
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  {[
                    { label: 'Trend',    color: 'text-primary dark:text-primary-fixed-dim',
                      svg: <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 80" preserveAspectRatio="none"><path d="M0,65 Q100,15 200,40 T400,15" fill="none" stroke="var(--chart-1)" strokeWidth="2"/></svg> },
                    { label: 'Seasonal', color: 'text-secondary dark:text-secondary-fixed-dim',
                      svg: <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 80" preserveAspectRatio="none"><path d="M0,40 L20,20 L40,60 L60,20 L80,60 L100,20 L120,60 L140,20 L160,60 L180,20 L200,60 L220,20 L240,60 L260,20 L280,60 L300,20 L320,60 L340,20 L360,60 L380,20 L400,60" fill="none" stroke="var(--chart-2)" strokeDasharray="4 2" strokeWidth="1.5"/></svg> },
                    { label: 'Residual', color: 'text-on-surface-variant dark:text-slate-400',
                      svg: null },
                  ].map(({ label, color, svg }) => (
                    <div key={label} className="h-20 w-full relative">
                      {label === 'Residual' && (
                        <div className="absolute inset-x-0 h-px bg-surface-container dark:bg-slate-700 top-1/2" />
                      )}
                      {svg}
                      {label === 'Residual' && (
                        <div className="flex justify-around items-end h-full px-4">
                          {[20, 55, 35, 70, 25, 45, 30, 55].map((h, i) => (
                            <div
                              key={i}
                              className={cx('w-1.5 rounded-full', i === 3 ? 'bg-error/50' : 'bg-surface-container-highest dark:bg-slate-600')}
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                      )}
                      <span className={cx('absolute top-0 right-0 text-[10px] font-bold uppercase tracking-widest', color)}>
                        {label}
                      </span>
                    </div>
                  ))}
                  <p className="text-center text-xs font-mono text-on-surface-variant dark:text-slate-500 pt-2">
                    Run the pipeline to generate the actual decomposition plot
                  </p>
                </div>
              )}
            </div>

            {/* Pipeline Monitor Terminal */}
            <div className="bg-tertiary-container rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-error/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-container/60" />
                </div>
                <span className="text-[10px] font-mono text-on-tertiary-container uppercase tracking-[0.2em] ml-2">
                  Pipeline Monitor — Live Logs
                </span>
                {running && (
                  <span className="ml-auto text-[10px] font-mono text-secondary-fixed animate-pulse">● LIVE</span>
                )}
              </div>

              <div
                ref={logRef}
                className="font-mono text-xs leading-relaxed text-on-tertiary-container p-5 h-52 overflow-y-auto"
              >
                {logLines.length === 0 && !running && !pipelineError && (
                  <>
                    <p className="opacity-40">[system] Pipeline — ready</p>
                    <p className="opacity-40">[system] Configure article above and press RUN PIPELINE</p>
                    <p className="opacity-20 mt-2">&gt; _</p>
                  </>
                )}
                {running && logLines.length === 0 && (
                  <span className="animate-pulse opacity-60">Starting pipeline…</span>
                )}
                {logLines.map((line, i) => {
                  const isStep  = line.startsWith('[') || line.startsWith('=')
                  const isSaved = line.toLowerCase().includes('saved')
                  const isError = line.toLowerCase().includes('error') || line === '— stopped by user —'
                  return (
                    <div key={i} className={cx(
                      isError ? 'text-red-400'
                      : isSaved ? 'text-emerald-400'
                      : isStep ? 'text-secondary-fixed'
                      : 'opacity-70',
                    )}>
                      {line}
                    </div>
                  )
                })}
                {running && <span className="opacity-60 animate-pulse">▌</span>}
                {pipelineDone && <div className="text-emerald-400 mt-1">✓ Pipeline complete — results updated</div>}
                {pipelineError && <div className="text-red-400 mt-1">✗ {pipelineError}</div>}
              </div>
            </div>
          </section>
        </div>

        {/* ── Model Performance Benchmarking (full width) ──────── */}
        <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl border border-surface-container dark:border-slate-800 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-surface-container dark:border-slate-800 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-primary dark:text-white font-display">Model Performance Benchmarking</h3>
              <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">
                All 4 models ranked by active metric — switch metric using the tabs below
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadResults}
                className="flex items-center gap-1.5 text-xs font-mono text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          {/* Metric tabs */}
          {comparison && comparison.length > 0 && (
            <div className="px-6 py-3 border-b border-surface-container dark:border-slate-800 flex flex-wrap gap-1.5">
              {availableMetrics.map(m => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cx(
                    'px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all',
                    metric === m
                      ? 'bg-primary-container text-white shadow-sm'
                      : 'bg-surface-container-low dark:bg-slate-800 text-on-surface-variant dark:text-slate-400 hover:bg-surface-container dark:hover:bg-slate-700',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {loadError ? (
            <div className="flex gap-4 items-start p-8">
              <AlertCircle className="text-error mt-0.5 shrink-0" size={18} />
              <div>
                <div className="font-bold text-primary dark:text-white mb-1">No precomputed results yet</div>
                <div className="font-mono text-xs text-on-surface-variant dark:text-slate-400 leading-relaxed">
                  Use the <strong>RUN PIPELINE</strong> button above to train the models and generate results.
                </div>
              </div>
            </div>
          ) : comparison && comparison.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low dark:bg-slate-800/50">
                  <tr>
                    {['Model Architecture', 'MAE', 'RMSE', 'MAPE (%)', 'R² Score', 'Status'].map(h => (
                      <th
                        key={h}
                        className={cx(
                          'px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400',
                          h === 'Status' ? 'text-right' : '',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container dark:divide-slate-800">
                  {sortedComparison.map((r, i) => {
                    const badge = statusBadge(i, r['MAPE (%)'])
                    return (
                      <tr key={i} className="hover:bg-surface-container-low/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-primary dark:text-white text-sm">
                          {i === 0 && <span className="text-secondary mr-1.5">★</span>}
                          {r.Model}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-on-surface-variant dark:text-slate-300">
                          {fmtMetric(r.MAE)}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-on-surface-variant dark:text-slate-300">
                          {fmtMetric(r.RMSE)}
                        </td>
                        <td className={cx(
                          'px-6 py-4 font-mono text-sm font-bold',
                          metric === 'MAPE (%)' ? 'text-secondary dark:text-secondary-fixed-dim' : 'text-on-surface-variant dark:text-slate-300',
                        )}>
                          {r['MAPE (%)'] != null ? `${fmtMetric(r['MAPE (%)'])}%` : '—'}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-on-surface-variant dark:text-slate-300">
                          {fmtMetric(r.R2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cx('px-2.5 py-1 rounded text-[10px] font-bold uppercase', badge.cls)}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center font-mono text-xs text-on-surface-variant dark:text-slate-400">
              {comparison === null ? 'Loading…' : 'Run the pipeline above to generate results'}
            </div>
          )}
        </div>

        {/* ── ACF / PACF ───────────────────────────────────────── */}
        <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl border border-surface-container dark:border-slate-800 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h3 className="font-bold text-primary dark:text-white font-display">Auto-Correlation (ACF / PACF)</h3>
            <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-secondary rounded-sm" />
                <span>Lag Signal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-surface-container dark:bg-slate-700 rounded-sm" />
                <span>Confidence Band</span>
              </div>
            </div>
          </div>

          {analysis ? (
            <div
              className="cursor-zoom-in rounded-lg overflow-hidden"
              onClick={() => setLightboxImg(getPlotUrl(`04_acf_pacf_${effectiveTheme}.png`))}
            >
              <img
                src={getPlotUrl(`04_acf_pacf_${effectiveTheme}.png`)}
                alt="ACF / PACF"
                className="w-full rounded-lg"
              />
            </div>
          ) : (
            <>
              {/* Confidence band + bars */}
              <div className="relative h-44 w-full">
                <div className="absolute inset-x-0 top-1/2 h-px bg-surface-container dark:bg-slate-700" />
                <div className="absolute inset-x-0 h-16 bg-surface-container-low/40 dark:bg-slate-800/40 top-1/2 -translate-y-1/2 rounded" />
                <div className="flex items-center justify-around h-full z-10 relative">
                  {[66, 50, 33, 20, 16, 5, 50, 25, 16, 10].map((h, i) => (
                    <div key={i} className="h-full flex flex-col justify-end items-center pb-6">
                      <div
                        className={cx('w-2 rounded-full', i === 0 || i === 6 ? 'bg-secondary' : 'bg-primary dark:bg-primary-fixed-dim')}
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[9px] font-mono mt-2 text-on-surface-variant dark:text-slate-400">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-center text-xs font-mono text-on-surface-variant dark:text-slate-500 mt-3">
                Run the pipeline to generate the actual ACF/PACF plot
              </p>
            </>
          )}
        </div>

        {/* ── Stationarity Analysis ────────────────────────────── */}
        {analysis && (
          <SectionCard title="Stationarity Analysis" subtitle="ADF and KPSS test results from the last analysis run." className="mb-6">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {[
                {
                  label: 'ADF Test',
                  value: analysis.adf?.Stationary ? 'Stationary' : 'Non-Stationary',
                  badge: analysis.adf?.Stationary,
                  sub: `p-value: ${analysis.adf?.['p-value'] ?? '—'}`,
                  sub2: `stat: ${analysis.adf?.['ADF Stat'] ?? '—'}`,
                },
                {
                  label: 'KPSS Test',
                  value: analysis.kpss?.Stationary ? 'Stationary' : 'Non-Stationary',
                  badge: analysis.kpss?.Stationary,
                  sub: `p-value: ${analysis.kpss?.['p-value'] ?? '—'}`,
                  sub2: `stat: ${analysis.kpss?.['KPSS Stat'] ?? '—'}`,
                },
                {
                  label: 'Differencing Order',
                  bigValue: `d = ${analysis.d ?? '—'}`,
                  sub: 'applied to reach stationarity',
                },
                {
                  label: 'Trend Strength',
                  bigValue: typeof analysis.trend_strength === 'number'
                    ? analysis.trend_strength.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : '—',
                  sub: 'σ of STL trend component',
                },
                {
                  label: 'Article Analyzed',
                  bigValue: null,
                  titleValue: analysis.article ?? '—',
                  sub: analysis.project,
                },
              ].map((item, i) => (
                <div key={i} className="bg-surface-container-low dark:bg-slate-800 rounded-xl p-4">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant dark:text-slate-400 mb-2">
                    {item.label}
                  </p>
                  {item.bigValue !== undefined && item.bigValue !== null && (
                    <p className="font-mono font-extrabold text-2xl text-primary dark:text-white leading-none mb-1">
                      {item.bigValue}
                    </p>
                  )}
                  {item.titleValue && (
                    <p className="font-bold text-sm text-primary dark:text-white break-all mb-1">{item.titleValue}</p>
                  )}
                  {item.badge !== undefined && (
                    <span className={cx(
                      'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] ring-1 ring-inset mb-2',
                      item.badge
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20'
                        : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-500',
                    )}>
                      {item.badge ? 'Stationary' : 'Non-Stationary'}
                    </span>
                  )}
                  {item.sub  && <p className="font-mono text-[11px] text-on-surface-variant dark:text-slate-400">{item.sub}</p>}
                  {item.sub2 && <p className="font-mono text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">{item.sub2}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Forecast vs Actual ───────────────────────────────── */}
        {forecast?.actual && (
          <SectionCard title="Forecast vs Actual" subtitle="Held-out test performance for the currently saved article forecast." className="mb-6">
            {bestRow && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  ['Best Model', bestRow.Model],
                  ['MAE',        fmtMetric(bestRow.MAE)],
                  ['RMSE',       fmtMetric(bestRow.RMSE)],
                  ['SMAPE',      bestRow['SMAPE (%)'] != null ? `${fmtMetric(bestRow['SMAPE (%)'])}%` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-container-low dark:bg-slate-800 px-4 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant dark:text-slate-400 mb-1.5">{label}</p>
                    <p className={cx(
                      'font-bold text-primary dark:text-white font-mono',
                      label === 'Best Model' ? 'text-base' : 'text-xl',
                    )}>{value}</p>
                  </div>
                ))}
              </div>
            )}
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={forecast.actual.map((v, i) => ({ date: forecast.test_dates?.[i] ?? i, actual: v, forecast: forecast.forecast?.[i] }))}>
                <XAxis dataKey="date" interval="preserveStartEnd" />
                <YAxis />
                <Tooltip />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                <Line type="monotone" dataKey="actual"   stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Actual" />
                <Line type="monotone" dataKey="forecast" stroke="var(--chart-1)" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Forecast" />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* ── Future Forecast ──────────────────────────────────── */}
        {futureCombined && (
          <SectionCard
            title="Future Forecast"
            subtitle={`${forecast.future.length}-day ahead predictions from the best model (${forecast.best_model ?? ''}).`}
            className="mb-6"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={futureCombined}>
                <XAxis dataKey="date" interval="preserveStartEnd" />
                <YAxis />
                <Tooltip />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                <Line type="monotone" dataKey="actual"        stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Actual (test)"     connectNulls={false} />
                <Line type="monotone" dataKey="modelForecast" stroke="var(--chart-1)" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Model Forecast"  connectNulls={false} />
                <Line type="monotone" dataKey="future"        stroke="var(--chart-3)" strokeWidth={2} dot={false} strokeDasharray="3 3" name="Future Pred."    connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* ── Analysis Plots ───────────────────────────────────── */}
        {analysis && (
          <SectionCard title="Analysis Plots" subtitle="Generated from the time series analysis phase. Click any image to expand." className="mb-6">
            <PlotGrid plots={ANALYSIS_PLOTS} theme={effectiveTheme} onClickImg={setLightboxImg} />
          </SectionCard>
        )}

        {/* ── Forecasting Plots ────────────────────────────────── */}
        {forecast && (
          <SectionCard title="Forecasting Plots" subtitle="Individual model forecasts vs actuals. Click any image to expand." className="mb-6">
            <PlotGrid plots={FORECAST_PLOTS} theme={effectiveTheme} onClickImg={setLightboxImg} />
          </SectionCard>
        )}

        {/* ── Lightbox ─────────────────────────────────────────── */}
        {lightboxImg && (
          <div
            onClick={() => setLightboxImg(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-6 cursor-zoom-out"
          >
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
            <img
              src={lightboxImg}
              alt="Plot"
              onClick={e => e.stopPropagation()}
              className="max-w-[95vw] max-h-[90vh] rounded-lg cursor-default"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
            />
          </div>
        )}

      </div>
    </div>
  )
}
