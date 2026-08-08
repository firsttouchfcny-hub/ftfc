// Home / roll-call screen. Has three variants driven by the time window + admin:
//   · waiting  (regular user, before 3pm)  — countdown + take-gear  ← built
//   · open     (everyone, 3pm+)            — I'm in / +1            (todo)
//   · admin    (admin, from 10am)          — I'm in / +1 early      (todo)
// For now it renders the waiting variant; the selector logic lands when the other
// two are built (and can be driven by the dev "Preview states" panel).

import HomeWaiting from './home/HomeWaiting';

export default function HomeScreen() {
  return <HomeWaiting />;
}
