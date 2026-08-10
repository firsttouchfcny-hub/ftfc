import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans' // self-hosted brand font
import './index.css'
import './styles/tokens.css'                     // design tokens (color + type)
import RedesignApp from './redesign/RedesignApp.jsx'

// The production app is loaded LAZILY on purpose. It initializes Firebase at
// import time, which throws when the env vars are absent (e.g. a preview deploy
// without secrets) — and a static import would take the redesign down with it.
// Importing it only on the routes that need it keeps /r genuinely independent of
// the backend, which is the whole point of the mock seam.
const App = lazy(() => import('./App.jsx'))
const TokenGallery = lazy(() => import('./components/TokenGallery.jsx'))

// Routing:
//   /r/*     → the redesign shell (isolated; production app untouched)
//   /?tokens → the living token specimen (dev only)
//   /        → the current production app
const path = window.location.pathname
const showRedesign = path === '/r' || path.startsWith('/r/')
const showTokens = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('tokens')

const root = showRedesign
  ? <RedesignApp />
  : (
    <Suspense fallback={null}>
      {showTokens ? <TokenGallery /> : <App />}
    </Suspense>
  )

const rootEl = document.getElementById('root')
// The redesign is full-bleed (its background fills the viewport), so lift the
// current app's 520px #root cap for it only. The production app is unaffected.
if (showRedesign) rootEl.style.maxWidth = 'none'

createRoot(rootEl).render(
  <StrictMode>{root}</StrictMode>,
)
