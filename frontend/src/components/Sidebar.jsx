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

export default function Sidebar() {
  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: 'var(--surface)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', padding: '24px 0', position: 'fixed', top: 0, left: 0, zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px 32px' }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
          WIKI<span style={{ color: 'var(--text)' }}>FLOW</span>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
          TIME SERIES DASHBOARD
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1 }}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 24px', textDecoration: 'none',
            color: isActive ? 'var(--accent)' : 'var(--muted)',
            background: isActive ? 'rgba(232,255,71,0.06)' : 'transparent',
            borderRight: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            fontFamily: 'DM Sans', fontSize: 14, fontWeight: isActive ? 500 : 400,
            transition: 'all 0.15s ease',
          })}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
          23BSCSMA61<br />
          CSE AIMLA · SEM VI<br />
          Wikipedia Traffic Analysis
        </div>
      </div>
    </aside>
  )
}
