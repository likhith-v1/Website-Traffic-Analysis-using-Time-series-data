import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getTopArticles } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx } from '../lib/utils'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : String(n)

const MEDAL = ['🥇', '🥈', '🥉']
const COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
]

const PROJECTS = [
  'en.wikipedia.org', 'de.wikipedia.org', 'fr.wikipedia.org',
  'es.wikipedia.org', 'ru.wikipedia.org', 'ja.wikipedia.org', 'zh.wikipedia.org',
]

export default function Leaderboard() {
  const [data,    setData]    = useState([])
  const [project, setProject] = useState('en.wikipedia.org')
  const [n,       setN]       = useState(20)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getTopArticles(n, project, 'all-access').then(d => { setData(d); setLoading(false) })
  }, [project, n])

  const max = data[0]?.total_views || 1

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        eyebrow="Ranking"
        title="Leaderboard"
        subtitle="Compare the highest-traffic articles across Wikipedia language projects and switch between quick ranking presets."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-4 py-3 mb-5 dark:border-gray-800 dark:bg-gray-950">
        <select
          value={project}
          onChange={e => setProject(e.target.value)}
          className={cx(
            'rounded-md border border-gray-200 bg-white px-3 py-2',
            'font-mono text-xs text-gray-700',
            'outline-none transition focus:border-blue-500',
            'dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300',
          )}
        >
          {PROJECTS.map(p => <option key={p} value={p}>{p.replace('.wikipedia.org', '')} Wikipedia</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {[10, 20, 50].map(v => (
            <button
              key={v}
              onClick={() => setN(v)}
              className={cx(
                'rounded-md border px-4 py-2 font-mono text-[11px] transition-colors',
                n === v
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400',
              )}
            >
              Top {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-16 text-center font-mono text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900/50">
          Loading from MongoDB…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SurfaceCard title="Top Articles" subtitle="Ranked by total views across the full date range.">
            {data.map((r, i) => (
              <div
                key={i}
                className={cx(
                  'flex items-center gap-3.5 py-2.5',
                  i < data.length - 1 && 'border-b border-gray-100 dark:border-gray-900',
                )}
              >
                <div className={cx(
                  'w-7 text-center font-mono text-xs shrink-0',
                  i < 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600',
                )}>
                  {i < 3 ? MEDAL[i] : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm text-gray-900 dark:text-gray-50 truncate">
                    {r.article.replace(/_/g, ' ').slice(0, 36)}{r.article.length > 36 ? '…' : ''}
                  </div>
                  <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-800 mt-1.5">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${(r.total_views / max) * 100}%`,
                        background: i === 0 ? COLORS[0] : i === 1 ? COLORS[1] : COLORS[2],
                      }}
                    />
                  </div>
                </div>
                <div className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0 min-w-[52px] text-right">
                  {fmt(r.total_views)}
                </div>
              </div>
            ))}
          </SurfaceCard>

          <SurfaceCard title="Visual Ranking" subtitle="The top 15 pages plotted for side-by-side comparison.">
            <ResponsiveContainer width="100%" height={Math.max(data.length * 28, 300)}>
              <BarChart data={data.slice(0, 15)} layout="vertical">
                <XAxis type="number" tickFormatter={fmt} />
                <YAxis type="category" dataKey="article" width={120}
                  tickFormatter={v => v.replace(/_/g, ' ').slice(0, 18)} />
                <Tooltip formatter={v => [fmt(v), 'Views']} />
                <Bar dataKey="total_views" radius={[0, 4, 4, 0]}>
                  {data.slice(0, 15).map((_, i) => (
                    <Cell key={i} fill={i < COLORS.length ? COLORS[i] : 'var(--chart-1)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>
        </div>
      )}
    </div>
  )
}
