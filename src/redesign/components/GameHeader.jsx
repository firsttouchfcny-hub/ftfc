// Game header — ball + date + time/location. Shared by the home roll-call
// variants and the game screen. Built from Figma node 2699:13047 "Game info".
// Values are props (defaulted to the design's game) so the real next-game date
// can flow in later.

import ballIcon from '../assets/icons/ball.svg';
import { formatWeekday, formatMonthDayYear } from '../state/rollCall';
import { mockGameDate } from '../state/mockRoster';

// Weekday and date default from the mock game day, so the header can't drift
// from the dates the gear dialog quotes. Real values override via props.
export default function GameHeader({
  weekday = formatWeekday(mockGameDate),
  date = formatMonthDayYear(mockGameDate),
  time = '07:00 AM',
  location = 'McCarren Park',
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div style={{ width: 60, height: 52 }}>
        <img src={ballIcon} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', color: 'var(--color-dark-gray)' }}>
        <div className="type-heading-h2" style={{ textAlign: 'center' }}>
          <div>{weekday}</div>
          <div>{date}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'center' }}>
          <span className="type-body-regular">{time}</span>
          <span className="type-body-light">•</span>
          <span className="type-body-regular" style={{ textDecoration: 'underline' }}>{location}</span>
        </div>
      </div>
    </div>
  );
}
