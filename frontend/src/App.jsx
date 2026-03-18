import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar      from './components/Sidebar'
import Overview     from './pages/Overview'
import Explore      from './pages/Explore'
import SearchPage   from './pages/SearchPage'
import Leaderboard  from './pages/Leaderboard'
import Models       from './pages/Models'
import DatabasePage from './pages/DatabasePage'

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

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
      <Sidebar isOpen={sidebarOpen} onNavigate={closeSidebar} />
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
