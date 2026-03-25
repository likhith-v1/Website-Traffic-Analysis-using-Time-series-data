import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchArticles } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'

const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : String(n)

const PROJECTS = [
  'en.wikipedia.org', 'de.wikipedia.org', 'fr.wikipedia.org',
  'es.wikipedia.org', 'ru.wikipedia.org', 'ja.wikipedia.org', 'zh.wikipedia.org',
]

export default function SearchPage() {
  const [q,        setQ]        = useState('')
  const [project,  setProject]  = useState('en.wikipedia.org')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [error,    setError]    = useState('')
  const navigate = useNavigate()

  const search = async () => {
    if (q.length < 2) return
    setLoading(true); setSearched(true); setError('')
    try {
      const res = await searchArticles(q, project)
      setResults(res)
    } catch (err) {
      setResults([]); setError(err.message || 'Search failed')
    }
    setLoading(false)
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Lookup"
        title="Search"
        subtitle="Find articles in the dataset and jump straight into exploration without digging through raw records."
      />

      <div className="toolbar-card" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            placeholder="Search articles… (e.g. Python, Einstein, Football)"
            style={{
              width: '100%', padding: '11px 14px 11px 38px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 9, color: 'var(--text)',
              fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
              fontWeight: 300,
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        </div>
        <select value={project} onChange={e => setProject(e.target.value)} style={{
          padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
          outline: 'none', letterSpacing: '0.04em',
        }}>
          {PROJECTS.map(p => <option key={p} value={p}>{p.replace('.wikipedia.org', '')}</option>)}
        </select>
        <button
          onClick={search}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          style={{
            padding: '11px 22px', background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 9,
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', letterSpacing: '0.01em',
            transition: 'opacity 0.15s ease',
          }}
        >Search</button>
      </div>

      {loading && <div className="empty-state">Querying MongoDB…</div>}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">{error || `No results found for "${q}"`}</div>
      )}

      {!loading && results.length > 0 && (
        <SurfaceCard
          title="Search Results"
          subtitle={`${results.length} matching articles ranked by total views.`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => navigate(`/explore?article=${r.article}`)}
                className="animate-fade-up"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  animationDelay: `${i * 25}ms`,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500 }}>
                    {r.article.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.06em' }}>
                    {project}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>
                    {fmt(r.total_views)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                    total views
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}
