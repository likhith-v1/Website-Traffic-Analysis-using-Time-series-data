import { cx } from '../lib/utils'

export default function StatCard({ label, value, sub, accent = false, delay = 0 }) {
  return (
    <div
      className={cx(
        'rounded-xl border bg-surface-container-lowest p-4 shadow-sm animate-fade-up',
        'dark:bg-slate-900',
        accent
          ? 'border-primary-container/20 dark:border-primary-container/30'
          : 'border-surface-container dark:border-slate-800',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-on-surface-variant dark:text-slate-400 mb-3">
        {label}
      </p>
      <p className={cx(
        'font-display text-[26px] font-bold leading-none tracking-tight',
        accent ? 'text-primary-container dark:text-primary-fixed-dim' : 'text-primary dark:text-white',
      )}>
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-xs text-on-surface-variant dark:text-slate-400 font-body">
          {sub}
        </p>
      )}
    </div>
  )
}
