// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY design preview panel.
//
// Lets you preview every roster/time state with fake data — no Firebase, no
// live club data. App.jsx only renders this when import.meta.env.DEV is true
// (i.e. `npm run dev`), so it can never ship to production. The fake roster
// itself is built by buildMockSession in utils/mockSession.js.
// ─────────────────────────────────────────────────────────────────────────────

// Plain-language summary of the state a given (count, mePos) produces — mirrors
// the real thresholds in helpers.js (Match 1 = 18, confirm at 30, cap at 36).
function describe(count, mePos) {
  let list;
  if (count === 0) list = 'Empty list';
  else if (count <= 18) list = `Match 1 filling — ${count}/18`;
  else if (count < 30) list = `Match 2 ON HOLD — ${count} (needs 30)`;
  else if (count <= 36) list = `Match 2 confirmed — ${count}/36`;
  else list = `Full — ${count - 36} on the bench`;

  let me;
  if (mePos <= 0) me = 'not signed up';
  else if (mePos > count) me = '(beyond list)';
  else if (mePos <= 18) me = `you → Match 1 #${mePos}`;
  else if (mePos <= 36) me = `you → Match 2 #${mePos}`;
  else me = `you → Bench #${mePos - 36}`;

  return `${list} · ${me}`;
}

const MODES = [
  ['closed', '🔴 Closed'],
  ['admins-only', '🟡 Admins'],
  ['open', '🟢 Open'],
];
const PRESETS = [0, 12, 18, 24, 30, 36, 40];

const S = {
  wrap: {
    position: 'fixed', bottom: 12, right: 12, zIndex: 9999, width: 250,
    background: '#1c2333', color: '#e7ecf5', borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,.35)', border: '1px solid #35415e',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 11px', cursor: 'pointer', userSelect: 'none',
    borderBottom: '1px solid #35415e',
  },
  title: { fontWeight: 700, letterSpacing: '.3px' },
  body: { padding: '11px', display: 'flex', flexDirection: 'column', gap: 11 },
  label: { color: '#93a3c4', fontSize: 11, marginBottom: 5, letterSpacing: '.3px' },
  row: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: (on) => ({
    padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid',
    borderColor: on ? '#4f7cff' : '#35415e', background: on ? '#4f7cff' : 'transparent',
    color: on ? '#fff' : '#c4cee2', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
  }),
  range: { width: '100%', accentColor: '#4f7cff' },
  num: {
    width: 54, background: '#0f1524', color: '#e7ecf5', border: '1px solid #35415e',
    borderRadius: 6, padding: '3px 6px', fontFamily: 'inherit', fontSize: 12,
  },
  read: {
    background: '#0f1524', borderRadius: 6, padding: '7px 9px', lineHeight: 1.4,
    color: '#aee0c0', fontSize: 11,
  },
  bigcount: { fontSize: 15, fontWeight: 700, color: '#fff' },
};

export default function DevPanel({ mock, onChange }) {
  const set = (patch) => {
    const next = { ...mock, ...patch };
    if (next.mePos > next.count) next.mePos = next.count; // keep "me" within the list
    onChange(next);
  };

  return (
    <div style={S.wrap}>
      <div
        style={S.head}
        onClick={() => set({ enabled: !mock.enabled })}
        title="Toggle design-preview mode"
      >
        <span style={S.title}>🛠 Preview states</span>
        <span style={{ color: mock.enabled ? '#5ce08a' : '#93a3c4' }}>
          {mock.enabled ? 'ON' : 'off'}
        </span>
      </div>

      {mock.enabled && (
        <div style={S.body}>
          {/* Player count */}
          <div>
            <div style={S.label}>
              Players signed up: <span style={S.bigcount}>{mock.count}</span>
            </div>
            <input
              type="range" min="0" max="45" value={mock.count} style={S.range}
              onChange={(e) => set({ count: Number(e.target.value) })}
            />
            <div style={{ ...S.row, marginTop: 6 }}>
              {PRESETS.map((p) => (
                <button key={p} style={S.chip(mock.count === p)} onClick={() => set({ count: p })}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Time-of-day mode */}
          <div>
            <div style={S.label}>Roll-call state</div>
            <div style={S.row}>
              {MODES.map(([val, lbl]) => (
                <button key={val} style={S.chip(mock.mode === val)} onClick={() => set({ mode: val })}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Your own position */}
          <div>
            <div style={S.label}>You at position (0 = not signed up)</div>
            <input
              type="number" min="0" max={mock.count} value={mock.mePos} style={S.num}
              onChange={(e) => set({ mePos: Number(e.target.value) })}
            />
          </div>

          {/* Live readout of the resulting state */}
          <div style={S.read}>{describe(mock.count, mock.mePos)}</div>
        </div>
      )}
    </div>
  );
}
