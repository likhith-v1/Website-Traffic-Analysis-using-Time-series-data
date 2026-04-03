import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, FileText, Globe, Activity, Database, ExternalLink } from 'lucide-react'
import { cx } from '../lib/utils'

const links = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/explore',     icon: TrendingUp,      label: 'Traffic Trends'  },
  { to: '/search',      icon: FileText,        label: 'Page Insights'   },
  { to: '/leaderboard', icon: Globe,           label: 'Leaderboard'     },
  { to: '/models',      icon: Activity,        label: 'System Health'   },
  { to: '/database',    icon: Database,        label: 'Database'        },
]

export default function Sidebar({ isOpen = false, onNavigate = () => {} }) {
  const navigate = useNavigate()

  return (
    <aside className={cx(
      'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col',
      'bg-surface-container-low dark:bg-slate-900',
      'py-6 px-4',
      'transition-transform duration-200 ease-in-out',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      {/* Brand */}
      <div className="mb-10 px-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center flex-shrink-0 shadow-[0_4px_14px_rgba(27,37,75,0.25)]">
          <Activity size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-container dark:text-white font-display">
            WikiTraffic
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-secondary dark:text-secondary-fixed-dim font-bold font-mono">
            Traffic Analytics
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) => cx(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all font-body',
              isActive
                ? 'bg-white dark:bg-slate-800 text-primary-container dark:text-white font-bold shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50',
            )}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={cx(
                    'shrink-0',
                    isActive
                      ? 'text-primary-container dark:text-white'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="pt-6 border-t border-slate-200/50 dark:border-slate-700/50 space-y-1">
        <button
          onClick={() => { navigate('/models'); onNavigate() }}
          className="w-full bg-primary-container hover:opacity-90 text-white py-3 rounded-lg font-bold text-sm mb-4 transition-all active:scale-95"
        >
          Run Pipeline
        </button>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-colors text-sm"
        >
          <ExternalLink size={16} className="shrink-0" />
          API Docs
        </a>
      </div>
    </aside>
  )
}
