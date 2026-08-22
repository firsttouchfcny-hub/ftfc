// Redesign shell: client-side routing + the persistent top nav.
//
// Mounted at basename "/r" so it lives alongside the current production app
// (which stays at "/"). When the team greenlights the redesign, we flip main.jsx
// to make this the default and drop the basename.
//
// Layout route (with TopNav):  /  /game  /profile  /rules  /gear
// Standalone (no nav):         /create-account

import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import './styles.css';
import TopNav from './components/TopNav';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import AdminToolsScreen from './screens/AdminToolsScreen';
import RulesScreen from './screens/RulesScreen';
import GearScreen from './screens/GearScreen';

function AppLayout() {
  return (
    // Full-bleed background fills the viewport…
    <div
      style={{
        minHeight: '100dvh', background: 'var(--color-light-olive)',
        color: 'var(--color-dark-gray)', fontFamily: 'var(--font-family-base)',
      }}
    >
      {/* …content stays in a centered 430px column. */}
      <div style={{ maxWidth: 430, margin: '0 auto' }}>
        <TopNav />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function RedesignApp() {
  return (
    <BrowserRouter basename="/r">
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomeScreen />} />
          <Route path="game" element={<GameScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="profile/edit" element={<EditProfileScreen />} />
          <Route path="profile/admin" element={<AdminToolsScreen />} />
          <Route path="rules" element={<RulesScreen />} />
          <Route path="gear" element={<GearScreen />} />
        </Route>
        <Route path="create-account" element={<CreateAccountScreen />} />
        <Route path="*" element={<HomeScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
