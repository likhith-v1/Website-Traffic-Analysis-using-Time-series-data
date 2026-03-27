import { NavLink } from 'react-router-dom'
import { BarChart2, Search, Trophy, Database, GitCompare, Activity, Sun, Moon, Monitor } from 'lucide-react'
import { cx } from '../lib/utils'

const links = [
  { to: '/',            icon: Activity,   label: 'Overview'    },
  { to: '/explore',     icon: BarChart2,  label: 'Explore'     },
  { to: '/search',      icon: Search,     label: 'Search'      },
  { to: '/leaderboard', icon: Trophy,     label: 'Leaderboard' },
  { to: '/models',      icon: GitCompare, label: 'Models'      },
  { to: '/database',    icon: Database,   label: 'Database'    },
]

const themeOptions = [
  { value: 'auto',  label: 'Auto',  icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark',  label: 'Dark',  icon: Moon },
]

export default function Sidebar({
  isOpen = false,
  onNavigate = () => {},
  themeMode = 'auto',
  onThemeModeChange = () => {},
}) {
  return (
    <aside className={cx(
      'fixed left-0 top-0 z-20 flex h-screen w-64 flex-col',
      'border-r border-gray-200 bg-gray-50',
      'dark:border-gray-800 dark:bg-gray-925',
      'transition-transform duration-200 ease-in-out',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <Activity size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold text-gray-900 dark:text-gray-50">
            WikiTraffic
          </div>
          <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
            Time Series Analysis
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) => cx(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              'font-body',
              isActive
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-50',
            )}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={cx(
                    'shrink-0',
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500',
                  )}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-gray-200 dark:border-gray-800">
        {/* Theme switcher */}
        <div className="grid grid-cols-3 gap-1.5 mb-3" aria-label="Theme mode">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const active = themeMode === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => onThemeModeChange(value)}
                aria-pressed={active}
                className={cx(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-mono transition-all',
                  active
                    ? 'bg-white shadow-sm ring-1 ring-gray-200 text-blue-600 dark:bg-gray-900 dark:ring-gray-800 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                <Icon size={11} />
                {label}
              </button>
            )
          })}
        </div>

        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-600 text-center">
          Wikipedia · 2015–2016
        </p>
      </div>
    </aside>
  )
}
