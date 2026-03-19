import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar      from './components/Sidebar'
import Overview     from './pages/Overview'
import Explore      from './pages/Explore'
import SearchPage   from './pages/SearchPage'
import Leaderboard  from './pages/Leaderboard'
import Models       from './pages/Models'
import DatabasePage from './pages/DatabasePage'

const THEME_KEY = 'wikitraffic-theme-mode'

function applyTheme(mode) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const effective = mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode
  document.documentElement.dataset.theme = effective
  document.documentElement.dataset.themeMode = mode
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
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setSidebarOpen(open => !open)}
        aria-label="Toggle navigation"
      >
        <Menu size={18} />
        Menu
      </button>
      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={closeSidebar}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
      {sidebarOpen && <button type="button" className="sidebar-backdrop" onClick={closeSidebar} aria-label="Close navigation" />}
      <main className="app-main">
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
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
