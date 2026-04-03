import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getStats, getAggregatedDaily, getProjectBreakdown, getAccessBreakdown, getTopArticles } from '../api/client'
import { cx, fmt, getLang } from '../lib/utils'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const DONUT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

// Build SVG donut segments from project data
function buildDonutSegments(projects) {
  if (!projects.length) return []
  const total = projects.reduce((s, p) => s + p.total_views, 0)
  const top2 = projects.slice(0, 2)
  const othersTotal = projects.slice(2).reduce((s, p) => s + p.total_views, 0)
  const items = [
    ...top2.map(p => ({
      label: getLang(p.project),
      pct: (p.total_views / total) * 100,
    })),
    ...(othersTotal > 0 ? [{ label: 'Others', pct: (othersTotal / total) * 100 }] : []),
  ]
  let offset = 0
  return items.map((item, i) => {
    const seg = { ...item, color: DONUT_COLORS[i] || '#94a3b8', offset }
    offset += item.pct
    return seg
  })
}

// Access bar color by index
const ACCESS_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']

export default function Overview() {
  const [stats,       setStats]       = useState(null)
  const [projects,    setProjects]    = useState([])
  const [access,      setAccess]      = useState([])
  const [barData,     setBarData]     = useState([])
  const [topArticles, setTopArticles] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getStats(),
      getProjectBreakdown(),
      getAccessBreakdown(),
      getAggregatedDaily('en.wikipedia.org', 'all-access'),
      getTopArticles(5),
    ]).then(([statsRes, projRes, accRes, dailyRes, topRes]) => {
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)

      if (projRes.status === 'fulfilled') {
        setProjects(projRes.value.filter(p => p.project && p.project !== 'unknown').slice(0, 8))
      }

      if (accRes.status === 'fulfilled') {
        setAccess(accRes.value.filter(item => item.access))
      }

      if (dailyRes.status === 'fulfilled') {
        const raw = dailyRes.value
        const byYearMonth = {}
        raw.forEach(r => {
          const parts = r.date.split('-')
          const year = parts[0]
          const month = parseInt(parts[1], 10)
          const key = `${year}-${month}`
          if (!byYearMonth[key]) byYearMonth[key] = { year: +year, month, views: 0 }
          byYearMonth[key].views += r.total_views
        })
        const monthMap = {}
        MONTH_NAMES.forEach(m => { monthMap[m] = { month: m, y2015: 0, y2016: 0 } })
        Object.values(byYearMonth).forEach(({ year, month, views }) => {
          const m = MONTH_NAMES[month - 1]
          monthMap[m][`y${year}`] = views
        })
        setBarData(MONTH_NAMES.map(m => monthMap[m]))
      }

      if (topRes.status === 'fulfilled') {
        setTopArticles(topRes.value.slice(0, 5))
      }
    }).finally(() => setLoading(false))
  }, [])

  // Derived stats
  const totalViews   = projects.reduce((s, p) => s + p.total_views, 0)
  const totalMonthly = barData.reduce((s, d) => s + (d.y2015 || 0) + (d.y2016 || 0), 0)
  const activeBars   = barData.filter(d => (d.y2015 || 0) + (d.y2016 || 0) > 0).length
  const avgDaily     = activeBars > 0 ? Math.round(totalMonthly / (activeBars * 30)) : 0
  const donutSegments = buildDonutSegments(projects)
  const topSegment    = donutSegments[0]

  const Skeleton = ({ className, style }) => (
    <div className={cx('animate-pulse rounded bg-surface-container', className)} style={style} />
  )

  return (
    <div className="p-6 lg:p-8 bg-surface dark:bg-slate-950 min-h-full">

      {/* ── Row 1: Hero Bento Stats ─────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6 mb-6">

        {/* Total Pageviews */}
        <div className={cx(
          'col-span-12 lg:col-span-4',
          'bg-surface-container-lowest dark:bg-slate-900',
          'p-6 rounded-xl shadow-[0_4px_20px_rgba(27,37,75,0.04)]',
          'relative overflow-hidden group animate-fade-up',
        )}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-container/5 rounded-full group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Total Pageviews</span>
            <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            {loading
              ? <Skeleton className="h-10 w-28" />
              : <h2 className="text-4xl font-extrabold text-primary-container dark:text-primary-fixed font-mono">{fmt(totalViews)}</h2>
            }
          </div>
          <p className="text-slate-400 text-xs mt-2">Aggregated across all Wikipedia projects</p>
        </div>

        {/* Wiki Projects */}
        <div className={cx(
          'col-span-12 lg:col-span-4',
          'bg-surface-container-lowest dark:bg-slate-900',
          'p-6 rounded-xl shadow-[0_4px_20px_rgba(27,37,75,0.04)]',
          'animate-fade-up',
        )}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Wiki Projects</span>
            <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            {loading
              ? <Skeleton className="h-10 w-16" />
              : <h2 className="text-4xl font-extrabold text-primary-container dark:text-primary-fixed font-mono">{stats?.projects ?? '—'}</h2>
            }
            <span className="text-slate-400 text-xs font-bold">language editions</span>
          </div>
          <div className="mt-4 w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary-container h-full w-[65%] rounded-full" />
          </div>
        </div>

        {/* Avg Daily Views — dark card */}
        <div className={cx(
          'col-span-12 lg:col-span-4',
          'bg-primary-container dark:bg-slate-800',
          'p-6 rounded-xl shadow-[0_10px_30px_rgba(5,15,54,0.2)]',
          'text-white animate-fade-up',
        )}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-on-primary-container font-bold text-xs uppercase tracking-widest">Avg Daily Views</span>
            <svg className="w-5 h-5 text-secondary-fixed" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            {loading
              ? <Skeleton className="h-10 w-24 bg-white/20" />
              : <h2 className="text-4xl font-extrabold font-mono">{fmt(avgDaily)}</h2>
            }
            <span className="text-secondary-fixed text-xs font-bold">per day</span>
          </div>
          <p className="text-on-primary-container text-xs mt-2 italic">
            {topSegment ? `Top language: ${topSegment.label} (${topSegment.pct.toFixed(0)}%)` : 'en.wikipedia.org'}
          </p>
        </div>
      </div>

      {/* ── Row 2: Charts ───────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6 mb-6">

        {/* Global Traffic Trend — Bar Chart */}
        <div className={cx(
          'col-span-12 lg:col-span-8',
          'bg-surface-container-lowest dark:bg-slate-900',
          'p-8 rounded-xl shadow-[0_4px_20px_rgba(27,37,75,0.04)]',
          'animate-fade-up',
        )}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold text-primary-container dark:text-white font-display">Global Traffic Trend</h3>
              <p className="text-slate-400 text-sm mt-0.5">Year-over-year comparison (2015 vs 2016) · dataset starts Jul 2015</p>
            </div>
            <div className="flex gap-5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary-container/25" />
                <span className="text-xs font-bold text-slate-500 font-mono">2015</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-xs font-bold text-slate-500 font-mono">2016</span>
              </div>
            </div>
          </div>

          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barGap={3} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={fmt} width={52} />
                <Tooltip
                  formatter={(v, name) => [fmt(v), name]}
                  labelFormatter={l => `Month: ${l}`}
                />
                <Bar dataKey="y2015" fill="var(--chart-1)" fillOpacity={0.25} radius={[3, 3, 0, 0]} name="2015" />
                <Bar dataKey="y2016" fill="var(--chart-2)" radius={[3, 3, 0, 0]} name="2016" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center">
              {loading
                ? <div className="grid grid-cols-12 gap-2 w-full h-full items-end px-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="col-span-1 flex gap-0.5 items-end">
                        <Skeleton className={`w-4 rounded-t`} style={{ height: `${40 + Math.random() * 60}%` }} />
                        <Skeleton className={`w-4 rounded-t`} style={{ height: `${50 + Math.random() * 50}%` }} />
                      </div>
                    ))}
                  </div>
                : <span className="font-mono text-xs text-slate-400">No chart data available</span>
              }
            </div>
          )}
        </div>

        {/* Language Reach — SVG Donut */}
        <div className={cx(
          'col-span-12 lg:col-span-4',
          'bg-surface-container-lowest dark:bg-slate-900',
          'p-8 rounded-xl shadow-[0_4px_20px_rgba(27,37,75,0.04)]',
          'animate-fade-up',
        )}>
          <h3 className="text-xl font-bold text-primary-container dark:text-white font-display mb-6">Language Reach</h3>

          {/* SVG Donut */}
          <div className="relative w-44 h-44 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Track */}
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="var(--chart-track)" strokeWidth="3"
              />
              {/* Segments */}
              {donutSegments.length > 0
                ? donutSegments.map((seg, i) => (
                    <path
                      key={i}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="3"
                      strokeDasharray={`${seg.pct.toFixed(2)}, 100`}
                      strokeDashoffset={`-${seg.offset.toFixed(2)}`}
                      strokeLinecap="round"
                    />
                  ))
                : loading && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="var(--chart-1)" strokeOpacity="0.2" strokeWidth="3"
                      strokeDasharray="45, 100" strokeLinecap="round"
                    />
                  )
              }
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading
                ? <Skeleton className="h-6 w-12 mb-1" />
                : <span className="text-2xl font-extrabold text-primary-container dark:text-primary-fixed font-mono">
                    {topSegment ? `${topSegment.pct.toFixed(0)}%` : '—'}
                  </span>
              }
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                {topSegment?.label ?? 'Loading'}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {donutSegments.length > 0
              ? donutSegments.map((seg, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                      {seg.label}
                    </span>
                    <span className="text-sm font-bold font-mono text-on-surface dark:text-slate-200">
                      {seg.pct.toFixed(1)}%
                    </span>
                  </div>
                ))
              : loading && Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))
            }
          </div>
        </div>
      </div>

      {/* ── Row 3: Access Channel + Trending Articles ───────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Access Channel */}
        <div className={cx(
          'col-span-12 lg:col-span-5',
          'bg-surface-container-lowest dark:bg-slate-900',
          'p-8 rounded-xl shadow-[0_4px_20px_rgba(27,37,75,0.04)]',
          'animate-fade-up',
        )}>
          <h3 className="text-xl font-bold text-primary-container dark:text-white font-display mb-8">Access Channel</h3>

          {access.length > 0 ? (
            <>
              <div className="space-y-7">
                {access.map((a, i) => {
                  const total = access.reduce((s, x) => s + x.total_views, 0)
                  const pct   = ((a.total_views / total) * 100).toFixed(1)
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-bold text-primary-container dark:text-slate-200 capitalize">
                          {a.access.replace(/-/g, ' ')}
                        </span>
                        <span className="text-sm font-extrabold font-mono text-primary-container dark:text-slate-200">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-container-low dark:bg-slate-800 h-3 rounded-full">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${pct}%`, background: ACCESS_COLORS[i] || '#94a3b8' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-10 p-4 bg-surface-container-low dark:bg-slate-800 rounded-lg flex items-start gap-3">
                <svg className="w-6 h-6 text-secondary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Access breakdown shows how readers reached Wikipedia — desktop browsers, mobile web, and the official app.
                </p>
              </div>
            </>
          ) : (
            loading
              ? <div className="space-y-7">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              : <p className="font-mono text-xs text-slate-400 mt-4">No access data available</p>
          )}
        </div>

        {/* Trending Articles */}
        <div className={cx(
          'col-span-12 lg:col-span-7',
          'bg-surface-container-lowest dark:bg-slate-900',
          'rounded-xl shadow-[0_4px_20px_rgba(27,37,75,0.04)]',
          'overflow-hidden animate-fade-up',
        )}>
          <div className="p-6 border-b border-surface-container dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xl font-bold text-primary-container dark:text-white font-display">Trending Articles</h3>
            <a href="/leaderboard" className="text-secondary dark:text-secondary-fixed-dim text-sm font-bold hover:underline">
              View All
            </a>
          </div>

          {topArticles.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50 dark:bg-slate-800/50">
                  {['Article Title', 'Total Views', 'Rank', 'Language'].map(h => (
                    <th key={h} className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container dark:divide-slate-800">
                {topArticles.map((article, i) => {
                  const rankColors = [
                    'bg-secondary-container/40 text-secondary dark:bg-secondary/10 dark:text-secondary-fixed-dim',
                    'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300',
                    'bg-secondary-container/20 text-secondary/80 dark:bg-secondary/5 dark:text-secondary-fixed-dim',
                    'bg-surface-container text-on-surface-variant dark:bg-slate-800 dark:text-slate-400',
                    'bg-surface-container text-on-surface-variant dark:bg-slate-800 dark:text-slate-400',
                  ]
                  return (
                    <tr key={i} className="hover:bg-surface-container-low/30 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold font-mono"
                            style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          >
                            {(article.article ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-primary-container dark:text-slate-200 max-w-[160px] truncate">
                            {(article.article ?? '').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-medium text-on-surface dark:text-slate-300">
                        {fmt(article.total_views)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cx('text-[10px] px-2 py-1 rounded-full font-bold', rankColors[i])}>
                          #{i + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {getLang(article.project)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            loading
              ? (
                <div className="divide-y divide-surface-container dark:divide-slate-800">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4">
                      <Skeleton className="w-8 h-8 rounded" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              )
              : <p className="font-mono text-xs text-slate-400 p-6">No articles available</p>
          )}
        </div>
      </div>
    </div>
  )
}
