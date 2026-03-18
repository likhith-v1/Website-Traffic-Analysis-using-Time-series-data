import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'
import { getModelComparison, getForecast } from '../api/client'
import { GitCompare, AlertCircle } from 'lucide-react'

const fmt = v => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v
const COLORS = ['#e8ff47','#47c8ff','#ff6b6b','#a855f7']
const METRICS = ['MAE','RMSE','MAPE (%)']

export default function Models() {
  const [comparison, setComparison] = useState(null)
  const [forecast,   setForecast]   = useState(null)
  const [metric,     setMetric]     = useState('MAPE (%)')
  const [error,      setError]      = useState(false)

  useEffect(() => {
    getModelComparison()
      .then(d => setComparison(Array.isArray(d) ? d : []))
      .catch(() => setError(true))
    getForecast('Main_Page')
      .then(setForecast)
      .catch(() => {})
  }, [])

  if (error) return (
    <div style={{ padding: 32 }}>
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, marginBottom: 8 }}>Model Comparison</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <AlertCircle color="var(--accent3)" size={20} style={{ marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 8 }}>No precomputed results yet</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
            Run the analysis pipeline first to generate model comparison data:<br />
            <code style={{ color: 'var(--accent)' }}>python main.py</code><br /><br />
            Results will be saved to <code style={{ color: 'var(--accent2)' }}>outputs/precomputed/model_comparison.json</code>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <GitCompare size={28} color="var(--accent)" />
        <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32 }}>Model Comparison</div>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', marginBottom: 28 }}>
        Forecasting accuracy — Linear Trend · Holt-Winters · ARIMA · SARIMA
      </div>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {METRICS.map(m => (
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Bar chart */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>{metric} by Model</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparison}>
                <XAxis dataKey="Model" tick={{ fill: '#6b6b8a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b6b8a', fontSize: 11 }} />
                <Tooltip formatter={v => [fmt(v), metric]} contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                <Bar dataKey={metric} radius={[4,4,0,0]}>
                  {comparison.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>
              Full Metrics Table
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(232,255,71,0.05)' }}>
                  {['Model','MAE','RMSE','MAPE (%)'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Model' ? 'left' : 'right', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...comparison].sort((a,b) => a['MAPE (%)'] - b['MAPE (%)']).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,255,71,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px', fontFamily: 'DM Sans', fontSize: 14 }}>
                      {i === 0 && <span style={{ color: 'var(--accent)', marginRight: 6 }}>★</span>}
                      {r.Model}
                    </td>
                    {['MAE','RMSE','MAPE (%)'].map(m => (
                      <td key={m} style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: 13, color: m === metric ? 'var(--accent)' : 'var(--text)' }}>
                        {fmt(r[m])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
          {comparison === null ? 'Loading…' : 'Run main.py to generate model comparison data'}
        </div>
      )}

      {/* Forecast chart */}
      {forecast && forecast.actual && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>
            Forecast vs Actual — Main_Page
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecast.actual.map((v, i) => ({ i, actual: v, forecast: forecast.forecast?.[i] }))}>
              <XAxis dataKey="i" tick={{ fill: '#6b6b8a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b6b8a', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual"   stroke="#47c8ff" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="#e8ff47" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
