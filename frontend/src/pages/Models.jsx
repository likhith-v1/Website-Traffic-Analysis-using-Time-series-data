import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from 'recharts'
import { getModelComparison, getForecast, streamPipeline } from '../api/client'
import { GitCompare, AlertCircle, Play, Square, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'

const ALL_METRICS   = ['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'R2', 'Bias']
const LOWER_IS_BETTER = new Set(['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'Bias'])
const COLORS = ['var(--chart-palette-1)', 'var(--chart-palette-2)', 'var(--chart-palette-3)', 'var(--chart-palette-4)']

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

export default function Models() {
  const [comparison,   setComparison]   = useState(null)
  const [forecast,     setForecast]     = useState(null)
  const [metric,       setMetric]       = useState('MAPE (%)')
  const [loadError,    setLoadError]    = useState('')

  // Pipeline runner state
  const [article,      setArticle]      = useState('Main_Page')
  const [skipAnalysis, setSkipAnalysis] = useState(false)
  const [running,      setRunning]      = useState(false)
  const [logLines,     setLogLines]     = useState([])
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
  }

  useEffect(() => { loadResults() }, []) // eslint-disable-line

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

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
              const isStep    = line.startsWith('[') || line.startsWith('=')
              const isSaved   = line.toLowerCase().includes('saved')
              const isError   = line.toLowerCase().includes('error') || line === '— stopped by user —'
              const color     = isError ? 'var(--accent2)' : isSaved ? 'var(--accent3)' : isStep ? 'var(--accent)' : 'var(--text)'
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

      {/* ── Forecast chart ── */}
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
    </div>
  )
}
