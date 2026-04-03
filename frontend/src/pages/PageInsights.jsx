import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, TrendingUp, TrendingDown, Smartphone, Monitor,
  Zap, BarChart2, Activity, Layers,
} from 'lucide-react'
import {
  LineChart, AreaChart, Line, Area,
  XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, Brush, CartesianGrid,
} from 'recharts'
import { searchArticles, getArticle } from '../api/client'
import { cx, fmt, PROJECTS } from '../lib/utils'

/* ── helpers ──────────────────────────────────────────────────── */
const fmtDate = d => {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

/* ── custom tooltip ───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-primary-container text-white px-4 py-3 rounded-xl shadow-xl text-xs min-w-[170px] pointer-events-none">
      <p className="font-bold mb-2.5 font-mono text-secondary-fixed">{fmtDate(label)}</p>
      <div className="space-y-1.5">
        {payload.map(p => (
          <div key={p.dataKey} className="flex justify-between gap-8">
            <span className="opacity-70">{p.name}</span>
            <span className="font-mono font-bold">{p.value != null ? p.value.toLocaleString() : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── skeleton ─────────────────────────────────────────────────── */
function Sk({ className }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-container dark:bg-slate-800', className)} />
}

/* ── main component ───────────────────────────────────────────── */
export default function PageInsights() {
  const [searchParams] = useSearchParams()
  const [query,         setQuery]         = useState(() => searchParams.get('q') || '')
  const [project,       setProject]       = useState('en.wikipedia.org')
  const [suggestions,   setSuggestions]   = useState([])
  const [sugLoading,    setSugLoading]    = useState(false)
  const [showDrop,      setShowDrop]      = useState(false)

  const [article,       setArticle]       = useState(null)
  const [chartData,     setChartData]     = useState([])
  const [dataLoading,   setDataLoading]   = useState(false)
  const [dataError,     setDataError]     = useState('')
  const [chartType,     setChartType]     = useState('line')

  const [focusedIdx,    setFocusedIdx]    = useState(-1)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchMsg,     setSearchMsg]     = useState('')

  const timerRef      = useRef(null)
  const dropRef       = useRef(null)
  const abortRef      = useRef(null)
  const searchAbortRef = useRef(null)

  /* debounced autocomplete with AbortController */
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowDrop(false); setFocusedIdx(-1); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      setSugLoading(true)
      try {
        const res = await searchArticles(query, project, abortRef.current.signal)
        setSuggestions(res.slice(0, 8))
        setShowDrop(true)
        setFocusedIdx(-1)
      } catch (e) {
        if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') setSuggestions([])
      }
      setSugLoading(false)
    }, 320)
    return () => clearTimeout(timerRef.current)
  }, [query, project])

  /* close dropdown on outside click */
  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  /* load article data (3 access types in parallel) */
  const loadArticle = useCallback(async art => {
    setArticle(art)
    setQuery(art.article.replace(/_/g, ' '))
    setShowDrop(false)
    setDataLoading(true)
    setDataError('')
    setChartData([])

    try {
      const [totalR, desktopR, mobileR] = await Promise.all([
        getArticle(art.article, project, 'all-access'),
        getArticle(art.article, project, 'desktop'),
        getArticle(art.article, project, 'mobile-web'),
      ])

      const byDate = {}
      totalR.forEach(r   => { byDate[r.date] = { date: r.date, total: r.views } })
      desktopR.forEach(r => { if (byDate[r.date]) byDate[r.date].desktop = r.views; else byDate[r.date] = { date: r.date, desktop: r.views } })
      mobileR.forEach(r  => { if (byDate[r.date]) byDate[r.date].mobile  = r.views; else byDate[r.date] = { date: r.date, mobile:  r.views } })

      setChartData(
        Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
      )
    } catch (e) {
      setDataError(e.message || 'Failed to load article data')
    }
    setDataLoading(false)
  }, [project])

  useEffect(() => {
    if (article) loadArticle(article)
  }, [project])

  /* explicit search — independent abort ref, shows errors */
  const handleSearch = useCallback(async () => {
    if (query.length < 2) return
    // cancel any pending autocomplete debounce
    clearTimeout(timerRef.current)
    setSuggestions([])
    setShowDrop(false)
    setSearchMsg('')
    // cancel any previous explicit search
    searchAbortRef.current?.abort()
    searchAbortRef.current = new AbortController()
    setSearchLoading(true)
    try {
      const res = await searchArticles(query, project, searchAbortRef.current.signal)
      if (res.length > 0) {
        loadArticle(res[0])
      } else {
        setSearchMsg(`No articles found for "${query}" in ${project.replace('.wikipedia.org', '')} Wikipedia.`)
      }
    } catch (e) {
      if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
        setSearchMsg(e.message || 'Search failed — is the backend running?')
      }
    }
    setSearchLoading(false)
  }, [query, project, loadArticle])

  /* computed metrics */
  const metrics = useMemo(() => {
    if (!chartData.length) return null
    const totals = chartData.map(d => d.total ?? 0)
    const totalViews = totals.reduce((s, v) => s + v, 0)

    const peakIdx = totals.indexOf(Math.max(...totals))
    const positives = totals.filter(v => v > 0)
    const lowestVal = positives.length > 0 ? Math.min(...positives) : 0
    const lowIdx = positives.length > 0 ? totals.indexOf(lowestVal) : 0

    const last30 = totals.slice(-30)
    const avg30 = Math.round(last30.reduce((s, v) => s + v, 0) / (last30.length || 1))

    const overallAvg = Math.round(totalViews / (totals.length || 1))
    const peakPct = overallAvg > 0 ? (((totals[peakIdx] - overallAvg) / overallAvg) * 100).toFixed(1) : '0'

    const y15 = chartData.filter(d => d.date?.startsWith('2015')).map(d => d.total ?? 0)
    const y16 = chartData.filter(d => d.date?.startsWith('2016')).map(d => d.total ?? 0)
    const avg15 = y15.length ? y15.reduce((s, v) => s + v, 0) / y15.length : 0
    const avg16 = y16.length ? y16.reduce((s, v) => s + v, 0) / y16.length : 0
    const yoy = avg15 > 0 ? (((avg16 - avg15) / avg15) * 100).toFixed(1) : null

    const totalMobile = chartData.reduce((s, d) => s + (d.mobile ?? 0), 0)
    const mobilePct = totalViews > 0 ? Math.round((totalMobile / totalViews) * 100) : 0
    const desktopPct = 100 - mobilePct

    return {
      totalViews, peakDay: chartData[peakIdx]?.date,
      peakViews: totals[peakIdx], peakPct,
      lowestDay: chartData[lowIdx]?.date, lowestViews: totals[lowIdx],
      avg30, yoy, mobilePct, desktopPct,
      peakBarPct: totals[peakIdx] > 0 ? Math.round((avg30 / totals[peakIdx]) * 100) : 0,
    }
  }, [chartData])

  const xInterval = chartData.length > 0 ? Math.max(1, Math.floor(chartData.length / 8)) : 'preserveStartEnd'

  /* shared chart props */
  const sharedLines = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="date" interval={xInterval} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
      <YAxis tickFormatter={fmt} width={50} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
      <ReTooltip content={<ChartTooltip />} />
    </>
  )

  return (
    <div className="p-6 lg:p-8 bg-surface dark:bg-slate-950 min-h-full">
      <div className="max-w-7xl mx-auto">

        {/* ── Page header + search ─────────────────────────────── */}
        <section className="mb-10">
          <div className="mb-7">
            <div className="flex items-center gap-2 text-secondary mb-2">
              <Zap size={13} />
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] font-bold">In-Depth Analysis</span>
            </div>
            <h2 className="text-4xl font-extrabold text-primary dark:text-white tracking-tight font-display">
              Page Insights
            </h2>
            <p className="text-on-surface-variant dark:text-slate-400 mt-2 text-sm">
              Deep-dive into any article's traffic patterns, platform breakdown, and growth metrics.
            </p>
          </div>

          {/* Search bar */}
          <div ref={dropRef} className="relative max-w-2xl">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setFocusedIdx(-1); setSearchMsg('') }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (showDrop && suggestions.length) {
                        const t = focusedIdx >= 0 ? suggestions[focusedIdx] : suggestions[0]
                        if (t) loadArticle(t)
                      } else {
                        handleSearch()
                      }
                    } else if (showDrop && suggestions.length) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, suggestions.length - 1)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)) }
                      else if (e.key === 'Escape') { setShowDrop(false); setFocusedIdx(-1) }
                    }
                  }}
                  placeholder="Search any Wikipedia article…"
                  className={cx(
                    'w-full bg-surface-container-lowest dark:bg-slate-900',
                    'border border-surface-container-high dark:border-slate-700',
                    'rounded-xl py-3.5 pl-12 pr-4 text-sm shadow-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary-container/25',
                    'placeholder:text-slate-400 text-on-surface dark:text-slate-200 transition-all',
                  )}
                />
                {sugLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
                )}
              </div>
              <select
                value={project}
                onChange={e => setProject(e.target.value)}
                className={cx(
                  'bg-surface-container-lowest dark:bg-slate-900',
                  'border border-surface-container-high dark:border-slate-700',
                  'rounded-xl px-4 py-3.5 text-sm font-bold shadow-sm',
                  'text-primary dark:text-slate-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary-container/25 transition-all',
                )}
              >
                {PROJECTS.map(p => (
                  <option key={p} value={p}>{p.replace('.wikipedia.org', '').toUpperCase()}</option>
                ))}
              </select>
              <button
                onClick={handleSearch}
                disabled={query.length < 2 || searchLoading}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-5 py-3.5',
                  'bg-primary-container text-white text-sm font-bold shadow-sm',
                  'transition-all hover:opacity-90 flex-shrink-0',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {searchLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Search size={15} />
                }
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>

            {/* Search error / no-results feedback */}
            {searchMsg && !searchLoading && (
              <p className="mt-3 text-sm font-mono text-red-500 dark:text-red-400 px-1">{searchMsg}</p>
            )}

            {/* Autocomplete dropdown */}
            {showDrop && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-[6.5rem] mt-2 bg-surface-container-lowest dark:bg-slate-900 border border-surface-container-high dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-down-fade">
                {suggestions.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => loadArticle(r)}
                    className={cx(
                      'w-full flex items-center justify-between px-4 py-3 text-sm transition-colors text-left border-b border-surface-container-low dark:border-slate-800 last:border-0',
                      i === focusedIdx
                        ? 'bg-surface-container dark:bg-slate-700'
                        : 'hover:bg-surface-container-low dark:hover:bg-slate-800',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-mono flex-shrink-0"
                        style={{ background: `hsl(${(r.article.charCodeAt(0) * 23) % 360}, 38%, 33%)` }}
                      >
                        {r.article.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-on-surface dark:text-slate-200 truncate">
                        {r.article.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-secondary dark:text-secondary-fixed-dim flex-shrink-0 ml-4">
                      {fmt(r.total_views)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Empty state ──────────────────────────────────────── */}
        {!article && !dataLoading && (
          <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl border border-surface-container dark:border-slate-800 px-8 py-28 text-center">
            <div className="w-16 h-16 bg-surface-container-low dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Layers size={28} className="text-on-surface-variant dark:text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-2 font-display">
              Start by searching for an article
            </h3>
            <p className="text-on-surface-variant dark:text-slate-400 text-sm max-w-md mx-auto">
              Type any Wikipedia article name above to load its complete traffic analysis, platform split, and key metrics.
            </p>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────── */}
        {dataLoading && (
          <div className="grid grid-cols-12 gap-6 animate-fade-in">
            <div className="col-span-12 lg:col-span-9 space-y-6">
              <Sk className="h-[420px]" />
              <div className="grid grid-cols-2 gap-6">
                <Sk className="h-28" />
                <Sk className="h-28" />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-3 space-y-6">
              <Sk className="h-80" />
              <Sk className="h-44" />
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {dataError && !dataLoading && (
          <div className="bg-error-container/20 border border-error/20 rounded-xl px-6 py-10 text-center">
            <p className="font-mono text-sm text-error">{dataError}</p>
          </div>
        )}

        {/* ── Full insights view ───────────────────────────────── */}
        {article && !dataLoading && !dataError && chartData.length > 0 && (
          <>
            {/* Article header */}
            <section className="mb-8 animate-fade-up">
              <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-secondary mb-2">
                    <Zap size={13} />
                    <span className="text-[10px] font-mono uppercase tracking-[0.22em] font-bold">
                      Wikipedia · {project.split('.')[0].toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-4xl font-extrabold text-primary dark:text-white tracking-tight font-display">
                    {article.article.replace(/_/g, ' ')}
                  </h2>
                  <p className="text-on-surface-variant dark:text-slate-400 mt-2 text-sm max-w-2xl">
                    Comparative breakdown of platform engagement and growth dynamics across the full dataset.
                  </p>
                </div>
                <div className="bg-surface-container-lowest dark:bg-slate-900 border border-surface-container-high dark:border-slate-700 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase leading-none tracking-widest">Status</span>
                    <span className="text-sm font-bold text-primary dark:text-white">Live Data</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
            </section>

            {/* Bento grid */}
            <div className="grid grid-cols-12 gap-6 items-start animate-fade-up">

              {/* ── Main chart panel ──────────────────────────── */}
              <div className="col-span-12 lg:col-span-9 space-y-6">
                <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 lg:p-8 border border-surface-container dark:border-slate-800 shadow-sm">

                  {/* Chart header */}
                  <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                    <div className="flex gap-6 flex-wrap items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                          Full Dataset · {chartData.length} days
                        </span>
                        <span className="text-2xl font-mono font-bold text-primary dark:text-white">
                          {metrics ? fmt(metrics.totalViews) : '—'}
                          <span className="text-xs font-normal text-slate-400 ml-2">total views</span>
                        </span>
                      </div>
                      <div className="hidden sm:block w-px h-10 bg-surface-container dark:bg-slate-700" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Platform Split</span>
                        <div className="flex items-center gap-4">
                          {[
                            { key: 'total',   label: 'Total',   color: 'bg-[var(--chart-1)]' },
                            { key: 'mobile',  label: 'Mobile',  color: 'bg-[var(--chart-2)]' },
                            { key: 'desktop', label: 'Desktop', color: 'bg-[var(--chart-3)]' },
                          ].map(({ key, label, color }) => (
                            <div key={key} className="flex items-center gap-1.5">
                              <div className={cx('w-2.5 h-2.5 rounded-full', color)} />
                              <span className="text-xs font-bold text-on-surface-variant dark:text-slate-400">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Line / Area toggle */}
                    <div className="flex gap-1 bg-surface-container-low dark:bg-slate-800 p-1 rounded-lg">
                      {['Line', 'Area'].map(t => (
                        <button
                          key={t}
                          onClick={() => setChartType(t.toLowerCase())}
                          className={cx(
                            'px-3.5 py-1.5 text-xs font-bold rounded-md transition-all',
                            chartType === t.toLowerCase()
                              ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white',
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recharts */}
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'area' ? (
                        <AreaChart data={chartData}>
                          <defs>
                            {['chart-1', 'chart-2'].map(v => (
                              <linearGradient key={v} id={`grad-${v}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={`var(--${v})`} stopOpacity={0.18} />
                                <stop offset="95%" stopColor={`var(--${v})`} stopOpacity={0}    />
                              </linearGradient>
                            ))}
                          </defs>
                          {sharedLines}
                          <Area type="monotone" dataKey="total"   name="Total"   stroke="var(--chart-1)" fill="url(#grad-chart-1)" strokeWidth={2.5} dot={false} />
                          <Area type="monotone" dataKey="mobile"  name="Mobile"  stroke="var(--chart-2)" fill="url(#grad-chart-2)" strokeWidth={2}   dot={false} />
                          <Area type="monotone" dataKey="desktop" name="Desktop" stroke="var(--chart-3)" fill="none"               strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                          <Brush dataKey="date" height={20} travellerWidth={5} />
                        </AreaChart>
                      ) : (
                        <LineChart data={chartData}>
                          {sharedLines}
                          <Line type="monotone" dataKey="total"   name="Total"   stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="mobile"  name="Mobile"  stroke="var(--chart-2)" strokeWidth={2}   dot={false} />
                          <Line type="monotone" dataKey="desktop" name="Desktop" stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                          <Brush dataKey="date" height={20} travellerWidth={5} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Secondary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-surface-container-low dark:bg-slate-900 border border-surface-container dark:border-slate-800 rounded-xl p-6 flex items-center gap-5">
                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Smartphone size={22} className="text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Platform Preference</p>
                      <h4 className="text-lg font-bold text-primary dark:text-white leading-tight">
                        {metrics?.mobilePct ?? '—'}%{' '}
                        <span className="text-secondary text-sm font-bold">Mobile Dominance</span>
                      </h4>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-1">
                        Mobile outpaces desktop by{' '}
                        {metrics && metrics.desktopPct > 0
                          ? (metrics.mobilePct / metrics.desktopPct).toFixed(1) + 'x'
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-container-low dark:bg-slate-900 border border-surface-container dark:border-slate-800 rounded-xl p-6 flex items-center gap-5">
                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Monitor size={22} className="text-primary-container dark:text-primary-fixed-dim" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Dataset Span</p>
                      <h4 className="text-lg font-bold text-primary dark:text-white leading-tight">
                        {chartData.length} Daily Points
                      </h4>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-1 font-mono">
                        {chartData[0]?.date} → {chartData.at(-1)?.date}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right sidebar ─────────────────────────────── */}
              <aside className="col-span-12 lg:col-span-3 space-y-6">

                {/* Key metrics card */}
                <div className="bg-primary-container rounded-xl p-6 relative overflow-hidden">
                  <div className="relative z-10 space-y-5">
                    <p className="text-[10px] font-bold text-on-primary-container uppercase tracking-widest">
                      Key Metrics Summary
                    </p>

                    <div>
                      <p className="text-xs text-on-primary-container mb-1 opacity-60">Peak Traffic Day</p>
                      <p className="text-2xl font-mono font-bold text-white leading-none">
                        {metrics?.peakDay ? fmtDate(metrics.peakDay) : '—'}
                      </p>
                      <p className="text-[11px] font-bold text-secondary-fixed mt-1">
                        +{metrics?.peakPct}% vs avg · {metrics ? fmt(metrics.peakViews) : '—'}
                      </p>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div>
                      <p className="text-xs text-on-primary-container mb-1 opacity-60">30-Day Moving Avg</p>
                      <p className="text-2xl font-mono font-bold text-white">{metrics ? fmt(metrics.avg30) : '—'}</p>
                      <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary-fixed rounded-full transition-all duration-700"
                          style={{ width: `${metrics?.peakBarPct ?? 0}%` }}
                        />
                      </div>
                    </div>

                    {metrics?.yoy != null && (
                      <>
                        <div className="h-px bg-white/10" />
                        <div>
                          <p className="text-xs text-on-primary-container mb-1 opacity-60">Year-over-Year Growth</p>
                          <div className="flex items-center gap-2">
                            {parseFloat(metrics.yoy) >= 0
                              ? <TrendingUp  size={18} className="text-secondary-fixed" />
                              : <TrendingDown size={18} className="text-red-300" />
                            }
                            <p className="text-3xl font-mono font-bold text-white">
                              {Math.abs(parseFloat(metrics.yoy)).toFixed(1)}%
                            </p>
                          </div>
                          <p className="text-[10px] text-on-primary-container opacity-50 mt-0.5">2015 → 2016 avg daily</p>
                        </div>
                      </>
                    )}

                    <div className="h-px bg-white/10" />

                    <div>
                      <p className="text-xs text-on-primary-container mb-1 opacity-60">Lowest Traffic Day</p>
                      <p className="text-xl font-mono font-bold text-slate-400 leading-none">
                        {metrics?.lowestDay ? fmtDate(metrics.lowestDay) : '—'}
                        <span className="text-xs font-normal opacity-50 ml-1.5">
                          ({metrics ? fmt(metrics.lowestViews) : '—'})
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* decorative glow */}
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* CTA card */}
                <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-6 border border-surface-container dark:border-slate-800">
                  <h5 className="font-bold text-primary dark:text-white mb-2">Explore Further</h5>
                  <p className="text-xs text-on-surface-variant dark:text-slate-400 mb-5">
                    Run the full forecasting pipeline (ARIMA, SARIMA, Holt-Winters) or compare this article in the leaderboard.
                  </p>
                  <div className="space-y-2.5">
                    <a
                      href="/models"
                      className={cx(
                        'w-full flex items-center justify-center gap-2',
                        'border-2 border-primary-container dark:border-slate-600',
                        'text-primary-container dark:text-slate-200',
                        'py-2.5 rounded-lg text-xs font-bold transition-all',
                        'hover:bg-primary-container hover:text-white dark:hover:bg-slate-700',
                      )}
                    >
                      <Activity size={13} />
                      Run Forecast Pipeline
                    </a>
                    <a
                      href="/explore"
                      className={cx(
                        'w-full flex items-center justify-center gap-2',
                        'border border-surface-container dark:border-slate-700',
                        'text-on-surface-variant dark:text-slate-400',
                        'py-2.5 rounded-lg text-xs font-bold transition-all',
                        'hover:bg-surface-container-low dark:hover:bg-slate-800',
                      )}
                    >
                      <BarChart2 size={13} />
                      Compare in Leaderboard
                    </a>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
