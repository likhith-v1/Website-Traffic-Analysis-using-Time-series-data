export default function StatCard({ label, value, sub, accent = false, delay = 0 }) {
  return (
    <div
      className={`stat-card animate-fade-up ${accent ? 'stat-card-accent' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 30, color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
