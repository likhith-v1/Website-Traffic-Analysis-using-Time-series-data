import { cx } from '../lib/utils'

export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-7 animate-fade-up">
      <div>
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-body">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className={cx(
          'flex shrink-0 items-center justify-center rounded-lg',
          'border border-gray-200 bg-gray-50 p-2',
          'dark:border-gray-800 dark:bg-gray-900',
        )}>
          {actions}
        </div>
      )}
    </div>
  )
}
