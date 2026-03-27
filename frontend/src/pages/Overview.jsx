import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getStats, getAggregatedDaily, getProjectBreakdown, getAccessBreakdown } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import StatCard from '../components/StatCard'
import { cx } from '../lib/utils'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : n

const COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
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

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        eyebrow="Overview"
        title="Traffic Overview"
        subtitle="A cleaner view of the dataset, the platform mix, and the overall movement of pageviews from July 2015 to December 2016."
      />

      {/* Hero layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-5 mb-5">
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
                    <stop offset="5%"  stopColor="var(--chart-line)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" />
                <YAxis tickFormatter={fmt} width={58} />
                <Tooltip formatter={v => [fmt(v), 'Views']} />
                <Area type="monotone" dataKey="views" stroke="var(--chart-line)" strokeWidth={1.8} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={cx(
              'flex min-h-[290px] items-center justify-center rounded-lg border',
              'border-gray-200 bg-gray-50 font-mono text-xs text-gray-400',
              'dark:border-gray-800 dark:bg-gray-900/50',
            )}>
              {loading ? 'Loading traffic chart…' : dailyError || 'No chart data available'}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="At a Glance" subtitle="Core dataset metrics in a compact summary panel." className="animate-fade-up">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Documents" value={stats ? fmt(stats.documents) : '…'} accent delay={0}  sub="in MongoDB" />
            <StatCard label="Storage Size"    value={stats ? stats.size_gb + 'GB' : '…'} delay={40}  sub="on disk" />
            <StatCard label="Indexes"         value={stats ? stats.indexes : '…'}         delay={80}  sub="for fast queries" />
            <StatCard label="Wiki Languages"  value={stats ? stats.projects : '…'}        delay={120} sub="language projects" />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SurfaceCard title="Views by Language" subtitle="The largest Wikipedia language projects in the dataset." className="animate-fade-up">
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-5 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={projects} dataKey="total_views" nameKey="project" cx="50%" cy="50%" outerRadius={78}
                    label={({ project }) => project?.replace('.wikipedia.org', '')}>
                    {projects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [fmt(v), 'Views']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {projects.map((project, i) => (
                  <div key={project.project} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 font-mono text-[11px] hover:border-gray-300 transition-colors dark:border-gray-800 dark:hover:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700 dark:text-gray-300">{project.project.replace('.wikipedia.org', '')}</span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">{fmt(project.total_views)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={cx(
              'flex min-h-[220px] items-center justify-center rounded-lg border',
              'border-gray-200 bg-gray-50 font-mono text-xs text-gray-400',
              'dark:border-gray-800 dark:bg-gray-900/50',
            )}>
              {loading ? 'Loading language breakdown…' : breakdownError || 'No data available'}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Access Type Breakdown" subtitle="How readers reached Wikipedia across desktop and mobile access modes." className="animate-fade-up">
          {access.length > 0 ? (
            <div className="flex flex-col gap-4 mt-2">
              {access.map((a, i) => {
                const total = access.reduce((s, x) => s + x.total_views, 0)
                const pct = ((a.total_views / total) * 100).toFixed(1)
                return (
                  <div key={i}>
                    <div className="flex justify-between mb-1.5">
                      <span className="font-mono text-[11px] text-gray-900 dark:text-gray-50">{a.access}</span>
                      <span className="font-mono text-[11px]" style={{ color: COLORS[i] }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: COLORS[i] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={cx(
              'flex min-h-[220px] items-center justify-center rounded-lg border',
              'border-gray-200 bg-gray-50 font-mono text-xs text-gray-400',
              'dark:border-gray-800 dark:bg-gray-900/50',
            )}>
              {loading ? 'Loading access breakdown…' : breakdownError || 'No data available'}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  )
}
