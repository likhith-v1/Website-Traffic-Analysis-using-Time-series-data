import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getStats, getAggregatedDaily, getProjectBreakdown, getAccessBreakdown } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import StatCard from '../components/StatCard'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : n

const COLORS = [
  'var(--chart-palette-1)',
  'var(--chart-palette-2)',
  'var(--chart-palette-3)',
  'var(--chart-palette-4)',
  'var(--chart-palette-5)',
  'var(--chart-palette-6)',
  'var(--chart-palette-7)',
  'var(--chart-palette-8)',
]

export default function Overview() {
  const [stats,    setStats]    = useState(null)
  const [daily,    setDaily]    = useState([])
  const [projects, setProjects] = useState([])
  const [access,   setAccess]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [dailyError,     setDailyError]     = useState('')
  const [breakdownError, setBreakdownError] = useState('')

  useEffect(() => {
    Promise.allSettled([
      getStats(),
      getProjectBreakdown(),
      getAccessBreakdown(),
      getAggregatedDaily('en.wikipedia.org', 'all-access'),
    ]).then(([statsRes, projRes, accRes, dailyRes]) => {
      if (statsRes.status   === 'fulfilled') setStats(statsRes.value)
      if (projRes.status    === 'fulfilled') setProjects(projRes.value.filter(p => p.project && p.project !== 'unknown').slice(0, 8))
      else setBreakdownError(projRes.reason?.message || 'Could not load project breakdown')
      if (accRes.status     === 'fulfilled') setAccess(accRes.value.filter(item => item.access))
      else setBreakdownError(accRes.reason?.message || 'Could not load access breakdown')
      if (dailyRes.status   === 'fulfilled') {
        setDaily(
          dailyRes.value
            .map(r => ({ date: r.date.slice(0, 7), views: r.total_views }))
            .reduce((acc, cur) => {
              const last = acc[acc.length - 1]
              if (last && last.date === cur.date) last.views += cur.views
              else acc.push({ ...cur })
              return acc
            }, [])
        )
      } else setDailyError(dailyRes.reason?.message || 'Could not load traffic chart')
    }).finally(() => setLoading(false))
  }, [])

  const tooltipStyle = {
    background: 'var(--tooltip-bg)',
    border: '1px solid var(--border)',
    color: 'var(--tooltip-text)',
    borderRadius: 8,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Overview"
        title="Traffic Overview"
        subtitle="A cleaner view of the dataset, the platform mix, and the overall movement of pageviews from July 2015 to December 2016."
      />

      <div className="overview-hero-layout">
        <SurfaceCard
          title="Monthly English Wikipedia Views"
          subtitle="A smoothed, high-level read of how aggregate attention changed over time."
          className="animate-fade-up"
        >
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--chart-line)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--chart-tick)', fontSize: 10 }} width={58} />
                <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="views" stroke="var(--chart-line)" strokeWidth={1.8} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={`empty-state ${loading ? 'empty-state-loading' : ''}`} style={{ minHeight: 290, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? 'Loading traffic chart…' : dailyError || 'No chart data available'}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="At a Glance" subtitle="Core dataset metrics in a compact summary panel." className="animate-fade-up">
          <div className="overview-stat-grid">
            <StatCard label="Total Documents" value={stats ? fmt(stats.documents) : '…'} accent delay={0} sub="in MongoDB" />
            <StatCard label="Storage Size" value={stats ? stats.size_gb + 'GB' : '…'} delay={40} sub="on disk" />
            <StatCard label="Indexes" value={stats ? stats.indexes : '…'} delay={80} sub="for fast queries" />
            <StatCard label="Wiki Languages" value={stats ? stats.projects : '…'} delay={120} sub="language projects" />
          </div>
        </SurfaceCard>
      </div>

      <div className="two-column-grid">
        <SurfaceCard title="Views by Language" subtitle="The largest Wikipedia language projects in the dataset." className="animate-fade-up">
          {projects.length > 0 ? (
            <div className="overview-split-card">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={projects} dataKey="total_views" nameKey="project" cx="50%" cy="50%" outerRadius={78}
                    label={({ project }) => project?.replace('.wikipedia.org', '')}>
                    {projects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [fmt(v), 'Views']} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="overview-legend-list">
                {projects.map((project, i) => (
                  <div key={project.project} className="overview-legend-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span className="overview-legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{project.project.replace('.wikipedia.org', '')}</span>
                    </div>
                    <span style={{ color: 'var(--muted)' }}>{fmt(project.total_views)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`empty-state ${loading ? 'empty-state-loading' : ''}`} style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? 'Loading language breakdown…' : breakdownError || 'No data available'}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Access Type Breakdown" subtitle="How readers reached Wikipedia across desktop and mobile access modes." className="animate-fade-up">
          {access.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {access.map((a, i) => {
                const total = access.reduce((s, x) => s + x.total_views, 0)
                const pct = ((a.total_views / total) * 100).toFixed(1)
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>{a.access}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: COLORS[i] }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i], borderRadius: 999, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={`empty-state ${loading ? 'empty-state-loading' : ''}`} style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? 'Loading access breakdown…' : breakdownError || 'No data available'}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  )
}
