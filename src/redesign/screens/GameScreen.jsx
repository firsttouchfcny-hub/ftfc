// "You're in" — post-sign-up game details + roster. Skeleton shows the header
// and the structure that will fill in (gear takers strip + Match 1/2/Bench list).

import { useNavigate } from 'react-router-dom';
import Scaffold from '../components/Scaffold';
import PillButton from '../components/PillButton';

export default function GameScreen() {
  const navigate = useNavigate();
  return (
    <>
      <div style={{ textAlign: 'center', padding: '16px 20px 0' }}>
        <h1 className="type-heading-h1" style={{ marginBottom: 4 }}>You&rsquo;re in</h1>
        <p className="type-body-regular" style={{ color: 'var(--color-dark-gray-50)' }}>
          Thursday, Oct 11th · 07:00 AM · McCarren Park
        </p>
      </div>
      <Scaffold
        title="Game & roster"
        blurb="Where a signed-up player lands."
        planned={[
          'Tomorrow’s gear takers strip (Goals / Goals / Balls / Bibs)',
          'Match 1 (18) · Match 2 (18) · Bench sections',
          'Player rows: avatar, name, gear "Bringing" badge, admin crown',
          'Standing variants: Match 2 on-hold / cancelled, bench',
          'Out / leave action',
        ]}
      >
        <PillButton variant="secondary" onClick={() => navigate('/')}>← Back to home</PillButton>
      </Scaffold>
    </>
  );
}
