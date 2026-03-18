import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar      from './components/Sidebar'
import Overview     from './pages/Overview'
import Explore      from './pages/Explore'
import SearchPage   from './pages/SearchPage'
import Leaderboard  from './pages/Leaderboard'
import Models       from './pages/Models'
import DatabasePage from './pages/DatabasePage'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
          <Routes>
            <Route path="/"           element={<Overview />}     />
            <Route path="/explore"    element={<Explore />}      />
            <Route path="/search"     element={<SearchPage />}   />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/models"     element={<Models />}       />
            <Route path="/database"   element={<DatabasePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
