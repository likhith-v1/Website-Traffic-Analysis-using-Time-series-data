import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getStats, getAggregatedDaily, getProjectBreakdown, getAccessBreakdown } from '../api/client'
import StatCard from '../components/StatCard'

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n
const COLORS = ['#e8ff47','#47c8ff','#ff6b6b','#a855f7','#f97316','#10b981','#ec4899','#06b6d4']

export default function Overview() {
  const [stats,    setStats]    = useState(null)
  const [daily,    setDaily]    = useState([])
  const [projects, setProjects] = useState([])
  const [access,   setAccess]   = useState([])

  useEffect(() => {
    getStats().then(setStats)
    getProjectBreakdown().then(d => setProjects(d.filter(p => p.project !== 'unknown').slice(0, 8)))
    getAccessBreakdown().then(setAccess)
    getAggregatedDaily('en.wikipedia.org', 'all-access').then(d =>
      setDaily(d.map(r => ({ date: r.date.slice(0,7), views: r.total_views }))
        .reduce((acc, cur) => {
          const last = acc[acc.length - 1]
          if (last && last.date === cur.date) { last.views += cur.views }
          else acc.push({ ...cur })
          return acc
        }, []))
    )
  }, [])

  return (
    <div style={{ padding: 32 }}>
      <div className="animate-fade-up">
        <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, marginBottom: 4 }}>
          Traffic Overview
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', marginBottom: 32 }}>
          Wikipedia pageview time series · Jul 2015 – Dec 2016
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Documents"  value={stats ? fmt(stats.documents)  : '…'} accent delay={0}   sub="in MongoDB" />
        <StatCard label="Storage Size"     value={stats ? stats.size_gb+'GB'    : '…'} delay={80}  sub="on disk" />
        <StatCard label="Indexes"          value={stats ? stats.indexes         : '…'} delay={160} sub="for fast queries" />
        <StatCard label="Wikipedia Langs"  value={stats ? stats.projects        : '…'} delay={240} sub="language projects" />
      </div>

      {/* Daily chart */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }} className="animate-fade-up">
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
          Monthly English Wikipedia Views
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={daily}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#e8ff47" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#e8ff47" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#6b6b8a', fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fill: '#6b6b8a', fontSize: 11 }} width={60} />
            <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
            <Area type="monotone" dataKey="views" stroke="#e8ff47" strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Project breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }} className="animate-fade-up">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Views by Language</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={projects} dataKey="total_views" nameKey="project" cx="50%" cy="50%" outerRadius={80} label={({ project }) => project?.replace('.wikipedia.org','')}>
                {projects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Access breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }} className="animate-fade-up">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Access Type Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {access.map((a, i) => {
              const total = access.reduce((s, x) => s + x.total_views, 0)
              const pct   = ((a.total_views / total) * 100).toFixed(1)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{a.access}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: COLORS[i] }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i], borderRadius: 3, transition: 'width 1s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
