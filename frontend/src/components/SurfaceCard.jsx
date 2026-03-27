import { cx } from '../lib/utils'

export default function SurfaceCard({ title, subtitle, children, accent = 'default', className = '' }) {
  return (
    <section className={cx(
      'rounded-lg border bg-white p-6 shadow-sm mb-5',
      'dark:bg-gray-950',
      accent === 'highlight'
        ? 'border-blue-200 dark:border-blue-900/40'
        : 'border-gray-200 dark:border-gray-800',
      className,
    )}>
      {(title || subtitle) && (
        <div className="mb-5">
          {title && (
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-50 mb-1">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-body">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
