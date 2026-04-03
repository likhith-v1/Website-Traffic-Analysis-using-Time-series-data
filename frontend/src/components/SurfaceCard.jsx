import { cx } from '../lib/utils'

export default function SurfaceCard({ title, subtitle, children, accent = 'default', className = '' }) {
  return (
    <section className={cx(
      'rounded-xl border bg-surface-container-lowest p-6 shadow-sm mb-5',
      'dark:bg-slate-900',
      accent === 'highlight'
        ? 'border-primary-container/20 dark:border-primary-container/30'
        : 'border-surface-container dark:border-slate-800',
      className,
    )}>
      {(title || subtitle) && (
        <div className="mb-5">
          {title && (
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-primary dark:text-white mb-1">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs text-on-surface-variant dark:text-slate-400 leading-relaxed font-body">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
