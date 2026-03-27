import { cx } from '../lib/utils'

export default function StatCard({ label, value, sub, accent = false, delay = 0 }) {
  return (
    <div
      className={cx(
        'rounded-lg border bg-white p-4 shadow-sm animate-fade-up',
        'dark:bg-gray-950',
        accent
          ? 'border-blue-200 dark:border-blue-900/50'
          : 'border-gray-200 dark:border-gray-800',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 mb-3">
        {label}
      </p>
      <p className={cx(
        'font-display text-[26px] font-bold leading-none tracking-tight',
        accent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-50',
      )}>
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-body">
          {sub}
        </p>
      )}
    </div>
  )
}
