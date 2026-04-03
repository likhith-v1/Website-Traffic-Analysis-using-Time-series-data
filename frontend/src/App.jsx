import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, Search } from 'lucide-react'
import Sidebar      from './components/Sidebar'
import Overview     from './pages/Overview'
import Explore      from './pages/Explore'
import PageInsights from './pages/PageInsights'
import Leaderboard  from './pages/Leaderboard'
import Models       from './pages/Models'
import DatabasePage from './pages/DatabasePage'
import { cx } from './lib/utils'

const THEME_KEY = 'wikitraffic-theme-mode'

function applyTheme(mode) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const effective = mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode
  document.documentElement.dataset.theme = effective
  document.documentElement.dataset.themeMode = mode
  // Also toggle the 'dark' class so Tailwind dark: utilities work
  if (effective === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function TopNavBar({ themeMode, onThemeModeChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const toggleTheme = () => {
    onThemeModeChange(themeMode === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className={cx(
      'fixed top-0 right-0 left-0 md:left-64 h-16 z-40',
      'bg-surface/80 dark:bg-slate-950/80 backdrop-blur-xl',
      'flex justify-between items-center px-8',
      'border-b border-surface-container dark:border-slate-800',
    )}>
      {/* Left */}
      <div className="flex items-center gap-8">
        <span className="text-lg font-extrabold text-primary-container dark:text-white font-display hidden lg:block">
          Wikipedia Traffic
        </span>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search analytics..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className={cx(
              'bg-surface-container-low dark:bg-slate-800',
              'border-none rounded-full py-2 pl-10 pr-4 text-sm w-56 lg:w-64',
              'focus:outline-none focus:ring-2 focus:ring-primary-container/30',
              'placeholder:text-slate-400 text-on-surface dark:text-slate-200',
              'transition-all',
            )}
          />
        </div>

        <nav className="hidden lg:flex gap-6">
          <NavLink
            to="/"
            end
            className={({ isActive }) => cx(
              'font-medium text-sm pb-1 transition-colors',
              isActive
                ? 'text-primary-container dark:text-white border-b-2 border-secondary'
                : 'text-slate-500 dark:text-slate-400 hover:text-secondary dark:hover:text-secondary-fixed-dim',
            )}
          >
            Global View
          </NavLink>
          <NavLink
            to="/explore"
            className={({ isActive }) => cx(
              'font-medium text-sm pb-1 transition-colors',
              isActive
                ? 'text-primary-container dark:text-white border-b-2 border-secondary'
                : 'text-slate-500 dark:text-slate-400 hover:text-secondary dark:hover:text-secondary-fixed-dim',
            )}
          >
            Comparison
          </NavLink>
        </nav>
      </div>

      {/* Right */}
      <div className="flex items-center gap-5">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="text-slate-400 dark:text-slate-500 hover:text-primary-container dark:hover:text-white transition-colors"
        >
          {themeMode === 'dark'
            ? <Sun size={18} />
            : <Moon size={18} />
          }
        </button>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className={cx(
            'hidden md:block',
            'bg-white dark:bg-slate-800 text-primary-container dark:text-slate-200',
            'border border-surface-container-high dark:border-slate-700',
            'px-4 py-2 rounded-lg text-sm font-bold shadow-sm',
            'hover:bg-surface-container-low dark:hover:bg-slate-700 transition-colors',
          )}
        >
          API Docs
        </a>

        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold font-mono select-none">
          LV
        </div>
      </div>
    </header>
  )
}

function AppFooter() {
  return (
    <footer className={cx(
      'fixed bottom-0 left-0 md:left-64 right-0 h-10 z-40',
      'bg-surface-container-low dark:bg-slate-950',
      'border-t border-primary-container/10 dark:border-slate-800',
      'flex justify-between items-center px-8',
    )}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-secondary dark:text-secondary-fixed-dim">
        © 2026 Wikipedia Traffic Analysis. System Status: Operational.
      </p>
      <div className="hidden md:flex gap-6">
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] uppercase tracking-widest text-slate-400 hover:text-primary-container dark:hover:text-white transition-colors"
        >
          API Docs
        </a>
        <a
          href="http://localhost:8000/redoc"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] uppercase tracking-widest text-slate-400 hover:text-primary-container dark:hover:text-white transition-colors"
        >
          ReDoc
        </a>
      </div>
    </footer>
  )
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem(THEME_KEY) || 'auto')

  const closeSidebar = () => setSidebarOpen(false)

  useEffect(() => {
    applyTheme(themeMode)
    localStorage.setItem(THEME_KEY, themeMode)
  }, [themeMode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if ((localStorage.getItem(THEME_KEY) || 'auto') === 'auto') applyTheme('auto')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="flex min-h-svh w-full bg-surface dark:bg-slate-950">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle navigation"
        className={cx(
          'fixed left-3 top-[18px] z-[60] md:hidden',
          'inline-flex items-center gap-2 rounded-full',
          'border border-surface-container bg-surface/90 px-3 py-1.5',
          'font-mono text-[11px] text-on-surface',
          'backdrop-blur-sm shadow-sm',
          'dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-300',
          'transition-colors hover:bg-surface-container-low',
        )}
      >
        <Menu size={14} />
        Menu
      </button>

      <Sidebar isOpen={sidebarOpen} onNavigate={closeSidebar} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-label="Close navigation"
        />
      )}

      <TopNavBar themeMode={themeMode} onThemeModeChange={setThemeMode} />

      {/* Content area */}
      <div className="flex flex-1 flex-col md:pl-64 pt-16 pb-10">
        <main>
          <Routes>
            <Route path="/"            element={<Overview />} />
            <Route path="/explore"     element={<Explore />} />
            <Route path="/search"      element={<PageInsights />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/models"      element={<Models />} />
            <Route path="/database"    element={<DatabasePage />} />
          </Routes>
        </main>
      </div>

      <AppFooter />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
