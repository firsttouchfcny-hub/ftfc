/* eslint-disable react-refresh/only-export-components --
   This is the app entry point, not a component module: it has no exports, so
   there is nothing for fast refresh to preserve. The lazy() components below
   are route targets, not a component library. */
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans' // self-hosted brand font
import './index.css'
import './styles/tokens.css'                     // design tokens (color + type)
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Both apps load lazily, so each visitor downloads only the one they'll see.
// This matters in both directions:
//   · the production app initializes Firebase at import time, which throws when
//     the env vars are absent (a preview deploy) — importing it eagerly would
//     take the redesign down with it;
//   · the redesign is dead weight for real players, so it must not sit in the
//     bundle everyone downloads.
const App = lazy(() => import('./App.jsx'))
const RedesignApp = lazy(() => import('./redesign/RedesignApp.jsx'))
const TokenGallery = lazy(() => import('./components/TokenGallery.jsx'))

// The redesign is UNFINISHED and shows mock data — a real player who stumbled
// onto it could believe they're signed up when they aren't. So it is off unless
// explicitly switched on: always available locally, and on deploys only where
// VITE_ENABLE_REDESIGN is set (Preview, not Production).
//
// It deliberately is NOT gated on DEV alone: preview deploys are production
// builds, so that would hide it from the very people reviewing it.
const REDESIGN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_REDESIGN === 'true'

// Routing:
//   /r/*     → the redesign shell, when enabled (falls through to the app if not)
//   /?tokens → the living token specimen (dev only)
//   /        → the current production app
const path = window.location.pathname
const showRedesign = REDESIGN_ENABLED && (path === '/r' || path.startsWith('/r/'))
const showTokens = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('tokens')

const root = showRedesign
  ? <RedesignApp />
  : showTokens ? <TokenGallery /> : <App />

const rootEl = document.getElementById('root')
// The redesign is full-bleed (its background fills the viewport), so lift the
// current app's 520px #root cap for it only. The production app is unaffected.
if (showRedesign) rootEl.style.maxWidth = 'none'

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>{root}</Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
