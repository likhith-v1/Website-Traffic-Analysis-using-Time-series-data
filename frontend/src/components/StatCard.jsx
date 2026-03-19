export default function StatCard({ label, value, sub, accent = false, delay = 0 }) {
  return (
    <div
      className={`stat-card animate-fade-up ${accent ? 'stat-card-accent' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--muted)',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        marginBottom: 12,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 28,
        color: accent ? 'var(--accent)' : 'var(--text)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--muted)',
          marginTop: 8,
          fontWeight: 300,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}
