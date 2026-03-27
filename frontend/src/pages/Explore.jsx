import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts'
import { getAggregatedDaily, getArticle } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx } from '../lib/utils'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : String(n)

const PRESETS = ['Main_Page', 'Special:Search', 'Albert_Einstein', 'Python_(programming_language)', 'Donald_Trump']

export default function Explore() {
  const [searchParams] = useSearchParams()
  const articleFromUrl = searchParams.get('article')
  const [mode,    setMode]    = useState('aggregated')
  const [article, setArticle] = useState(articleFromUrl || 'Main_Page')
  const [input,   setInput]   = useState(articleFromUrl || 'Main_Page')
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)
  const [stats,   setStats]   = useState(null)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
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
          avg: Math.round(views.reduce((a, b) => a + b, 0) / views.length),
          total: views.reduce((a, b) => a + b, 0), points: raw.length,
        })
      } else setStats(null)
    } catch (e) {
      setData([]); setStats(null); setError(e.message || 'Error loading data')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!articleFromUrl) return
    setMode('article'); setArticle(articleFromUrl); setInput(articleFromUrl)
  }, [articleFromUrl])

  useEffect(() => { load() }, [mode, article]) // eslint-disable-line

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        eyebrow="Interactive"
        title="Explore"
        subtitle="Switch between the aggregated traffic stream and individual articles, then zoom into patterns, spikes, and baseline behavior."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-4 py-3 mb-5 dark:border-gray-800 dark:bg-gray-950">
        {['aggregated', 'article'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cx(
              'rounded-md border px-4 py-2 font-mono text-[11px] transition-colors',
              mode === m
                ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400',
            )}
          >
            {m === 'aggregated' ? 'All English Pages' : 'Single Article'}
          </button>
        ))}

        {mode === 'article' && (
          <div className="flex flex-1 gap-2 flex-wrap" style={{ minWidth: 200 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setArticle(input)}
              placeholder="Article name e.g. Albert_Einstein"
              className={cx(
                'flex-1 rounded-md border border-gray-300 bg-white px-3 py-2',
                'font-mono text-[11px] text-gray-900 placeholder-gray-400',
                'outline-none transition',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
                'dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder-gray-500',
                'dark:focus:border-blue-700 dark:focus:ring-blue-700/30',
              )}
            />
            <button
              onClick={() => setArticle(input)}
              className="rounded-md bg-blue-500 px-4 py-2 font-display text-sm font-semibold text-white shadow-sm hover:bg-blue-600 transition-colors"
            >
              Go
            </button>
          </div>
        )}
      </div>

      {mode === 'article' && (
        <div className="flex flex-wrap gap-2 mb-5">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setInput(p); setArticle(p) }}
              className={cx(
                'rounded-full border px-3 py-1 font-mono text-[10px] transition-colors',
                article === p
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400',
              )}
            >
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            ['Data Points', stats.points],
            ['Total Views', fmt(stats.total)],
            ['Daily Avg',   fmt(stats.avg)],
            ['Peak',        fmt(stats.max)],
            ['Minimum',     fmt(stats.min)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">{l}</div>
              <div className="font-display font-bold text-lg text-blue-600 dark:text-blue-400">{v}</div>
            </div>
          ))}
        </div>
      )}

      <SurfaceCard
        title={mode === 'aggregated' ? 'Aggregated Daily Traffic' : article.replace(/_/g, ' ')}
        subtitle="Use the brush control below the chart to zoom into any time window."
      >
        {loading ? (
          <div className="flex h-[400px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900/50">
            Loading data from MongoDB…
          </div>
        ) : error ? (
          <div className="flex h-[400px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs text-red-500 dark:border-gray-800 dark:bg-gray-900/50">
            {error}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <XAxis dataKey="date" interval={Math.floor(data.length / 12)} />
              <YAxis tickFormatter={fmt} width={62} />
              <Tooltip formatter={v => [fmt(v), 'Views']} />
              <Line type="monotone" dataKey="views" stroke="var(--chart-line)" strokeWidth={1.5} dot={false} />
              <Brush dataKey="date" height={22} travellerWidth={5} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SurfaceCard>
    </div>
  )
}
