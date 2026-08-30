// A plain spinner, for the wait where a skeleton would be dishonest.
//
// Everywhere else the redesign uses skeletons, because the shape of what's
// coming is known — rows, tiles, a headline. The roll-call screen is different:
// until the session document arrives we don't know whether it is a countdown or
// a pair of sign-up buttons, and drawing either would be a guess the player
// then watches get corrected. A spinner claims nothing but "waiting".

export default function Spinner({ size = 32, label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="rd-spinner"
      style={{ width: size, height: size, display: 'block', flexShrink: 0 }}
    />
  );
}
