// Home — "open" variant (roll call open to everyone, 3pm+): game details + the
// I'm in / I'm in +1 sign-up buttons. Built from Figma node 2699:13198.
// The admin early-signup window shows this same screen.

import { useNavigate } from 'react-router-dom';
import GameHeader from '../../components/GameHeader';
import Fab from '../../components/Fab';

export default function HomeOpen() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '64px 24px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
        <GameHeader />
        {/* Button group */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          <Fab label="I’m in +1" variant="secondary" onClick={() => navigate('/game')} />
          <Fab label="I’m in" variant="primary" onClick={() => navigate('/game')} />
        </div>
      </div>
    </div>
  );
}
