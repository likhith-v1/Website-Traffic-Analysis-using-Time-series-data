import { useEffect, useState } from 'react'
import { getStats, getProjectBreakdown } from '../api/client'
import { Database, HardDrive, Layers, Globe } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx, fmt } from '../lib/utils'

const Skeleton = ({ className }) => (
  <div className={cx('animate-pulse rounded bg-surface-container dark:bg-slate-700', className)} />
)

const Row = ({ label, value, accent }) => (
  <div className="flex items-center justify-between py-3 border-b border-surface-container-low dark:border-slate-900 last:border-0">
    <span className="font-body text-sm text-on-surface-variant dark:text-slate-400">{label}</span>
    <span className={cx(
      'font-mono text-sm',
      accent ? 'text-primary-container dark:text-primary-fixed-dim' : 'text-primary dark:text-white',
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
  { name: 'article_text',              desc: 'Text index on article name (pageviews)' },
  { name: '_id_',                      desc: 'Default MongoDB _id index' },
]

const SEARCH_INDEXES = [
  { name: 'article_words_text', desc: 'Text search on article_search collection' },
  { name: 'project_views',      desc: 'Filter by project, sort by views' },
]

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
]

export default function DatabasePage() {
  const [stats,    setStats]    = useState(null)
  const [projects, setProjects] = useState([])

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    getProjectBreakdown()
      .then(d => setProjects(d.filter(p => p.project)))
      .catch(() => {})
  }, [])

  return (
    <div className="p-6 lg:p-8 bg-surface dark:bg-slate-950 min-h-full">
      <PageHeader
        eyebrow="Infrastructure"
        title="Database"
        subtitle="A more readable snapshot of the MongoDB collection, indexing strategy, and language distribution behind the dashboard."
        actions={<Database size={18} className="text-primary-container dark:text-primary-fixed-dim" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Collection Stats */}
        <SurfaceCard accent="highlight">
          <div className="flex items-center gap-2 mb-5">
            <HardDrive size={15} className="text-primary-container dark:text-primary-fixed-dim" />
            <span className="font-display text-[15px] font-semibold text-primary dark:text-white">
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
            <div className="space-y-3.5 pt-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-surface-container-low dark:border-slate-900 last:border-0">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        {/* Indexes */}
        <SurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <Layers size={15} className="text-tertiary dark:text-tertiary-fixed-dim" />
            <span className="font-display text-[15px] font-semibold text-primary dark:text-white">
              Indexes ({INDEXES.length})
            </span>
          </div>
          {INDEXES.map((idx, i) => (
            <div
              key={i}
              className={cx(
                'py-2.5',
                i < INDEXES.length - 1 && 'border-b border-surface-container-low dark:border-slate-900',
              )}
            >
              <div className="font-mono text-xs text-primary-container dark:text-primary-fixed-dim">{idx.name}</div>
              <div className="font-body text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">{idx.desc}</div>
            </div>
          ))}
        </SurfaceCard>

        {/* Views by Language */}
        <SurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <Globe size={15} className="text-secondary dark:text-secondary-fixed-dim" />
            <span className="font-display text-[15px] font-semibold text-primary dark:text-white">
              Views by Language
            </span>
          </div>
          {projects.length > 0 ? projects.map((p, i) => { // eslint-disable-line no-shadow
            const total = projects.reduce((s, x) => s + x.total_views, 0)
            const pct = ((p.total_views / total) * 100).toFixed(1)
            return (
              <div key={i} className="mb-3.5">
                <div className="flex justify-between mb-1.5">
                  <span className="font-mono text-xs text-on-surface dark:text-slate-300">
                    {p.project?.replace('.wikipedia.org', '') || 'unknown'}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant dark:text-slate-400">
                    {fmt(p.total_views)} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            )
          }) : (
            <div className="space-y-3.5 pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mb-3.5">
                  <div className="flex justify-between mb-1.5">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-container dark:bg-slate-800">
                    <Skeleton className="h-full rounded-full" style={{ width: `${30 + (i * 13) % 55}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        {/* article_search indexes */}
        <SurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <Layers size={15} className="text-secondary dark:text-secondary-fixed-dim" />
            <span className="font-display text-[15px] font-semibold text-primary dark:text-white">
              Search Index (article_search)
            </span>
          </div>
          {SEARCH_INDEXES.map((idx, i) => (
            <div
              key={i}
              className={cx(
                'py-2.5',
                i < SEARCH_INDEXES.length - 1 && 'border-b border-surface-container-low dark:border-slate-900',
              )}
            >
              <div className="font-mono text-xs text-primary-container dark:text-primary-fixed-dim">{idx.name}</div>
              <div className="font-body text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">{idx.desc}</div>
            </div>
          ))}
        </SurfaceCard>

        {/* Document Schema */}
        <SurfaceCard
          title="Document Schema"
          subtitle="Representative shape of a pageview document stored in MongoDB."
        >
          <pre className="rounded-lg bg-surface-container-low p-4 font-mono text-xs text-on-surface overflow-auto leading-relaxed dark:bg-slate-900/50 dark:text-slate-300">{`{
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
