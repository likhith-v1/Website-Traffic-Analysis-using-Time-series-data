export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-header animate-fade-up">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  )
}
