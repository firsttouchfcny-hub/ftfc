// Gear details — reached from the top-left Gear button. Two views: who has gear
// now, and the upcoming gear schedule.

import Scaffold from '../components/Scaffold';

export default function GearScreen() {
  return (
    <Scaffold
      title="Gear"
      blurb="Who has the gear, and the schedule that keeps it moving."
      planned={[
        'Who has gear now (current holders / out)',
        'Gear schedule — per-day coverage (🥅 2/2, ⚽ 1/1, 🧺 1/1)',
        'Bringing-in vs taking-home per game morning',
        'Coverage alerts (at risk / nobody taking home)',
      ]}
    />
  );
}
