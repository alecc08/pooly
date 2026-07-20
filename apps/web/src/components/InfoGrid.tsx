const infos = [
  { title: 'Clean history', text: 'Every action is dated, searchable, and exportable.' },
  { title: 'Fits your pool', text: 'Chlorine, salt, bromine, cartridge or sand. Everything works.' },
  { title: 'Ultra fast', text: 'A short form, a single screen, nothing superfluous.' },
]

export default function InfoGrid() {
  return (
    <section
      style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}
      className="info-grid fade-up delay-3"
    >
      {infos.map(({ title, text }) => (
        <div
          key={title}
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
            border: '1px solid var(--border)',
          }}
        >
          <h3>{title}</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.4 }}>{text}</p>
        </div>
      ))}
    </section>
  )
}
