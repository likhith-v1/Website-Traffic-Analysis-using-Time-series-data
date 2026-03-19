import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from 'recharts'
import { getModelComparison, getForecast } from '../api/client'
import { GitCompare, AlertCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'

// All metrics the pipeline may emit. Older precomputed files may not have
// the extended set (MSE, SMAPE, WAPE, R2, Bias), so we render '—' for any
// field that is undefined rather than showing raw "undefined" in the table.
const ALL_METRICS = ['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'R2', 'Bias']
const LOWER_IS_BETTER = new Set(['MAE', 'MSE', 'RMSE', 'MAPE (%)', 'SMAPE (%)', 'WAPE (%)', 'Bias'])
const COLORS = ['#e8ff47', '#47c8ff', '#ff6b6b', '#a855f7']

/** Format a metric value, falling back to '—' when the field is absent. */
const fmtMetric = v =>
  v === undefined || v === null
    ? '—'
    : typeof v === 'number'
    ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : v

/** Detect which metrics are actually present across all rows. */
function presentMetrics(rows) {
  if (!rows || rows.length === 0) return ALL_METRICS
  return ALL_METRICS.filter(m => rows.some(r => r[m] !== undefined && r[m] !== null))
}

function sortRows(rows, metric) {
  const factor = LOWER_IS_BETTER.has(metric) ? 1 : -1
  return [...rows].sort((a, b) => ((a[metric] ?? Infinity) - (b[metric] ?? Infinity)) * factor)
}

export default function Models() {
  const [comparison, setComparison] = useState(null)
  const [forecast,   setForecast]   = useState(null)
  const [metric,     setMetric]     = useState('MAPE (%)')
  const [error,      setError]      = useState('')

  useEffect(() => {
    getModelComparison()
      .then(d => {
        const rows = Array.isArray(d) ? d : []
        setComparison(rows)
        // Default to a metric that actually exists in the data
        if (rows.length > 0 && rows[0]['MAPE (%)'] !== undefined) {
          setMetric('MAPE (%)')
        } else if (rows.length > 0) {
          const first = presentMetrics(rows)[0]
          if (first) setMetric(first)
        }
      })
      .catch(err => setError(err.message || 'Unable to load precomputed results'))
    getForecast('Main_Page').then(setForecast).catch(() => {})
  }, [])

  const availableMetrics = presentMetrics(comparison)
  const sortedComparison = comparison ? sortRows(comparison, metric) : []
  const bestRow = sortedComparison[0]

  if (error) return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Forecasting"
        title="Model Comparison"
        subtitle="Compare forecasting strategies and inspect how the chosen model behaves against the held-out test window."
      />
      <div className="empty-state" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: 'left' }}>
        <AlertCircle color="var(--accent3)" size={20} style={{ marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 8 }}>No precomputed results yet</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
            {error}<br /><br />
            Run the analysis pipeline first to generate model comparison data:<br />
            <code style={{ color: 'var(--accent)' }}>python main.py</code><br /><br />
            Results will be saved to{' '}
            <code style={{ color: 'var(--accent2)' }}>outputs/precomputed/model_comparison.json</code>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Forecasting"
        title="Model Comparison"
        subtitle="Evaluate multiple forecasting strategies, compare error metrics, and inspect the selected forecast against actual values."
        actions={<GitCompare size={22} color="var(--accent)" />}
      />

      {/* Metric selector — only shows metrics present in the data */}
      <div className="toolbar-card">
        {availableMetrics.map(m => (
          <button key={m} onClick={() => setMetric(m)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid',
            borderColor: metric === m ? 'var(--accent)' : 'var(--border)',
            background: metric === m ? 'rgba(232,255,71,0.1)' : 'transparent',
            color: metric === m ? 'var(--accent)' : 'var(--muted)',
            fontFamily: 'JetBrains Mono', fontSize: 12, cursor: 'pointer',
          }}>{m}</button>
        ))}
      </div>

      {comparison && comparison.length > 0 ? (
        <div className="two-column-grid">
          <SurfaceCard
            title={`${metric} by Model`}
            subtitle="Models are re-sorted whenever you change the active metric."
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sortedComparison}>
                <XAxis dataKey="Model" tick={{ fill: '#6b6b8a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b6b8a', fontSize: 11 }} />
                <Tooltip
                  formatter={v => [fmtMetric(v), metric]}
                  contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }}
                />
                <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                  {sortedComparison.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>

          <SurfaceCard
            title="Full Metrics Table"
            subtitle="A wider scorecard with both error and fit quality measures."
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: 'rgba(232,255,71,0.05)' }}>
                    {['Model', ...availableMetrics].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: h === 'Model' ? 'left' : 'right',
                        fontFamily: 'JetBrains Mono', fontSize: 11,
                        color: 'var(--muted)', borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedComparison.map((r, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,255,71,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'DM Sans', fontSize: 14 }}>
                        {i === 0 && <span style={{ color: 'var(--accent)', marginRight: 6 }}>★</span>}
                        {r.Model}
                      </td>
                      {availableMetrics.map(m => (
                        <td key={m} style={{
                          padding: '12px 16px', textAlign: 'right',
                          fontFamily: 'JetBrains Mono', fontSize: 13,
                          color: m === metric ? 'var(--accent)' : 'var(--text)',
                        }}>
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
      ) : (
        <div className="empty-state">
          {comparison === null ? 'Loading…' : 'Run main.py to generate model comparison data'}
        </div>
      )}

      {forecast && forecast.actual && (
        <SurfaceCard
          title="Forecast vs Actual"
          subtitle="Held-out test performance for the currently saved article forecast."
        >
          {bestRow && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                ['Best Model', bestRow.Model],
                ['MAE',        fmtMetric(bestRow.MAE)],
                ['RMSE',       fmtMetric(bestRow.RMSE)],
                ['SMAPE',      bestRow['SMAPE (%)'] !== undefined ? `${fmtMetric(bestRow['SMAPE (%)'])}%` : fmtMetric(undefined)],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: 'rgba(232,255,71,0.04)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: 'Syne', fontWeight: 700,
                    fontSize: label === 'Best Model' ? 16 : 20,
                    color: 'var(--accent)',
                  }}>{value}</div>
                </div>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecast.actual.map((v, i) => ({
              i,
              actual: v,
              forecast: forecast.forecast?.[i],
            }))}>
              <XAxis dataKey="i" tick={{ fill: '#6b6b8a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b6b8a', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual"   stroke="#47c8ff" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="#e8ff47" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </SurfaceCard>
      )}
    </div>
  )
}
