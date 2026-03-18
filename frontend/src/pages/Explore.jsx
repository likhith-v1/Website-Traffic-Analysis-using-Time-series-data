import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from 'recharts'
import { getAggregatedDaily, getArticle } from '../api/client'

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n)

const PRESETS = ['Main_Page', 'Special:Search', 'Albert_Einstein', 'Python_(programming_language)', 'Donald_Trump']

export default function Explore() {
  const [mode,    setMode]    = useState('aggregated') // 'aggregated' | 'article'
  const [article, setArticle] = useState('Main_Page')
  const [input,   setInput]   = useState('Main_Page')
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)
  const [stats,   setStats]   = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      let raw
      if (mode === 'aggregated') {
        raw = await getAggregatedDaily('en.wikipedia.org', 'all-access')
        raw = raw.map(r => ({ date: r.date, views: r.total_views }))
      } else {
        raw = await getArticle(article)
        raw = raw.map(r => ({ date: r.date, views: r.views }))
      }
      setData(raw)
      if (raw.length) {
        const views = raw.map(r => r.views)
        setStats({
          min: Math.min(...views), max: Math.max(...views),
          avg: Math.round(views.reduce((a,b)=>a+b,0)/views.length),
          total: views.reduce((a,b)=>a+b,0), points: raw.length,
        })
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Error loading data')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [mode, article])

  return (
    <div style={{ padding: 32 }}>
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, marginBottom: 4 }}>Explore</div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', marginBottom: 28 }}>
        Daily time series — zoom, pan, inspect
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {['aggregated','article'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid',
            borderColor: mode === m ? 'var(--accent)' : 'var(--border)',
            background: mode === m ? 'rgba(232,255,71,0.1)' : 'transparent',
            color: mode === m ? 'var(--accent)' : 'var(--muted)',
            fontFamily: 'JetBrains Mono', fontSize: 12, cursor: 'pointer',
          }}>
            {m === 'aggregated' ? 'All English Pages' : 'Single Article'}
          </button>
        ))}

        {mode === 'article' && (
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setArticle(input)}
              placeholder="Article name e.g. Albert_Einstein"
              style={{
                flex: 1, padding: '8px 14px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontFamily: 'JetBrains Mono', fontSize: 12, outline: 'none',
              }} />
            <button onClick={() => setArticle(input)} style={{
              padding: '8px 16px', background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: 8, fontFamily: 'Syne', fontWeight: 700,
              fontSize: 13, cursor: 'pointer',
            }}>Go</button>
          </div>
        )}
      </div>

      {/* Presets */}
      {mode === 'article' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p} onClick={() => { setInput(p); setArticle(p) }} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)',
              background: article === p ? 'rgba(71,200,255,0.1)' : 'transparent',
              color: article === p ? 'var(--accent2)' : 'var(--muted)',
              fontFamily: 'JetBrains Mono', fontSize: 11, cursor: 'pointer',
            }}>{p.replace(/_/g, ' ')}</button>
          ))}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            ['Data Points', stats.points],
            ['Total Views', fmt(stats.total)],
            ['Daily Avg',   fmt(stats.avg)],
            ['Peak',        fmt(stats.max)],
            ['Minimum',     fmt(stats.min)],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted)' }}>{l}</div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--accent2)' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        {loading
          ? <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
              Loading data from MongoDB…
            </div>
          : <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data}>
                <XAxis dataKey="date" tick={{ fill: '#6b6b8a', fontSize: 10 }} interval={Math.floor(data.length / 12)} />
                <YAxis tickFormatter={fmt} tick={{ fill: '#6b6b8a', fontSize: 10 }} width={65} />
                <Tooltip formatter={v => [fmt(v), 'Views']} labelStyle={{ fontFamily: 'JetBrains Mono' }}
                  contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                <Line type="monotone" dataKey="views" stroke="#e8ff47" strokeWidth={1.5} dot={false} />
                <Brush dataKey="date" height={24} stroke="var(--border)" fill="var(--bg)" travellerWidth={6}
                  style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
        }
      </div>
    </div>
  )
}
