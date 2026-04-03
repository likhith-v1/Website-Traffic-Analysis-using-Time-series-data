import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush, Legend } from 'recharts'
import { getTopArticles, getArticle, getProjectBreakdown } from '../api/client'
import { cx, fmt, getLang, exportCSV } from '../lib/utils'
import { BarChart2, ChevronLeft, ChevronRight, X, Download, GitCompare } from 'lucide-react'

const TIME_RANGES = [
  { label: 'All', days: null },
  { label: '6M',  days: 180 },
  { label: '3M',  days: 90 },
  { label: '1M',  days: 30 },
]

function filterByRange(data, days) {
  if (!days || !data.length) return data
  const cutoff = data[data.length - 1 - Math.min(days, data.length - 1)]?.date
  return cutoff ? data.filter(d => d.date >= cutoff) : data
}

const DATASET_DAYS = 520 // approx days in Jul 2015 – Dec 2016

// Generate consistent 7-bar sparkline heights from article name
function getSparkline(name) {
  const seed = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return [12, 20, 32, 24, 28, 40, 48].map((h, i) => {
    const v = ((seed * (i + 1) * 7) % 30) - 15
    return Math.max(4, Math.min(48, h + v))
  })
}

const ITEMS_PER_PAGE = 10

function PodiumCard({ article, rank, height, hero = false }) {
  if (!article) return <div className={cx('rounded-xl bg-surface-container dark:bg-slate-800', height)} />
  const podiumLabels = [null, 'Global Leader', 'Trending Up', 'Sustained Growth']

  return (
    <div className={cx(
      'rounded-xl relative overflow-hidden group flex flex-col justify-end',
      height,
      hero
        ? 'bg-primary-container shadow-[0_20px_60px_rgba(5,15,54,0.3)] p-10'
        : 'bg-surface-container-low dark:bg-slate-800 p-8',
    )}>
      {/* Rank watermark */}
      <div className={cx(
        'absolute select-none italic font-black pointer-events-none',
        hero
          ? '-top-4 -right-4 text-9xl text-white/10'
          : 'top-4 right-4 text-6xl text-primary/5 dark:text-white/5',
      )}>
        #{rank}
      </div>

      {/* Hero glass skew */}
      {hero && (
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 skew-x-12 translate-x-1/2 pointer-events-none" />
      )}

      <div className="relative z-10">
        {rank === 1 ? (
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs font-bold text-secondary-fixed uppercase tracking-[0.2em] font-mono">
              Global Leader
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center px-2 py-1 bg-surface-container-high dark:bg-slate-700 rounded text-[10px] font-bold text-primary dark:text-slate-200 uppercase mb-3">
            {podiumLabels[rank]}
          </span>
        )}

        <h3 className={cx(
          'font-bold mb-2 truncate max-w-full',
          hero
            ? 'text-3xl lg:text-4xl font-extrabold text-white'
            : 'text-xl lg:text-2xl text-primary dark:text-white',
        )}>
          {article.article.replace(/_/g, ' ')}
        </h3>

        <div className="flex items-baseline gap-2">
          <span className={cx(
            'font-black font-mono tracking-tighter',
            hero ? 'text-4xl lg:text-5xl text-white' : 'text-3xl text-secondary dark:text-secondary-fixed-dim',
          )}>
            {fmt(article.total_views)}
          </span>
          <span className={cx(
            'text-xs font-medium uppercase tracking-widest font-mono',
            hero ? 'text-secondary-fixed' : 'text-on-surface-variant dark:text-slate-400',
          )}>
            Views
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Explore() {
  const [articles,      setArticles]      = useState([])
  const [projectList,   setProjectList]   = useState([])
  const [project,       setProject]       = useState('en.wikipedia.org')
  const [access,        setAccess]        = useState('all-access')
  const [page,          setPage]          = useState(1)
  const [loading,         setLoading]         = useState(true)
  const [loadError,       setLoadError]       = useState('')
  const [selected,        setSelected]        = useState(null)
  const [chartData,       setChartData]       = useState([])
  const [chartLoading,    setChartLoading]    = useState(false)
  const [chartError,      setChartError]      = useState('')
  const [timeRange,       setTimeRange]       = useState(null)
  const [showCompare,     setShowCompare]     = useState(false)
  const [compareQuery,    setCompareQuery]    = useState('')
  const [compareData,     setCompareData]     = useState([])
  const [compareLoading,  setCompareLoading]  = useState(false)

  // Fetch top articles when filters change
  useEffect(() => {
    setLoading(true)
    setLoadError('')
    setPage(1)
    getTopArticles(50, project, access)
      .then(data => setArticles(data.filter(a => a.article)))
      .catch(e => { setArticles([]); setLoadError(e.message || 'Failed to load articles') })
      .finally(() => setLoading(false))
  }, [project, access])

  // Populate project dropdown
  useEffect(() => {
    getProjectBreakdown()
      .then(data => setProjectList(data.filter(p => p.project && p.project !== 'unknown').slice(0, 12)))
      .catch(() => {})
  }, [])

  // Fetch chart data when an article is selected
  useEffect(() => {
    if (!selected) { setChartData([]); return }
    setChartLoading(true)
    setChartError('')
    getArticle(selected.article, project, access)
      .then(data => setChartData(data.map(r => ({ date: r.date, views: r.views }))))
      .catch(e => setChartError(e.message || 'Error loading chart data'))
      .finally(() => setChartLoading(false))
  }, [selected, project, access])

  // Fetch compare article data (merge by date with primary data)
  useEffect(() => {
    if (!compareQuery.trim() || !selected) { setCompareData([]); return }
    setCompareLoading(true)
    getTopArticles(50, project, access)
      .then(list => {
        const match = list.find(a => a.article.toLowerCase() === compareQuery.toLowerCase().replace(/ /g, '_'))
        if (!match) { setCompareData([]); setCompareLoading(false); return }
        return getArticle(match.article, project, access).then(rows => {
          const byDate = Object.fromEntries(rows.map(r => [r.date, r.views]))
          setCompareData(byDate)
          setCompareLoading(false)
        })
      })
      .catch(() => { setCompareData([]); setCompareLoading(false) })
  }, [compareQuery, project, access, selected])

  const top3         = articles.slice(0, 3)
  const tableData    = articles.slice(3)
  const totalPages   = Math.max(1, Math.ceil(tableData.length / ITEMS_PER_PAGE))
  const pageArticles = tableData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const Skeleton = ({ className }) => (
    <div className={cx('animate-pulse rounded bg-surface-container dark:bg-slate-700', className)} />
  )

  return (
    <div className="p-6 lg:p-8 bg-surface dark:bg-slate-950 min-h-full">
      <div className="max-w-7xl mx-auto">

        {/* ── Hero Podium ─────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="mb-8">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-primary dark:text-white tracking-tight font-display">
              World Leaderboard
            </h2>
            <p className="text-on-surface-variant dark:text-slate-400 font-medium mt-2">
              Top Wikipedia articles ranked by total views across the full dataset.
            </p>
          </div>

          {/* Podium grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {loading ? (
              <>
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-60 rounded-xl" />
              </>
            ) : (
              <>
                <PodiumCard article={top3[1]} rank={2} height="h-64" />
                <PodiumCard article={top3[0]} rank={1} height="h-80" hero />
                <PodiumCard article={top3[2]} rank={3} height="h-60" />
              </>
            )}
          </div>
        </section>

        {/* ── Filters Bar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-6 mb-8 bg-surface-container-lowest dark:bg-slate-900 p-6 rounded-xl shadow-sm">
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 ml-1">
                Language
              </label>
              <select
                value={project}
                onChange={e => setProject(e.target.value)}
                className="bg-surface-container-low dark:bg-slate-800 border-none rounded-lg text-sm font-bold text-primary dark:text-slate-200 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-container/30"
              >
                {projectList.map(p => (
                  <option key={p.project} value={p.project}>
                    {getLang(p.project)} ({p.project.split('.')[0].toUpperCase()})
                  </option>
                ))}
                {projectList.length === 0 && (
                  <option value="en.wikipedia.org">English (EN)</option>
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 ml-1">
                Access Type
              </label>
              <select
                value={access}
                onChange={e => setAccess(e.target.value)}
                className="bg-surface-container-low dark:bg-slate-800 border-none rounded-lg text-sm font-bold text-primary dark:text-slate-200 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-container/30"
              >
                <option value="all-access">All Access</option>
                <option value="desktop">Desktop Only</option>
                <option value="mobile-app">Mobile App</option>
                <option value="mobile-web">Mobile Web</option>
              </select>
            </div>
          </div>

          <div className="flex items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-500 font-mono">
              {loading ? '…' : `${articles.length} articles`}
            </span>
          </div>
        </div>

        {/* ── Load Error Banner ───────────────────────────────────── */}
        {loadError && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <X size={14} className="shrink-0" />
            {loadError}
          </div>
        )}

        {/* ── Trending Articles Table ──────────────────────────────── */}
        <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-8 py-6 border-b border-surface-container dark:border-slate-800">
            <h3 className="text-lg font-extrabold text-primary dark:text-white font-display">
              Trending Articles
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 dark:bg-slate-800/50">
                  <th className="py-4 px-8 text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.15em]">Rank</th>
                  <th className="py-4 px-4 text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.15em]">Article Title</th>
                  <th className="py-4 px-4 text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.15em]">Total Views</th>
                  <th className="py-4 px-4 text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.15em]">Avg Daily</th>
                  <th className="py-4 px-4 text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.15em] w-44 text-center">Trend</th>
                  <th className="py-4 px-8 text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.15em] text-right">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low dark:divide-slate-800">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td className="py-5 px-8"><Skeleton className="h-5 w-8" /></td>
                        <td className="py-5 px-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-40" />
                              <Skeleton className="h-2.5 w-20" />
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="py-5 px-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="py-5 px-4"><Skeleton className="h-8 w-28 mx-auto" /></td>
                        <td className="py-5 px-8"><Skeleton className="h-8 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  : pageArticles.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center font-mono text-xs text-slate-400">
                          No articles found for this filter.
                        </td>
                      </tr>
                    )
                    : pageArticles.map((art, i) => {
                        const rank  = (page - 1) * ITEMS_PER_PAGE + i + 4
                        const daily = Math.round(art.total_views / DATASET_DAYS)
                        const bars  = getSparkline(art.article)
                        const isSel = selected?.article === art.article

                        return (
                          <tr
                            key={art.article}
                            className={cx(
                              'group transition-colors',
                              isSel
                                ? 'bg-surface-container-low/60 dark:bg-slate-800/50'
                                : 'hover:bg-surface-container-low/30 dark:hover:bg-slate-800/30',
                            )}
                          >
                            <td className="py-5 px-8 font-black text-primary dark:text-slate-200 font-mono text-lg">
                              {String(rank).padStart(2, '0')}
                            </td>

                            <td className="py-5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold font-mono flex-shrink-0"
                                  style={{ background: `hsl(${(rank * 47) % 360}, 38%, 33%)` }}
                                >
                                  {art.article.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-primary dark:text-slate-200 max-w-[200px] truncate">
                                    {art.article.replace(/_/g, ' ')}
                                  </div>
                                  <div className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 uppercase tracking-wider font-mono">
                                    {getLang(art.project)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-5 px-4 font-bold text-sm text-primary dark:text-slate-200 font-mono">
                              {art.total_views.toLocaleString()}
                            </td>

                            <td className="py-5 px-4 font-medium text-sm text-on-surface-variant dark:text-slate-400 font-mono">
                              {fmt(daily)}
                            </td>

                            <td className="py-5 px-4">
                              <div className="flex items-end justify-center gap-1 h-8">
                                {bars.map((h, bi) => (
                                  <div
                                    key={bi}
                                    className={cx(
                                      'w-1.5 rounded-full',
                                      bi === bars.length - 1 ? 'bg-secondary' : 'bg-secondary-container',
                                    )}
                                    style={{ height: `${h}px` }}
                                  />
                                ))}
                              </div>
                            </td>

                            <td className="py-5 px-8 text-right">
                              <button
                                onClick={() => setSelected(isSel ? null : art)}
                                className={cx(
                                  'p-2 transition-colors',
                                  isSel
                                    ? 'text-secondary'
                                    : 'text-on-surface-variant hover:text-primary dark:hover:text-white',
                                )}
                                title="View chart"
                              >
                                <BarChart2 size={18} />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && tableData.length > 0 && (
            <div className="px-8 py-4 border-t border-surface-container dark:border-slate-800 flex justify-between items-center bg-surface-container-low/20 dark:bg-slate-800/20">
              <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest font-mono">
                Showing {Math.min((page - 1) * ITEMS_PER_PAGE + 1, tableData.length)}–{Math.min(page * ITEMS_PER_PAGE, tableData.length)} of {tableData.length} entries
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant/30 dark:border-slate-700 text-on-surface-variant dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={cx(
                      'w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all',
                      page === i + 1
                        ? 'bg-primary-container text-white shadow-sm'
                        : 'text-on-surface-variant dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant/30 dark:border-slate-700 text-on-surface-variant dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Article Chart Detail (expands when analytics clicked) ─ */}
        {selected && (
          <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden animate-fade-up">
            <div className="px-8 py-5 border-b border-surface-container dark:border-slate-800 flex flex-wrap gap-4 justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold text-primary dark:text-white font-display">
                  {selected.article.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-on-surface-variant dark:text-slate-400 font-mono mt-0.5">
                  Daily pageview time series · use the brush to zoom
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Time range buttons */}
                <div className="flex gap-1">
                  {TIME_RANGES.map(r => (
                    <button
                      key={r.label}
                      onClick={() => setTimeRange(r.days)}
                      className={cx(
                        'px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-colors',
                        timeRange === r.days
                          ? 'bg-primary-container text-white dark:bg-primary-fixed-dim dark:text-primary-container'
                          : 'text-on-surface-variant hover:bg-surface-container dark:text-slate-400 dark:hover:bg-slate-800',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {/* Compare toggle */}
                <button
                  onClick={() => { setShowCompare(c => !c); if (showCompare) { setCompareQuery(''); setCompareData([]) } }}
                  className={cx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                    showCompare
                      ? 'bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary-fixed-dim'
                      : 'text-on-surface-variant hover:bg-surface-container dark:text-slate-400 dark:hover:bg-slate-800',
                  )}
                >
                  <GitCompare size={13} /> Compare
                </button>
                {/* CSV export */}
                {chartData.length > 0 && (
                  <button
                    onClick={() => exportCSV(filterByRange(chartData, timeRange), `${selected.article}_views.csv`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-on-surface-variant hover:bg-surface-container dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download size={13} /> Export
                  </button>
                )}
                <button
                  onClick={() => { setSelected(null); setShowCompare(false); setCompareQuery(''); setCompareData([]) }}
                  className="p-1.5 text-on-surface-variant hover:text-primary dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Compare input */}
            {showCompare && (
              <div className="px-8 py-3 border-b border-surface-container dark:border-slate-800 flex items-center gap-3">
                <span className="text-[11px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest shrink-0">Compare with</span>
                <input
                  value={compareQuery}
                  onChange={e => setCompareQuery(e.target.value)}
                  placeholder="Article name (e.g. Barack_Obama)"
                  className={cx(
                    'flex-1 bg-surface-container dark:bg-slate-800 border border-surface-container-high dark:border-slate-700',
                    'rounded-lg px-3 py-2 text-sm text-on-surface dark:text-slate-200',
                    'focus:outline-none focus:ring-2 focus:ring-secondary/30 placeholder:text-slate-400',
                  )}
                />
                {compareLoading && <div className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin shrink-0" />}
              </div>
            )}

            <div className="p-6">
              {chartLoading ? (
                <div className="flex h-[300px] items-center justify-center font-mono text-xs text-slate-400">
                  Loading chart data…
                </div>
              ) : chartError ? (
                <div className="flex h-[300px] items-center justify-center font-mono text-xs text-red-400">
                  {chartError}
                </div>
              ) : chartData.length > 0 ? (() => {
                  const displayData = filterByRange(chartData, timeRange).map(d => ({
                    ...d,
                    ...(Object.keys(compareData).length > 0 ? { compare: compareData[d.date] } : {}),
                  }))
                  const hasCompare = showCompare && Object.keys(compareData).length > 0
                  return (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={displayData}>
                        <XAxis dataKey="date" interval={Math.floor(displayData.length / 10)} />
                        <YAxis tickFormatter={fmt} width={52} />
                        <Tooltip formatter={v => [fmt(v), 'Views']} />
                        {hasCompare && <Legend />}
                        <Line
                          type="monotone"
                          dataKey="views"
                          name={selected.article.replace(/_/g, ' ').slice(0, 20)}
                          stroke="var(--chart-1)"
                          strokeWidth={1.5}
                          dot={false}
                        />
                        {hasCompare && (
                          <Line
                            type="monotone"
                            dataKey="compare"
                            name={compareQuery.replace(/_/g, ' ').slice(0, 20)}
                            stroke="var(--chart-2)"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="4 2"
                          />
                        )}
                        <Brush dataKey="date" height={20} travellerWidth={5} />
                      </LineChart>
                    </ResponsiveContainer>
                  )
                })()
              : (
                <div className="flex h-[300px] items-center justify-center font-mono text-xs text-slate-400">
                  No chart data available
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
