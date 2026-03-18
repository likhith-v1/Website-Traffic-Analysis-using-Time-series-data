import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getTopArticles } from '../api/client'
import { Trophy } from 'lucide-react'

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n)
const MEDAL = ['🥇','🥈','🥉']

export default function Leaderboard() {
  const [data,    setData]    = useState([])
  const [project, setProject] = useState('en.wikipedia.org')
  const [n,       setN]       = useState(20)
  const [loading, setLoading] = useState(false)

  const PROJECTS = ['en.wikipedia.org','de.wikipedia.org','fr.wikipedia.org','es.wikipedia.org','ru.wikipedia.org','ja.wikipedia.org','zh.wikipedia.org']

  useEffect(() => {
    setLoading(true)
    getTopArticles(n, project, 'all-access').then(d => { setData(d); setLoading(false) })
  }, [project, n])

  const max = data[0]?.total_views || 1

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Trophy size={28} color="var(--accent)" />
        <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32 }}>Leaderboard</div>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', marginBottom: 28 }}>
        Top articles by total views
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <select value={project} onChange={e => setProject(e.target.value)} style={{
          padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text)', fontFamily: 'JetBrains Mono', fontSize: 12, outline: 'none',
        }}>
          {PROJECTS.map(p => <option key={p} value={p}>{p.replace('.wikipedia.org', '')} Wikipedia</option>)}
        </select>
        {[10,20,50].map(v => (
          <button key={v} onClick={() => setN(v)} style={{
            padding: '10px 18px', borderRadius: 8, border: '1px solid',
            borderColor: n === v ? 'var(--accent)' : 'var(--border)',
            background: n === v ? 'rgba(232,255,71,0.1)' : 'transparent',
            color: n === v ? 'var(--accent)' : 'var(--muted)',
            fontFamily: 'JetBrains Mono', fontSize: 12, cursor: 'pointer',
          }}>Top {v}</button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 64, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>Loading from MongoDB…</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Table */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {data.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 20px', borderBottom: i < data.length-1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,255,71,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 28, textAlign: 'center', fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: i < 3 ? 'var(--accent)' : 'var(--muted)' }}>
                    {i < 3 ? MEDAL[i] : `#${i+1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 14 }}>{r.article.replace(/_/g,' ').slice(0, 36)}{r.article.length > 36 ? '…' : ''}</div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 6 }}>
                      <div style={{ height: '100%', width: `${(r.total_views/max)*100}%`, background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--accent2)' : 'var(--accent3)', borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--accent)', minWidth: 60, textAlign: 'right' }}>
                    {fmt(r.total_views)}
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Visual Ranking</div>
              <ResponsiveContainer width="100%" height={Math.max(data.length * 28, 300)}>
                <BarChart data={data.slice(0,15)} layout="vertical">
                  <XAxis type="number" tickFormatter={fmt} tick={{ fill: '#6b6b8a', fontSize: 10 }} />
                  <YAxis type="category" dataKey="article" tick={{ fill: '#6b6b8a', fontSize: 10 }} width={120}
                    tickFormatter={v => v.replace(/_/g,' ').slice(0,18)} />
                  <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                  <Bar dataKey="total_views" radius={[0, 4, 4, 0]}>
                    {data.slice(0,15).map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#e8ff47' : i === 1 ? '#47c8ff' : i === 2 ? '#ff6b6b' : '#2a2a3a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      }
    </div>
  )
}
