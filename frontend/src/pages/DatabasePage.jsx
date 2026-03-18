import { useEffect, useState } from 'react'
import { getStats, getProjectBreakdown, getAccessBreakdown } from '../api/client'
import { Database, HardDrive, Layers, Globe } from 'lucide-react'

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n)

const Row = ({ label, value, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontFamily: 'DM Sans', fontSize: 14, color: 'var(--muted)' }}>{label}</span>
    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</span>
  </div>
)

export default function DatabasePage() {
  const [stats,    setStats]    = useState(null)
  const [projects, setProjects] = useState([])
  const [access,   setAccess]   = useState([])

  useEffect(() => {
    getStats().then(setStats)
    getProjectBreakdown().then(d => setProjects(d.filter(p => p.project !== 'unknown')))
    getAccessBreakdown().then(setAccess)
  }, [])

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

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Database size={28} color="var(--accent)" />
        <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32 }}>Database</div>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', marginBottom: 32 }}>
        MongoDB · wikipedia_traffic.pageviews
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Collection stats */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 12, padding: 24, boxShadow: '0 0 24px rgba(232,255,71,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <HardDrive size={16} color="var(--accent)" />
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Collection Stats</span>
          </div>
          {stats ? <>
            <Row label="Documents"      value={fmt(stats.documents)} accent />
            <Row label="Storage Size"   value={stats.size_gb + ' GB'} />
            <Row label="Indexes"        value={stats.indexes} />
            <Row label="Date Range"     value={`${stats.date_range.start} → ${stats.date_range.end}`} />
            <Row label="Language Projects" value={stats.projects} />
            <Row label="Database"       value="wikipedia_traffic" />
            <Row label="Collection"     value="pageviews" />
          </> : <div style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>Loading…</div>}
        </div>

        {/* Indexes */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Layers size={16} color="var(--accent2)" />
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Indexes ({INDEXES.length})</span>
          </div>
          {INDEXES.map((idx, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < INDEXES.length-1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--accent2)' }}>{idx.name}</div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{idx.desc}</div>
            </div>
          ))}
        </div>

        {/* Projects breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Globe size={16} color="var(--accent3)" />
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Views by Language</span>
          </div>
          {projects.map((p, i) => {
            const total = projects.reduce((s,x) => s+x.total_views, 0)
            const pct = ((p.total_views/total)*100).toFixed(1)
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{p.project?.replace('.wikipedia.org','') || 'unknown'}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)' }}>{fmt(p.total_views)} · {pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `hsl(${i*45},70%,60%)`, borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Schema */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Document Schema</div>
          <pre style={{
            fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text)', lineHeight: 1.8,
            background: 'var(--bg)', padding: 16, borderRadius: 8, overflow: 'auto',
          }}>{`{
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
        </div>

      </div>
    </div>
  )
}
