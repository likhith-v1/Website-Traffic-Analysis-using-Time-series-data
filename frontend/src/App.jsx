import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Menu, ChevronRight } from 'lucide-react'
import Sidebar      from './components/Sidebar'
import Overview     from './pages/Overview'
import Explore      from './pages/Explore'
import SearchPage   from './pages/SearchPage'
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
}

const ROUTE_LABELS = {
  '/':            'Overview',
  '/explore':     'Explore',
  '/search':      'Search',
  '/leaderboard': 'Leaderboard',
  '/models':      'Models',
  '/database':    'Database',
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const label = ROUTE_LABELS[pathname]
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <NavLink
            to="/"
            className="font-body text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            Home
          </NavLink>
        </li>
        {label && pathname !== '/' && (
          <>
            <li aria-hidden="true">
              <ChevronRight size={14} className="text-gray-400 dark:text-gray-600" />
            </li>
            <li className="font-body text-gray-900 dark:text-gray-50">{label}</li>
          </>
        )}
      </ol>
    </nav>
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
      if ((localStorage.getItem(THEME_KEY) || 'auto') === 'auto') {
        applyTheme('auto')
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="flex min-h-svh w-full bg-white dark:bg-gray-950">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle navigation"
        className={cx(
          'fixed left-3 top-3 z-30 md:hidden',
          'inline-flex items-center gap-2 rounded-full',
          'border border-gray-200 bg-white/90 px-3 py-1.5',
          'font-mono text-[11px] text-gray-700',
          'backdrop-blur-sm shadow-sm',
          'dark:border-gray-800 dark:bg-gray-950/90 dark:text-gray-300',
          'transition-colors hover:bg-gray-50 dark:hover:bg-gray-900',
        )}
      >
        <Menu size={14} />
        Menu
      </button>

      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={closeSidebar}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-label="Close navigation"
        />
      )}

      {/* Content area */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Sticky header */}
        <header className={cx(
          'sticky top-0 z-10 flex h-14 items-center gap-3 px-5',
          'border-b border-gray-200 bg-white',
          'dark:border-gray-800 dark:bg-gray-950',
        )}>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <Breadcrumbs />
        </header>

        <main>
          <Routes>
            <Route path="/"            element={<Overview />} />
            <Route path="/explore"     element={<Explore />} />
            <Route path="/search"      element={<SearchPage />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/models"      element={<Models />} />
            <Route path="/database"    element={<DatabasePage />} />
          </Routes>
        </main>
      </div>
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
