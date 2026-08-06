// Living design-token specimen — mirrors the Figma spec sheets so the tokens
// can be eyeballed in the real browser. Dev-only; mounted from main.jsx at
// ?tokens. Uses the tokens themselves (colors + .type-* classes) so if it looks
// right, the tokens work.

const COLOR_GROUPS = [
  {
    title: 'Dark Gray',
    swatches: [
      { name: 'Dark Gray',     token: '--color-dark-gray',     note: '#1F1F1F' },
      { name: 'Dark Gray/90%', token: '--color-dark-gray-90',  note: '#1F1F1F @ 90%' },
      { name: 'Dark Gray/50%', token: '--color-dark-gray-50',  note: '#1F1F1F @ 50%' },
      { name: 'Dark Gray/25%', token: '--color-dark-gray-25',  note: '#1F1F1F @ 25%' },
    ],
  },
  {
    title: 'Neutrals',
    swatches: [
      { name: 'White',       token: '--color-white',       note: '#FFFFFF' },
      { name: 'Tan/20%',     token: '--color-tan-20',      note: '#D2CFBD @ 20%' },
      { name: 'Cream',       token: '--color-cream',       note: '#FBF9F0' },
      { name: 'Light Olive', token: '--color-light-olive', note: '#E6E4D7' },
      { name: 'Tan',         token: '--color-tan',         note: '#D2CFBD' },
    ],
  },
  {
    title: 'Accent',
    swatches: [
      { name: 'Red', token: '--color-red', note: '#D80505' },
    ],
  },
];

const FOX = 'The quick brown fox jumps over the lazy dog';
const HEAD = 'An elegant, organic sans-serif typeface';

const TYPE = [
  { group: 'Heading' },
  { cls: 'type-heading-h1',       name: 'heading.h1',       spec: 'Medium · 36 / auto',   sample: HEAD },
  { cls: 'type-heading-h2',       name: 'heading.h2',       spec: 'Bold · 28 / 36',       sample: HEAD },
  { group: 'Body' },
  { cls: 'type-body-regular',     name: 'body.regular',     spec: 'Regular · 16 / auto',  sample: FOX },
  { cls: 'type-body-regular-tall',name: 'body.regular-tall',spec: 'Regular · 16 / 24',    sample: FOX },
  { cls: 'type-body-semibold',    name: 'body.semibold',    spec: 'SemiBold · 16 / auto', sample: FOX },
  { cls: 'type-body-bold',        name: 'body.bold',        spec: 'Bold · 16 / auto',     sample: FOX },
  { cls: 'type-body-light',       name: 'body.light',       spec: 'Light · 16 / auto',    sample: FOX },
  { group: 'Small' },
  { cls: 'type-small-regular',    name: 'small.regular',    spec: 'Regular · 14 / auto',  sample: FOX },
  { cls: 'type-small-semibold',   name: 'small.semibold',   spec: 'SemiBold · 14 / 16',   sample: FOX },
  { group: 'Caption' },
  { cls: 'type-caption-medium',   name: 'caption.medium',   spec: 'Medium · 13 / 14',     sample: FOX },
  { cls: 'type-caption-semibold', name: 'caption.semibold', spec: 'SemiBold · 12 / auto', sample: FOX },
  { cls: 'type-caption-bold',     name: 'caption.bold',     spec: 'Bold · 12 / auto',     sample: FOX },
  { group: 'Tag' },
  { cls: 'type-tag-bold',         name: 'tag.bold',         spec: 'Bold · 11 / auto',     sample: 'SYSTEM_STATUS_ACTIVE' },
];

const S = {
  page: {
    minHeight: '100vh', background: 'var(--color-cream)', color: 'var(--color-dark-gray)',
    fontFamily: 'var(--font-family-base)', padding: '40px 28px', maxWidth: 900, margin: '0 auto',
  },
  h: { fontWeight: 700, fontSize: 30, marginBottom: 4 },
  sub: { color: 'var(--color-dark-gray-50)', fontSize: 14, marginBottom: 36 },
  section: { fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em',
    color: 'var(--color-dark-gray-50)', margin: '34px 0 14px', borderTop: '1px solid var(--color-tan)', paddingTop: 18 },
  swatchRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 },
  chip: { height: 96, borderRadius: 12, border: '1px solid var(--color-tan)' },
  name: { fontWeight: 600, fontSize: 13, marginTop: 8 },
  note: { fontSize: 12, color: 'var(--color-dark-gray-50)' },
  typeRow: { display: 'grid', gridTemplateColumns: '190px 1fr', gap: 20, alignItems: 'baseline',
    padding: '12px 0', borderBottom: '1px solid var(--color-tan-20)' },
  typeMeta: { },
  typeName: { fontWeight: 600, fontSize: 13 },
  typeSpec: { fontSize: 11, color: 'var(--color-dark-gray-50)', marginTop: 2 },
};

export default function TokenGallery() {
  return (
    <div style={S.page}>
      <div style={S.h}>FTFC Design Tokens</div>
      <div style={S.sub}>Live specimen · colors + Plus Jakarta Sans type scale · from tokens.css</div>

      {/* Colors */}
      {COLOR_GROUPS.map((g) => (
        <div key={g.title}>
          <div style={S.section}>{g.title}</div>
          <div style={S.swatchRow}>
            {g.swatches.map((s) => (
              <div key={s.name}>
                <div style={{ ...S.chip, background: `var(${s.token})` }} />
                <div style={S.name}>{s.name}</div>
                <div style={S.note}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Type */}
      <div style={S.section}>Typography</div>
      {TYPE.map((t) =>
        t.group ? (
          <div key={`g-${t.group}`} style={{ ...S.section, borderTop: 'none', paddingTop: 8 }}>{t.group}</div>
        ) : (
          <div key={t.name} style={S.typeRow}>
            <div style={S.typeMeta}>
              <div style={S.typeName}>{t.name}</div>
              <div style={S.typeSpec}>Plus Jakarta Sans · {t.spec}</div>
            </div>
            <div className={t.cls}>{t.sample}</div>
          </div>
        )
      )}
    </div>
  );
}
