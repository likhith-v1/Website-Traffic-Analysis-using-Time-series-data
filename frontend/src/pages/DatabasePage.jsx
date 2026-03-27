import { useEffect, useState } from 'react'
import { getStats, getProjectBreakdown, getAccessBreakdown } from '../api/client'
import { Database, HardDrive, Layers, Globe } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx } from '../lib/utils'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : String(n)

const Row = ({ label, value, accent }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-900 last:border-0">
    <span className="font-body text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className={cx(
      'font-mono text-sm',
      accent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-50',
    )}>
      {value}
    </span>
  </div>
)

const INDEXES = [
  { name: 'article_date',              desc: 'Primary lookup — article + date range' },
  { name: 'project_date',              desc: 'Filter by language project + date' },
  { name: 'access_date',               desc: 'Filter by access type + date' },
  { name: 'year_month',                desc: 'Group by year/month for aggregation' },
  { name: 'date',                      desc: 'Date-only range scans' },
  { name: 'views_desc',                desc: 'Sort by views descending (leaderboard)' },
  { name: 'project_access_date_views', desc: 'Dashboard compound filter + sort' },
  { name: '_id_',                      desc: 'Default MongoDB _id index' },
]

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
]

export default function DatabasePage() {
  const [stats,    setStats]    = useState(null)
  const [projects, setProjects] = useState([])

  useEffect(() => {
    getStats().then(setStats)
    getProjectBreakdown().then(d => setProjects(d.filter(p => p.project !== 'unknown')))
    getAccessBreakdown()
  }, [])

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        eyebrow="Infrastructure"
        title="Database"
        subtitle="A more readable snapshot of the MongoDB collection, indexing strategy, and language distribution behind the dashboard."
        actions={<Database size={18} className="text-blue-600 dark:text-blue-400" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Collection Stats */}
        <SurfaceCard accent="highlight">
          <div className="flex items-center gap-2 mb-5">
            <HardDrive size={15} className="text-blue-600 dark:text-blue-400" />
            <span className="font-display text-[15px] font-semibold text-gray-900 dark:text-gray-50">
              Collection Stats
            </span>
          </div>
          {stats ? (
            <>
              <Row label="Documents"         value={fmt(stats.documents)} accent />
              <Row label="Storage Size"      value={stats.size_gb + ' GB'} />
              <Row label="Indexes"           value={stats.indexes} />
              <Row label="Date Range"        value={`${stats.date_range.start} → ${stats.date_range.end}`} />
              <Row label="Language Projects" value={stats.projects} />
              <Row label="Database"          value="wikipedia_traffic" />
              <Row label="Collection"        value="pageviews" />
            </>
          ) : (
            <div className="font-mono text-xs text-gray-400 dark:text-gray-500">Loading…</div>
          )}
        </SurfaceCard>

        {/* Indexes */}
        <SurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <Layers size={15} className="text-cyan-600 dark:text-cyan-400" />
            <span className="font-display text-[15px] font-semibold text-gray-900 dark:text-gray-50">
              Indexes ({INDEXES.length})
            </span>
          </div>
          {INDEXES.map((idx, i) => (
            <div
              key={i}
              className={cx(
                'py-2.5',
                i < INDEXES.length - 1 && 'border-b border-gray-100 dark:border-gray-900',
              )}
            >
              <div className="font-mono text-xs text-blue-600 dark:text-blue-400">{idx.name}</div>
              <div className="font-body text-xs text-gray-500 dark:text-gray-400 mt-0.5">{idx.desc}</div>
            </div>
          ))}
        </SurfaceCard>

        {/* Views by Language */}
        <SurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <Globe size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-display text-[15px] font-semibold text-gray-900 dark:text-gray-50">
              Views by Language
            </span>
          </div>
          {projects.length > 0 ? projects.map((p, i) => {
            const total = projects.reduce((s, x) => s + x.total_views, 0)
            const pct = ((p.total_views / total) * 100).toFixed(1)
            return (
              <div key={i} className="mb-3.5">
                <div className="flex justify-between mb-1.5">
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {p.project?.replace('.wikipedia.org', '') || 'unknown'}
                  </span>
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {fmt(p.total_views)} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            )
          }) : (
            <div className="font-mono text-xs text-gray-400 dark:text-gray-500">Loading…</div>
          )}
        </SurfaceCard>

        {/* Document Schema */}
        <SurfaceCard
          title="Document Schema"
          subtitle="Representative shape of a pageview document stored in MongoDB."
        >
          <pre className="rounded-md bg-gray-50 p-4 font-mono text-xs text-gray-700 overflow-auto leading-relaxed dark:bg-gray-900/50 dark:text-gray-300">{`{
  "article":     "Main_Page",
  "project":     "en.wikipedia.org",
  "access":      "all-access",
  "agent":       "all-agents",
  "date":        "2016-03-15",
  "views":       4521893,
  "year":        2016,
  "month":       3,
  "day":         15,
  "day_of_week": 1,
  "week":        11
}`}</pre>
        </SurfaceCard>

      </div>
    </div>
  )
}
