import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchArticles } from '../api/client'
import PageHeader from '../components/PageHeader'
import SurfaceCard from '../components/SurfaceCard'
import { cx } from '../lib/utils'

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
    <div className="p-6 lg:p-8">
      <PageHeader
        eyebrow="Lookup"
        title="Search"
        subtitle="Find articles in the dataset and jump straight into exploration without digging through raw records."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-4 py-3 mb-5 dark:border-gray-800 dark:bg-gray-950">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search articles… (e.g. Python, Einstein, Football)"
            className={cx(
              'w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3',
              'font-body text-sm text-gray-900 placeholder-gray-400',
              'outline-none transition',
              'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
              'dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder-gray-500',
              'dark:focus:border-blue-700 dark:focus:ring-blue-700/30',
            )}
          />
        </div>
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
          {PROJECTS.map(p => <option key={p} value={p}>{p.replace('.wikipedia.org', '')}</option>)}
        </select>
        <button
          onClick={search}
          className="rounded-md bg-blue-500 px-5 py-2 font-display text-sm font-semibold text-white shadow-sm hover:bg-blue-600 transition-colors"
        >
          Search
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-16 text-center font-mono text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900/50">
          Querying MongoDB…
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-16 text-center font-mono text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900/50">
          {error || `No results found for "${q}"`}
        </div>
      )}

      {!loading && results.length > 0 && (
        <SurfaceCard
          title="Search Results"
          subtitle={`${results.length} matching articles ranked by total views.`}
        >
          <div className="flex flex-col gap-2">
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => navigate(`/explore?article=${r.article}`)}
                className={cx(
                  'flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer',
                  'transition-colors hover:border-blue-200 hover:bg-blue-50/30',
                  'dark:border-gray-800 dark:bg-gray-950 dark:hover:border-blue-900/50 dark:hover:bg-blue-500/5',
                  'animate-fade-up',
                )}
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div>
                  <div className="font-body text-sm font-medium text-gray-900 dark:text-gray-50">
                    {r.article.replace(/_/g, ' ')}
                  </div>
                  <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 tracking-wide">
                    {project}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-xl text-blue-600 dark:text-blue-400">
                    {fmt(r.total_views)}
                  </div>
                  <div className="font-mono text-[9px] text-gray-400 dark:text-gray-500 tracking-wider">
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
