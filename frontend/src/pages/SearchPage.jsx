import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchArticles } from '../api/client'

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n)

export default function SearchPage() {
  const [q,       setQ]       = useState('')
  const [project, setProject] = useState('en.wikipedia.org')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const navigate = useNavigate()

  const PROJECTS = ['en.wikipedia.org','de.wikipedia.org','fr.wikipedia.org','es.wikipedia.org','ru.wikipedia.org','ja.wikipedia.org','zh.wikipedia.org']

  const search = async () => {
    if (q.length < 2) return
    setLoading(true)
    setSearched(true)
    const res = await searchArticles(q, project)
    setResults(res)
    setLoading(false)
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 32, marginBottom: 4 }}>Search</div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--muted)', marginBottom: 32 }}>
        Find any Wikipedia article in the dataset
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search articles… (e.g. Python, Einstein, Football)"
            style={{
              width: '100%', padding: '12px 14px 12px 40px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text)', fontFamily: 'DM Sans', fontSize: 14, outline: 'none',
            }} />
        </div>
        <select value={project} onChange={e => setProject(e.target.value)} style={{
          padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 12, outline: 'none',
        }}>
          {PROJECTS.map(p => <option key={p} value={p}>{p.replace('.wikipedia.org','')}</option>)}
        </select>
        <button onClick={search} style={{
          padding: '12px 24px', background: 'var(--accent)', color: '#000',
          border: 'none', borderRadius: 10, fontFamily: 'Syne', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>Search</button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
          Querying MongoDB…
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
          No results found for "{q}"
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => navigate(`/explore?article=${r.article}`)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px 20px', cursor: 'pointer',
                transition: 'border-color 0.15s', animationDelay: `${i * 30}ms`,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              className="animate-fade-up"
            >
              <div>
                <div style={{ fontFamily: 'DM Sans', fontSize: 15, fontWeight: 500 }}>{r.article.replace(/_/g, ' ')}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{project}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{fmt(r.total_views)}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted)' }}>total views</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
