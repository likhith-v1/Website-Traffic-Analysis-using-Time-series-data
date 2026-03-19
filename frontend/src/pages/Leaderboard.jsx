import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getTopArticles } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : String(n)

const MEDAL = ['🥇', '🥈', '🥉']
const COLORS = [
  'var(--chart-palette-1)',
  'var(--chart-palette-2)',
  'var(--chart-palette-3)',
  'var(--chart-palette-4)',
  'var(--chart-palette-5)',
]

const PROJECTS = [
  'en.wikipedia.org', 'de.wikipedia.org', 'fr.wikipedia.org',
  'es.wikipedia.org', 'ru.wikipedia.org', 'ja.wikipedia.org', 'zh.wikipedia.org',
]

const btnStyle = (active) => ({
  padding: '9px 16px', borderRadius: 8, border: '1px solid',
  borderColor: active ? 'var(--accent)' : 'var(--border)',
  background:  active ? 'var(--accent-soft)' : 'transparent',
  color:       active ? 'var(--accent)' : 'var(--muted)',
  fontFamily:  'var(--font-mono)', fontSize: 11,
  cursor: 'pointer', transition: 'all 0.15s',
  letterSpacing: '0.04em',
})

const tooltipStyle = {
  background: 'var(--tooltip-bg)', border: '1px solid var(--border)',
  color: 'var(--tooltip-text)',
  borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11,
}

export default function Leaderboard() {
  const [data,    setData]    = useState([])
  const [project, setProject] = useState('en.wikipedia.org')
  const [n,       setN]       = useState(20)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getTopArticles(n, project, 'all-access').then(d => { setData(d); setLoading(false) })
  }, [project, n])

  const max = data[0]?.total_views || 1

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Ranking"
        title="Leaderboard"
        subtitle="Compare the highest-traffic articles across Wikipedia language projects and switch between quick ranking presets."
      />

      <div className="toolbar-card">
        <select value={project} onChange={e => setProject(e.target.value)} style={{
          padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11,
          outline: 'none', letterSpacing: '0.04em',
        }}>
          {PROJECTS.map(p => <option key={p} value={p}>{p.replace('.wikipedia.org', '')} Wikipedia</option>)}
        </select>
        <div className="pill-group">
          {[10, 20, 50].map(v => (
            <button key={v} onClick={() => setN(v)} style={btnStyle(n === v)}>Top {v}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading from MongoDB…</div>
      ) : (
        <div className="two-column-grid">
          <SurfaceCard title="Top Articles" subtitle="Ranked by total views across the full date range.">
            {data.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '11px 0',
                borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <div style={{
                  width: 28, textAlign: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: i < 3 ? 'var(--accent)' : 'var(--muted)',
                }}>
                  {i < 3 ? MEDAL[i] : `#${i + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>
                    {r.article.replace(/_/g, ' ').slice(0, 36)}{r.article.length > 36 ? '…' : ''}
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 6 }}>
                    <div style={{
                      height: '100%',
                      width: `${(r.total_views / max) * 100}%`,
                      background: i === 0 ? COLORS[0] : i === 1 ? COLORS[1] : COLORS[2],
                      borderRadius: 2,
                      transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                    }} />
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--accent)', minWidth: 56, textAlign: 'right',
                }}>
                  {fmt(r.total_views)}
                </div>
              </div>
            ))}
          </SurfaceCard>

          <SurfaceCard title="Visual Ranking" subtitle="The top 15 pages plotted for side-by-side comparison.">
            <ResponsiveContainer width="100%" height={Math.max(data.length * 28, 300)}>
              <BarChart data={data.slice(0, 15)} layout="vertical">
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} />
                <YAxis type="category" dataKey="article" tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} width={120}
                  tickFormatter={v => v.replace(/_/g, ' ').slice(0, 18)} />
                <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={tooltipStyle} />
                <Bar dataKey="total_views" radius={[0, 4, 4, 0]}>
                  {data.slice(0, 15).map((_, i) => (
                    <Cell key={i} fill={i < COLORS.length ? COLORS[i] : 'var(--chart-line-2)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>
        </div>
      )}
    </div>
  )
}
