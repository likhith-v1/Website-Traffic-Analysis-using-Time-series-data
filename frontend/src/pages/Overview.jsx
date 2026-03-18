import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getStats, getAggregatedDaily, getProjectBreakdown, getAccessBreakdown } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import StatCard from '../components/StatCard'

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n
const COLORS = ['#e8ff47','#47c8ff','#ff6b6b','#a855f7','#f97316','#10b981','#ec4899','#06b6d4']

export default function Overview() {
  const [stats,    setStats]    = useState(null)
  const [daily,    setDaily]    = useState([])
  const [projects, setProjects] = useState([])
  const [access,   setAccess]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [dailyError, setDailyError] = useState('')
  const [breakdownError, setBreakdownError] = useState('')

  useEffect(() => {
    Promise.allSettled([
      getStats(),
      getProjectBreakdown(),
      getAccessBreakdown(),
      getAggregatedDaily('en.wikipedia.org', 'all-access'),
    ])
      .then(([statsResult, projectResult, accessResult, dailyResult]) => {
        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value)
        }

        if (projectResult.status === 'fulfilled') {
          setProjects(projectResult.value.filter(p => p.project && p.project !== 'unknown').slice(0, 8))
        } else {
          setBreakdownError(projectResult.reason?.message || 'Could not load project breakdown')
        }

        if (accessResult.status === 'fulfilled') {
          setAccess(accessResult.value.filter(item => item.access))
        } else {
          setBreakdownError(accessResult.reason?.message || 'Could not load access breakdown')
        }

        if (dailyResult.status === 'fulfilled') {
          setDaily(
            dailyResult.value
              .map(r => ({ date: r.date.slice(0, 7), views: r.total_views }))
              .reduce((acc, cur) => {
                const last = acc[acc.length - 1]
                if (last && last.date === cur.date) {
                  last.views += cur.views
                } else {
                  acc.push({ ...cur })
                }
                return acc
              }, [])
          )
        } else {
          setDailyError(dailyResult.reason?.message || 'Could not load traffic chart')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Wikipedia Traffic"
        title="Traffic Overview"
        subtitle="A cleaner view of the dataset, the platform mix, and the overall movement of pageviews from July 2015 to December 2016."
      />

      <div className="stat-grid">
        <StatCard label="Total Documents"  value={stats ? fmt(stats.documents)  : '…'} accent delay={0}   sub="in MongoDB" />
        <StatCard label="Storage Size"     value={stats ? stats.size_gb+'GB'    : '…'} delay={80}  sub="on disk" />
        <StatCard label="Indexes"          value={stats ? stats.indexes         : '…'} delay={160} sub="for fast queries" />
        <StatCard label="Wikipedia Langs"  value={stats ? stats.projects        : '…'} delay={240} sub="language projects" />
      </div>

      <SurfaceCard
        title="Monthly English Wikipedia Views"
        subtitle="A smoothed, high-level read of how aggregate attention changed over time."
        className="animate-fade-up"
      >
        {daily.length > 0 ? (
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
        ) : (
          <div className="empty-state" style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? 'Loading traffic chart…' : dailyError || 'No chart data available'}
          </div>
        )}
      </SurfaceCard>

      <div className="two-column-grid">
        <SurfaceCard title="Views by Language" subtitle="The largest Wikipedia language projects in the dataset." className="animate-fade-up">
          {projects.length > 0 ? (
            <div className="overview-split-card">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={projects} dataKey="total_views" nameKey="project" cx="50%" cy="50%" outerRadius={80} label={({ project }) => project?.replace('.wikipedia.org','')}>
                    {projects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="overview-legend-list">
                {projects.map((project, index) => (
                  <div key={project.project} className="overview-legend-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="overview-legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
                      <span>{project.project.replace('.wikipedia.org', '')}</span>
                    </div>
                    <span>{fmt(project.total_views)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? 'Loading language breakdown…' : breakdownError || 'No language breakdown data available'}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Access Type Breakdown" subtitle="How readers reached Wikipedia across desktop and mobile access modes." className="animate-fade-up">
          {access.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
              {access.map((a, i) => {
                const total = access.reduce((s, x) => s + x.total_views, 0)
                const pct = ((a.total_views / total) * 100).toFixed(1)
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{a.access}</span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: COLORS[i] }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i], borderRadius: 999, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? 'Loading access breakdown…' : breakdownError || 'No access breakdown data available'}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  )
}
