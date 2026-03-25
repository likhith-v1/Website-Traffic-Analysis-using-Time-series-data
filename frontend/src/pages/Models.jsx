import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from 'recharts'
import { getModelComparison, getForecast, streamPipeline, getAnalysisResults, getPlotUrl } from '../api/client'
import { GitCompare, AlertCircle, Play, Square, RefreshCw, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'

const ALL_METRICS   = ['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'R2', 'Bias']
const LOWER_IS_BETTER = new Set(['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'Bias'])
const COLORS = ['var(--chart-palette-1)', 'var(--chart-palette-2)', 'var(--chart-palette-3)', 'var(--chart-palette-4)']

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

const tooltipStyle = {
  background: 'var(--tooltip-bg)', border: '1px solid var(--border)',
  color: 'var(--tooltip-text)', borderRadius: 8,
  fontFamily: 'var(--font-mono)', fontSize: 11,
}

function Badge({ ok, trueLabel = 'Stationary', falseLabel = 'Non-Stationary' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px', borderRadius: 999,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
      background: ok ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
      color: ok ? 'var(--accent3)' : '#f59e0b',
      border: `1px solid ${ok ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}`,
    }}>
      {ok ? trueLabel : falseLabel}
    </span>
  )
}

function PlotGrid({ plots, theme, onClickImg }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16,
    }}>
      {plots.map(({ base, label }) => {
        const file = `${base}_${theme}.png`
        return (
        <div
          key={base}
          onClick={() => onClickImg(getPlotUrl(file))}
          style={{
            borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            cursor: 'zoom-in',
            transition: 'border-color 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <img
            src={getPlotUrl(file)}
            alt={label}
            style={{ width: '100%', display: 'block', aspectRatio: '16/7', objectFit: 'cover' }}
          />
          <div style={{
            padding: '8px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--muted)', letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>{label}</div>
        </div>
        )
      })}
    </div>
  )
}

export default function Models() {
  const [comparison,    setComparison]    = useState(null)
  const [forecast,      setForecast]      = useState(null)
  const [analysis,      setAnalysis]      = useState(null)
  const [metric,        setMetric]        = useState('MAPE (%)')
  const [loadError,     setLoadError]     = useState('')
  const [lightboxImg,   setLightboxImg]   = useState(null)
  const [effectiveTheme, setEffectiveTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  )

  // Pipeline runner state
  const [article,       setArticle]       = useState('Main_Page')
  const [skipAnalysis,  setSkipAnalysis]  = useState(false)
  const [running,       setRunning]       = useState(false)
  const [logLines,      setLogLines]      = useState([])
  const [pipelineError, setPipelineError] = useState('')
  const [pipelineDone,  setPipelineDone]  = useState(false)
  const esRef   = useRef(null)
  const logRef  = useRef(null)

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

  // Track active theme for plot image switching
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setEffectiveTheme(document.documentElement.dataset.theme || 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  // Close lightbox on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setLightboxImg(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startPipeline = () => {
    if (running) return
    setRunning(true)
    setLogLines([])
    setPipelineError('')
    setPipelineDone(false)

    esRef.current = streamPipeline({
      article,
      skipAnalysis,
      d: 1,
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

  // Compute future dates from last test date
  const futureCombined = (() => {
    if (!forecast?.future?.length || !forecast?.test_dates?.length) return null
    const lastDate = new Date(forecast.test_dates[forecast.test_dates.length - 1])
    const testData = forecast.actual.map((v, i) => ({
      date: forecast.test_dates[i],
      actual: v,
      modelForecast: forecast.forecast?.[i],
    }))
    const futureData = forecast.future.map((v, i) => {
      const d = new Date(lastDate)
      d.setDate(d.getDate() + i + 1)
      return { date: d.toISOString().slice(0, 10), future: v }
    })
    return [...testData, ...futureData]
  })()

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Forecasting"
        title="Model Comparison"
        subtitle="Run the training pipeline directly from the dashboard, watch the live log, then inspect model metrics and forecast charts."
        actions={<GitCompare size={22} color="var(--accent)" />}
      />

      {/* ── Pipeline runner ── */}
      <SurfaceCard accent="highlight">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Play size={15} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
            Run Pipeline
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          {/* Article input */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Article
            </label>
            <input
              value={article}
              onChange={e => setArticle(e.target.value)}
              disabled={running}
              placeholder="e.g. Main_Page"
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)',
                fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                opacity: running ? 0.5 : 1,
              }}
            />
          </div>

          {/* Skip analysis toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: running ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
            padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8,
            background: skipAnalysis ? 'var(--accent-soft)' : 'transparent',
            opacity: running ? 0.5 : 1,
          }}>
            <input
              type="checkbox"
              checked={skipAnalysis}
              onChange={e => setSkipAnalysis(e.target.checked)}
              disabled={running}
              style={{ accentColor: 'var(--accent)' }}
            />
            Skip analysis (faster)
          </label>

          {/* Run / Stop button */}
          {!running ? (
            <button onClick={startPipeline} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: 'var(--accent)', color: '#0f172a',
              border: 'none', borderRadius: 8,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Play size={14} /> Run Pipeline
            </button>
          ) : (
            <button onClick={stopPipeline} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: 'var(--accent3)', color: '#0f172a',
              border: 'none', borderRadius: 8,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Square size={14} /> Stop
            </button>
          )}

          {/* Reload charts */}
          {pipelineDone && (
            <button onClick={loadResults} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', background: 'transparent', color: 'var(--accent2)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
            }}>
              <RefreshCw size={13} /> Reload charts
            </button>
          )}
        </div>

        {/* Live log */}
        {(logLines.length > 0 || running || pipelineError) && (
          <div
            ref={logRef}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 16px', maxHeight: 280, overflowY: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
              color: 'var(--text)',
            }}
          >
            {running && logLines.length === 0 && (
              <span style={{ color: 'var(--muted)' }} className="animate-pulse-accent">
                Starting pipeline…
              </span>
            )}
            {logLines.map((line, i) => {
              const isStep  = line.startsWith('[') || line.startsWith('=')
              const isSaved = line.toLowerCase().includes('saved')
              const isError = line.toLowerCase().includes('error') || line === '— stopped by user —'
              const color   = isError ? 'var(--accent2)' : isSaved ? 'var(--accent3)' : isStep ? 'var(--accent)' : 'var(--text)'
              return <div key={i} style={{ color }}>{line}</div>
            })}
            {running && (
              <span style={{ color: 'var(--muted)' }} className="animate-pulse-accent">▌</span>
            )}
            {pipelineDone && (
              <div style={{ color: 'var(--accent3)', marginTop: 4 }}>
                ✓ Pipeline complete — charts updated below
              </div>
            )}
            {pipelineError && (
              <div style={{ color: 'var(--accent2)', marginTop: 4 }}>
                ✗ {pipelineError}
              </div>
            )}
          </div>
        )}
      </SurfaceCard>

      {/* ── Metric selector ── */}
      {comparison && comparison.length > 0 && (
        <div className="toolbar-card">
          {availableMetrics.map(m => (
            <button key={m} onClick={() => setMetric(m)} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid',
              borderColor: metric === m ? 'var(--accent)' : 'var(--border)',
              background:  metric === m ? 'var(--accent-soft)' : 'transparent',
              color:       metric === m ? 'var(--accent)' : 'var(--muted)',
              fontFamily:  'var(--font-mono)', fontSize: 12, cursor: 'pointer',
            }}>{m}</button>
          ))}
        </div>
      )}

      {/* ── Results or empty state ── */}
      {loadError ? (
        <div className="empty-state" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: 'left' }}>
          <AlertCircle color="var(--accent2)" size={20} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 8 }}>
              No precomputed results yet
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              Use the <strong style={{ color: 'var(--accent)' }}>Run Pipeline</strong> button above to train the models and generate results.
            </div>
          </div>
        </div>
      ) : comparison && comparison.length > 0 ? (
        <div className="two-column-grid">
          <SurfaceCard title={`${metric} by Model`} subtitle="Models are re-sorted whenever you change the active metric.">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sortedComparison}>
                <XAxis dataKey="Model" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} />
                <Tooltip formatter={v => [fmtMetric(v), metric]} contentStyle={tooltipStyle} />
                <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                  {sortedComparison.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>

          <SurfaceCard title="Full Metrics Table" subtitle="A wider scorecard with both error and fit quality measures.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: 'var(--accent-soft)' }}>
                    {['Model', ...availableMetrics].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: h === 'Model' ? 'left' : 'right',
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: 'var(--muted)', borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedComparison.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-soft)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-body)', fontSize: 14 }}>
                        {i === 0 && <span style={{ color: 'var(--accent)', marginRight: 6 }}>★</span>}
                        {r.Model}
                      </td>
                      {availableMetrics.map(m => (
                        <td key={m} style={{
                          padding: '12px 16px', textAlign: 'right',
                          fontFamily: 'var(--font-mono)', fontSize: 13,
                          color: m === metric ? 'var(--accent)' : 'var(--text)',
                        }}>{fmtMetric(r[m])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      ) : !running && (
        <div className="empty-state">
          {comparison === null ? 'Loading…' : 'Use Run Pipeline above to generate results'}
        </div>
      )}

      {/* ── Forecast vs Actual chart ── */}
      {forecast?.actual && (
        <SurfaceCard title="Forecast vs Actual" subtitle="Held-out test performance for the currently saved article forecast.">
          {bestRow && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                ['Best Model', bestRow.Model],
                ['MAE',        fmtMetric(bestRow.MAE)],
                ['RMSE',       fmtMetric(bestRow.RMSE)],
                ['SMAPE',      bestRow['SMAPE (%)'] !== undefined ? `${fmtMetric(bestRow['SMAPE (%)'])}%` : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: 'var(--accent-soft)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700,
                    fontSize: label === 'Best Model' ? 16 : 20, color: 'var(--accent)',
                  }}>{value}</div>
                </div>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecast.actual.map((v, i) => ({ i, actual: v, forecast: forecast.forecast?.[i] }))}>
              <XAxis dataKey="i" tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual"   stroke="var(--chart-palette-2)" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="var(--chart-palette-1)" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </SurfaceCard>
      )}

      {/* ── Future Forecast chart ── */}
      {futureCombined && (
        <SurfaceCard
          title="Future Forecast"
          subtitle={`${forecast.future.length}-day ahead predictions from the best model (${forecast.best_model ?? ''}).`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={futureCombined}>
              <XAxis dataKey="date" tick={{ fill: 'var(--chart-tick)', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual"        stroke="var(--chart-palette-2)" strokeWidth={2} dot={false} name="Actual (test)" connectNulls={false} />
              <Line type="monotone" dataKey="modelForecast" stroke="var(--chart-palette-1)" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Model Forecast" connectNulls={false} />
              <Line type="monotone" dataKey="future"        stroke="var(--chart-palette-3)" strokeWidth={2} dot={false} strokeDasharray="3 3" name="Future Prediction" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </SurfaceCard>
      )}

      {/* ── Stationarity / Analysis Results ── */}
      {analysis && (
        <SurfaceCard title="Stationarity Analysis" subtitle="ADF and KPSS test results from the last analysis run.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {/* ADF */}
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                ADF Test
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Badge ok={analysis.adf?.Stationary} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                p-value: <span style={{ color: 'var(--text)' }}>{analysis.adf?.['p-value'] ?? '—'}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                stat: <span style={{ color: 'var(--text)' }}>{analysis.adf?.['ADF Stat'] ?? '—'}</span>
              </div>
            </div>

            {/* KPSS */}
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                KPSS Test
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Badge ok={analysis.kpss?.Stationary} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                p-value: <span style={{ color: 'var(--text)' }}>{analysis.kpss?.['p-value'] ?? '—'}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                stat: <span style={{ color: 'var(--text)' }}>{analysis.kpss?.['KPSS Stat'] ?? '—'}</span>
              </div>
            </div>

            {/* Differencing order */}
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                Differencing Order
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, color: 'var(--accent)', lineHeight: 1 }}>
                d = {analysis.d ?? '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                applied to reach stationarity
              </div>
            </div>

            {/* Trend strength */}
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                Trend Strength
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--accent2)', lineHeight: 1 }}>
                {typeof analysis.trend_strength === 'number'
                  ? analysis.trend_strength.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                σ of STL trend component
              </div>
            </div>

            {/* Article */}
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', gridColumn: 'span 1' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                Article Analyzed
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', wordBreak: 'break-all' }}>
                {analysis.article ?? '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                {analysis.project}
              </div>
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
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%', width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={16} />
          </button>
          <img
            src={lightboxImg}
            alt="Plot"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '95vw', maxHeight: '90vh',
              borderRadius: 10, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </div>
  )
}
