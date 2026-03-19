export default function SurfaceCard({ title, subtitle, children, accent = 'default', className = '' }) {
  const cardClass = [
    'surface-card',
    accent !== 'default' ? `surface-card-${accent}` : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <section className={cardClass}>
      {(title || subtitle) && (
        <div className="surface-card-header">
          {title   ? <h2 className="surface-card-title">{title}</h2>       : null}
          {subtitle ? <p className="surface-card-subtitle">{subtitle}</p>  : null}
        </div>
      )}
      {children}
    </section>
  )
}
