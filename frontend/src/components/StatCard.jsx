export default function StatCard({ label, value, sub, accent = false, delay = 0 }) {
  return (
    <div className="animate-fade-up" style={{
      background: 'var(--surface)', border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 12, padding: '20px 24px', animationDelay: `${delay}ms`,
      boxShadow: accent ? '0 0 24px rgba(232,255,71,0.08)' : 'none',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 28, color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
