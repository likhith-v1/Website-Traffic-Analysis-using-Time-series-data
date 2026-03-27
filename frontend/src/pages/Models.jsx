import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from 'recharts'
import { getModelComparison, getForecast, streamPipeline, getAnalysisResults, getPlotUrl } from '../api/client'
import { GitCompare, AlertCircle, Play, Square, RefreshCw, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx } from '../lib/utils'

const ALL_METRICS   = ['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'R2', 'Bias']
const LOWER_IS_BETTER = new Set(['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'Bias'])
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const ANALYSIS_PLOTS = [
  { base: '01_time_plot',          label: 'Time Plot' },
  { base: '02_moving_averages',    label: 'Moving Averages' },
  { base: '03_stl_decomposition',  label: 'STL Decomposition' },
  { base: '04_acf_pacf',           label: 'ACF / PACF' },
  { base: '05_seasonal_subseries', label: 'Seasonal Subseries' },
  { base: '06_lag_scatter',        label: 'Lag Scatter' },
]

const FORECAST_PLOTS = [
  { base: '07_linear_trend', label: 'Linear Trend' },
  { base: '08_holt_winters', label: 'Holt-Winters' },
  { base: '09_arima',        label: 'ARIMA' },
  { base: '10_sarima',       label: 'SARIMA' },
]

const fmtMetric = v =>
  v === undefined || v === null ? '—'
  : typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  : v

function presentMetrics(rows) {
  if (!rows?.length) return ALL_METRICS
  return ALL_METRICS.filter(m => rows.some(r => r[m] !== undefined && r[m] !== null))
}

function sortRows(rows, metric) {
  const factor = LOWER_IS_BETTER.has(metric) ? 1 : -1
  return [...rows].sort((a, b) => ((a[metric] ?? Infinity) - (b[metric] ?? Infinity)) * factor)
}

function Badge({ ok, trueLabel = 'Stationary', falseLabel = 'Non-Stationary' }) {
  return (
    <span className={cx(
      'inline-flex items-center rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-inset',
      ok
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20'
        : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20',
    )}>
      {ok ? trueLabel : falseLabel}
    </span>
  )
}

function PlotGrid({ plots, theme, onClickImg }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {plots.map(({ base, label }) => {
        const file = `${base}_${theme}.png`
        return (
          <div
            key={base}
            onClick={() => onClickImg(getPlotUrl(file))}
            className={cx(
              'overflow-hidden rounded-lg border border-gray-200 bg-white cursor-zoom-in',
              'transition-[border-color,transform] duration-150',
              'hover:border-gray-300 hover:-translate-y-0.5',
              'dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700',
            )}
          >
            <img
              src={getPlotUrl(file)}
              alt={label}
              className="w-full block"
              style={{ aspectRatio: '16/7', objectFit: 'cover' }}
            />
            <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

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

  const [article,       setArticle]       = useState('Main_Page')
  const [skipAnalysis,  setSkipAnalysis]  = useState(false)
  const [running,       setRunning]       = useState(false)
  const [logLines,      setLogLines]      = useState([])
  const [pipelineError, setPipelineError] = useState('')
  const [pipelineDone,  setPipelineDone]  = useState(false)
  const esRef  = useRef(null)
  const logRef = useRef(null)

  const loadResults = () => {
    setLoadError('')
    getModelComparison()
      .then(d => {
        const rows = Array.isArray(d) ? d : []
        setComparison(rows)
        if (rows.length > 0) setMetric(rows[0]['MAPE (%)'] !== undefined ? 'MAPE (%)' : presentMetrics(rows)[0])
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

  const startPipeline = () => {
    if (running) return
    setRunning(true); setLogLines([]); setPipelineError(''); setPipelineDone(false)
    esRef.current = streamPipeline({
      article, skipAnalysis, d: 1,
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

  const availableMetrics = presentMetrics(comparison)
  const sortedComparison = comparison ? sortRows(comparison, metric) : []
  const bestRow          = sortedComparison[0]

  const futureCombined = (() => {
    if (!forecast?.future?.length || !forecast?.test_dates?.length) return null
    const lastDate = new Date(forecast.test_dates[forecast.test_dates.length - 1])
    const testData = forecast.actual.map((v, i) => ({
      date: forecast.test_dates[i], actual: v, modelForecast: forecast.forecast?.[i],
    }))
    const futureData = forecast.future.map((v, i) => {
      const d = new Date(lastDate)
      d.setDate(d.getDate() + i + 1)
      return { date: d.toISOString().slice(0, 10), future: v }
    })
    return [...testData, ...futureData]
  })()

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        eyebrow="Forecasting"
        title="Model Comparison"
        subtitle="Run the training pipeline directly from the dashboard, watch the live log, then inspect model metrics and forecast charts."
        actions={<GitCompare size={20} className="text-blue-600 dark:text-blue-400" />}
      />

      {/* ── Pipeline runner ── */}
      <SurfaceCard accent="highlight">
        <div className="flex items-center gap-2 mb-5">
          <Play size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="font-display text-[15px] font-semibold text-gray-900 dark:text-gray-50">
            Run Pipeline
          </span>
        </div>

        <div className="flex flex-wrap gap-3 items-end mb-4">
          {/* Article input */}
          <div className="flex-1" style={{ minWidth: 200 }}>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1.5">
              Article
            </label>
            <input
              value={article}
              onChange={e => setArticle(e.target.value)}
              disabled={running}
              placeholder="e.g. Main_Page"
              className={cx(
                'w-full rounded-md border border-gray-300 bg-white px-3 py-2',
                'font-mono text-xs text-gray-900 placeholder-gray-400',
                'outline-none transition disabled:opacity-50',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
                'dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder-gray-500',
                'dark:focus:border-blue-700 dark:focus:ring-blue-700/30',
              )}
            />
          </div>

          {/* Skip analysis toggle */}
          <label className={cx(
            'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer font-mono text-xs transition-colors',
            'border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400',
            skipAnalysis && 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400',
            running && 'opacity-50 cursor-default',
          )}>
            <input
              type="checkbox"
              checked={skipAnalysis}
              onChange={e => setSkipAnalysis(e.target.checked)}
              disabled={running}
              className="accent-blue-500"
            />
            Skip analysis (faster)
          </label>

          {/* Run / Stop */}
          {!running ? (
            <button
              onClick={startPipeline}
              className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 font-display text-sm font-semibold text-white shadow-sm hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              <Play size={13} /> Run Pipeline
            </button>
          ) : (
            <button
              onClick={stopPipeline}
              className="inline-flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 font-display text-sm font-semibold text-white shadow-sm hover:bg-red-600 transition-colors whitespace-nowrap"
            >
              <Square size={13} /> Stop
            </button>
          )}

          {/* Reload */}
          {pipelineDone && (
            <button
              onClick={loadResults}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-transparent px-4 py-2 font-mono text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors dark:border-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200"
            >
              <RefreshCw size={12} /> Reload charts
            </button>
          )}
        </div>

        {/* Live log */}
        {(logLines.length > 0 || running || pipelineError) && (
          <div
            ref={logRef}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-[280px] overflow-y-auto font-mono text-xs leading-relaxed dark:border-gray-800 dark:bg-gray-900/50"
          >
            {running && logLines.length === 0 && (
              <span className="text-gray-400 animate-pulse-accent">Starting pipeline…</span>
            )}
            {logLines.map((line, i) => {
              const isStep  = line.startsWith('[') || line.startsWith('=')
              const isSaved = line.toLowerCase().includes('saved')
              const isError = line.toLowerCase().includes('error') || line === '— stopped by user —'
              return (
                <div key={i} className={cx(
                  isError ? 'text-red-500' : isSaved ? 'text-emerald-600 dark:text-emerald-400' : isStep ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300',
                )}>
                  {line}
                </div>
              )
            })}
            {running && <span className="text-gray-400 animate-pulse-accent">▌</span>}
            {pipelineDone && (
              <div className="text-emerald-600 dark:text-emerald-400 mt-1">
                ✓ Pipeline complete — charts updated below
              </div>
            )}
            {pipelineError && (
              <div className="text-red-500 mt-1">✗ {pipelineError}</div>
            )}
          </div>
        )}
      </SurfaceCard>

      {/* ── Metric selector ── */}
      {comparison && comparison.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 mb-5 dark:border-gray-800 dark:bg-gray-950">
          {availableMetrics.map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cx(
                'rounded-md border px-3 py-1.5 font-mono text-xs transition-colors',
                metric === m
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {loadError ? (
        <div className="flex gap-4 items-start rounded-lg border border-gray-200 bg-gray-50 px-6 py-8 dark:border-gray-800 dark:bg-gray-900/50">
          <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
          <div>
            <div className="font-display font-semibold text-gray-900 dark:text-gray-50 mb-1">
              No precomputed results yet
            </div>
            <div className="font-mono text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Use the <strong className="text-blue-600 dark:text-blue-400">Run Pipeline</strong> button above to train the models and generate results.
            </div>
          </div>
        </div>
      ) : comparison && comparison.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SurfaceCard title={`${metric} by Model`} subtitle="Models are re-sorted whenever you change the active metric.">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sortedComparison}>
                <XAxis dataKey="Model" />
                <YAxis />
                <Tooltip formatter={v => [fmtMetric(v), metric]} />
                <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                  {sortedComparison.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>

          <SurfaceCard title="Full Metrics Table" subtitle="A wider scorecard with both error and fit quality measures.">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 480 }}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    {['Model', ...availableMetrics].map(h => (
                      <th key={h} className={cx(
                        'px-4 py-2.5 font-mono text-[11px] text-gray-500 dark:text-gray-400',
                        'border-b border-gray-200 dark:border-gray-800 whitespace-nowrap',
                        h === 'Model' ? 'text-left' : 'text-right',
                      )}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedComparison.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-body text-sm text-gray-900 dark:text-gray-50">
                        {i === 0 && <span className="text-blue-500 mr-1.5">★</span>}
                        {r.Model}
                      </td>
                      {availableMetrics.map(m => (
                        <td key={m} className={cx(
                          'px-4 py-3 text-right font-mono text-xs',
                          m === metric ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300',
                        )}>
                          {fmtMetric(r[m])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      ) : !running && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-16 text-center font-mono text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900/50">
          {comparison === null ? 'Loading…' : 'Use Run Pipeline above to generate results'}
        </div>
      )}

      {/* ── Forecast vs Actual ── */}
      {forecast?.actual && (
        <SurfaceCard title="Forecast vs Actual" subtitle="Held-out test performance for the currently saved article forecast.">
          {bestRow && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                ['Best Model', bestRow.Model],
                ['MAE',        fmtMetric(bestRow.MAE)],
                ['RMSE',       fmtMetric(bestRow.RMSE)],
                ['SMAPE',      bestRow['SMAPE (%)'] !== undefined ? `${fmtMetric(bestRow['SMAPE (%)'])}%` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-blue-200 bg-blue-50/30 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-500/5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1.5">{label}</div>
                  <div className={cx(
                    'font-display font-bold text-blue-600 dark:text-blue-400',
                    label === 'Best Model' ? 'text-base' : 'text-xl',
                  )}>{value}</div>
                </div>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecast.actual.map((v, i) => ({ i, actual: v, forecast: forecast.forecast?.[i] }))}>
              <XAxis dataKey="i" />
              <YAxis />
              <Tooltip />
              <Legend wrapperStyle={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual"   stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="var(--chart-1)" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </SurfaceCard>
      )}

      {/* ── Future Forecast ── */}
      {futureCombined && (
        <SurfaceCard
          title="Future Forecast"
          subtitle={`${forecast.future.length}-day ahead predictions from the best model (${forecast.best_model ?? ''}).`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={futureCombined}>
              <XAxis dataKey="date" interval="preserveStartEnd" />
              <YAxis />
              <Tooltip />
              <Legend wrapperStyle={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual"        stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Actual (test)" connectNulls={false} />
              <Line type="monotone" dataKey="modelForecast" stroke="var(--chart-1)" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Model Forecast" connectNulls={false} />
              <Line type="monotone" dataKey="future"        stroke="var(--chart-3)" strokeWidth={2} dot={false} strokeDasharray="3 3" name="Future Prediction" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </SurfaceCard>
      )}

      {/* ── Stationarity Analysis ── */}
      {analysis && (
        <SurfaceCard title="Stationarity Analysis" subtitle="ADF and KPSS test results from the last analysis run.">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {/* ADF */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">ADF Test</div>
              <div className="mb-2"><Badge ok={analysis.adf?.Stationary} /></div>
              <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                p-value: <span className="text-gray-900 dark:text-gray-50">{analysis.adf?.['p-value'] ?? '—'}</span>
              </div>
              <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                stat: <span className="text-gray-900 dark:text-gray-50">{analysis.adf?.['ADF Stat'] ?? '—'}</span>
              </div>
            </div>

            {/* KPSS */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">KPSS Test</div>
              <div className="mb-2"><Badge ok={analysis.kpss?.Stationary} /></div>
              <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                p-value: <span className="text-gray-900 dark:text-gray-50">{analysis.kpss?.['p-value'] ?? '—'}</span>
              </div>
              <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                stat: <span className="text-gray-900 dark:text-gray-50">{analysis.kpss?.['KPSS Stat'] ?? '—'}</span>
              </div>
            </div>

            {/* Differencing order */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">Differencing Order</div>
              <div className="font-display font-bold text-[32px] leading-none text-blue-600 dark:text-blue-400">
                d = {analysis.d ?? '—'}
              </div>
              <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">applied to reach stationarity</div>
            </div>

            {/* Trend strength */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">Trend Strength</div>
              <div className="font-display font-bold text-[22px] leading-none text-cyan-600 dark:text-cyan-400">
                {typeof analysis.trend_strength === 'number'
                  ? analysis.trend_strength.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '—'}
              </div>
              <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">σ of STL trend component</div>
            </div>

            {/* Article */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">Article Analyzed</div>
              <div className="font-display font-semibold text-[15px] text-gray-900 dark:text-gray-50 break-all">
                {analysis.article ?? '—'}
              </div>
              <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1">{analysis.project}</div>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* ── Analysis Plots ── */}
      {analysis && (
        <SurfaceCard title="Analysis Plots" subtitle="Generated plots from the time series analysis phase. Click any image to expand.">
          <PlotGrid plots={ANALYSIS_PLOTS} theme={effectiveTheme} onClickImg={setLightboxImg} />
        </SurfaceCard>
      )}

      {/* ── Forecasting Plots ── */}
      {forecast && (
        <SurfaceCard title="Forecasting Plots" subtitle="Individual model forecasts vs actuals. Click any image to expand.">
          <PlotGrid plots={FORECAST_PLOTS} theme={effectiveTheme} onClickImg={setLightboxImg} />
        </SurfaceCard>
      )}

      {/* ── Lightbox ── */}
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
  )
}
