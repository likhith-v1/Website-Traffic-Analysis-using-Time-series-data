import { NavLink } from 'react-router-dom'
import { BarChart2, Search, Trophy, Database, GitCompare, Activity, Sun, Moon, Monitor } from 'lucide-react'

const links = [
  { to: '/',            icon: Activity,   label: 'Overview'    },
  { to: '/explore',     icon: BarChart2,  label: 'Explore'     },
  { to: '/search',      icon: Search,     label: 'Search'      },
  { to: '/leaderboard', icon: Trophy,     label: 'Leaderboard' },
  { to: '/models',      icon: GitCompare, label: 'Models'      },
  { to: '/database',    icon: Database,   label: 'Database'    },
]

const themeOptions = [
  { value: 'auto', label: 'Auto', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export default function Sidebar({
  isOpen = false,
  onNavigate = () => {},
  themeMode = 'auto',
  onThemeModeChange = () => {},
}) {
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-text">WikiTraffic</div>
        <div className="sidebar-brand-sub">Time Series Analysis</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 20px',
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              borderRight: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: isActive ? 500 : 300,
              letterSpacing: '0.02em',
              transition: 'all 0.15s ease',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="theme-switch" aria-label="Theme mode">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const active = themeMode === value
            return (
              <button
                key={value}
                type="button"
                className={`theme-switch-btn ${active ? 'theme-switch-btn-active' : ''}`}
                onClick={() => onThemeModeChange(value)}
                aria-pressed={active}
              >
                <Icon size={12} />
                {label}
              </button>
            )
          })}
        </div>

        <div style={{
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--muted-soft)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Wikipedia · 2015-2016
        </div>
      </div>
    </aside>
  )
}
