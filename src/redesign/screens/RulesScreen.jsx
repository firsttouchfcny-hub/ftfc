// Rules & code of conduct — reached from the top-left nav button.

import Scaffold from '../components/Scaffold';

export default function RulesScreen() {
  return (
    <Scaffold
      title="Rules & code of conduct"
      blurb="Content screen, opened from the top-left Rules button."
      planned={[
        'Roll-call windows (10am admins · 11am gear · 3pm everyone)',
        'Match sizing (Match 1 = 18, Match 2 confirms at 30, cap 36, bench)',
        'Gear responsibilities & the take/bring cycle',
        'Suspension policy',
      ]}
    />
  );
}
