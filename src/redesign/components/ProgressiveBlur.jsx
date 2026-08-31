// Progressive (graduated) backdrop blur.
//
// A stack of backdrop-filter layers whose blur radius doubles each layer, each
// masked to an overlapping horizontal band — so the blur ramps *smoothly* from
// 0 at the bottom edge to `maxBlur` at the top, instead of the hard cutoff a
// single backdrop-filter gives. This is the iOS-style effect used by e.g.
// pool.day. Color-agnostic — pair it with a tint layer (our olive scrim) for color.
//
// Anchored to the top of its positioned parent; render it as the first child of
// a `position: relative/sticky` container, with the real content above it.

const LAYERS = 8;

export default function ProgressiveBlur({ height = 112, maxBlur = 8 }) {
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, pointerEvents: 'none', zIndex: 0 }}
    >
      {Array.from({ length: LAYERS }).map((_, i) => {
        // bottom layer ≈ maxBlur/128, top layer = maxBlur (doubling upward)
        const blur = maxBlur / 2 ** (LAYERS - 1 - i);
        const s = (i / LAYERS) * 100; // this layer's band steps up 100/LAYERS each time
        const band = 100 / LAYERS;
        const mask =
          `linear-gradient(to top,` +
          ` transparent ${s}%,` +
          ` #000 ${s + band}%,` +
          ` #000 ${s + band * 2}%,` +
          ` transparent ${s + band * 3}%)`;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', inset: 0,
              backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask, WebkitMaskImage: mask,
            }}
          />
        );
      })}
    </div>
  );
}
