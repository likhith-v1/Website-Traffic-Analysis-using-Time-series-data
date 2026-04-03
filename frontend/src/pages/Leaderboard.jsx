import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getTopArticles } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx, fmt, PROJECTS, exportCSV } from '../lib/utils'
import { Download } from 'lucide-react'

const MEDAL = ['🥇', '🥈', '🥉']
const COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
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
    <div className="p-6 lg:p-8 bg-surface dark:bg-slate-950 min-h-full">
      <PageHeader
        eyebrow="Ranking"
        title="Leaderboard"
        subtitle="Compare the highest-traffic articles across Wikipedia language projects and switch between quick ranking presets."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-surface-container bg-surface-container-lowest px-4 py-3 mb-5 dark:border-slate-800 dark:bg-slate-900">
        <select
          value={project}
          onChange={e => setProject(e.target.value)}
          className={cx(
            'rounded-lg border border-surface-container bg-surface-container-low px-3 py-2',
            'font-mono text-xs text-on-surface',
            'outline-none transition focus:ring-2 focus:ring-primary-container/25',
            'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
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
                'rounded-lg border px-4 py-2 font-mono text-[11px] transition-colors',
                n === v
                  ? 'border-secondary/30 bg-secondary/5 text-secondary dark:border-secondary/20 dark:bg-secondary/10 dark:text-secondary-fixed-dim'
                  : 'border-surface-container text-on-surface-variant hover:border-outline-variant hover:text-on-surface dark:border-slate-800 dark:text-slate-400',
              )}
            >
              Top {v}
            </button>
          ))}
        </div>
        {data.length > 0 && (
          <button
            onClick={() => exportCSV(data.map(r => ({ rank: data.indexOf(r) + 1, article: r.article, total_views: r.total_views })), `leaderboard_${project.split('.')[0]}_top${n}.csv`)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-surface-container px-3 py-2 font-mono text-[11px] text-on-surface-variant hover:text-primary hover:border-outline dark:border-slate-800 dark:text-slate-400 transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1].map(k => (
            <div key={k} className="rounded-xl border border-surface-container bg-surface-container-lowest p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="animate-pulse rounded bg-surface-container dark:bg-slate-700 h-4 w-6 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="animate-pulse rounded bg-surface-container dark:bg-slate-700 h-3.5" style={{ width: `${55 + (i * 7) % 35}%` }} />
                      <div className="animate-pulse rounded bg-surface-container dark:bg-slate-800 h-1 w-full" />
                    </div>
                    <div className="animate-pulse rounded bg-surface-container dark:bg-slate-700 h-4 w-12 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SurfaceCard title="Top Articles" subtitle="Ranked by total views across the full date range.">
            {data.map((r, i) => (
              <div
                key={i}
                className={cx(
                  'flex items-center gap-3.5 py-2.5',
                  i < data.length - 1 && 'border-b border-surface-container-low dark:border-slate-900',
                )}
              >
                <div className={cx(
                  'w-7 text-center font-mono text-xs shrink-0',
                  i < 3 ? 'text-primary-container dark:text-primary-fixed-dim' : 'text-on-surface-variant dark:text-slate-600',
                )}>
                  {i < 3 ? MEDAL[i] : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm text-primary dark:text-white truncate">
                    {r.article.replace(/_/g, ' ').slice(0, 36)}{r.article.length > 36 ? '…' : ''}
                  </div>
                  <div className="h-1 rounded-full bg-surface-container dark:bg-slate-800 mt-1.5">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${(r.total_views / max) * 100}%`,
                        background: i === 0 ? COLORS[0] : i === 1 ? COLORS[1] : COLORS[2],
                      }}
                    />
                  </div>
                </div>
                <div className="font-mono text-xs text-primary-container dark:text-primary-fixed-dim shrink-0 min-w-[52px] text-right">
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
