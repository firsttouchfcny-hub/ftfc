// Shared placeholder body for skeleton screens: a "scaffold" tag, a title, an
// optional blurb, and a "will live here" list — so reviewers can see the intended
// structure of each screen before the real UI is built.

export default function Scaffold({ title, blurb, planned = [], children }) {
  return (
    <div style={{ padding: '8px 20px 48px' }}>
      <span
        className="type-tag-bold"
        style={{
          display: 'inline-block', color: 'var(--color-dark-gray-50)',
          border: '1px dashed var(--color-tan)', borderRadius: 6,
          padding: '3px 8px', letterSpacing: '.06em',
        }}
      >
        🚧 SCAFFOLD
      </span>

      <h1 className="type-heading-h2" style={{ marginTop: 12, marginBottom: 6 }}>{title}</h1>
      {blurb && (
        <p className="type-body-regular" style={{ color: 'var(--color-dark-gray-50)', marginBottom: 18 }}>
          {blurb}
        </p>
      )}

      {planned.length > 0 && (
        <>
          <p
            className="type-caption-semibold"
            style={{ textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--color-dark-gray-50)', marginBottom: 8 }}
          >
            Will live here
          </p>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 8, marginBottom: 24 }}>
            {planned.map((p) => (
              <li
                key={p}
                className="type-body-regular"
                style={{
                  background: 'var(--color-white)', border: '1px solid var(--color-tan)',
                  borderRadius: 10, padding: '10px 14px',
                }}
              >
                {p}
              </li>
            ))}
          </ul>
        </>
      )}

      {children}
    </div>
  );
}
