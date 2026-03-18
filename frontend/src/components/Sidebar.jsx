import { NavLink } from 'react-router-dom'
import { BarChart2, Search, Trophy, Database, GitCompare, Activity } from 'lucide-react'

const links = [
  { to: '/',          icon: Activity,    label: 'Overview'    },
  { to: '/explore',   icon: BarChart2,   label: 'Explore'     },
  { to: '/search',    icon: Search,      label: 'Search'      },
  { to: '/leaderboard', icon: Trophy,    label: 'Leaderboard' },
  { to: '/models',    icon: GitCompare,  label: 'Models'      },
  { to: '/database',  icon: Database,    label: 'Database'    },
]

export default function Sidebar({ isOpen = false, onNavigate = () => {} }) {
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Nav links */}
      <nav style={{ flex: 1 }}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 24px', textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              background: isActive ? 'rgba(232,255,71,0.06)' : 'transparent',
              borderRight: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              fontFamily: 'DM Sans', fontSize: 14, fontWeight: isActive ? 500 : 400,
              transition: 'all 0.15s ease',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
