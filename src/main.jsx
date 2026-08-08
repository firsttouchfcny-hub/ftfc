import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans' // self-hosted brand font
import './index.css'
import './styles/tokens.css'                     // design tokens (color + type)
import App from './App.jsx'
import TokenGallery from './components/TokenGallery.jsx'
import RedesignApp from './redesign/RedesignApp.jsx'

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
  : showTokens
    ? <TokenGallery />
    : <App />

const rootEl = document.getElementById('root')
// The redesign is full-bleed (its background fills the viewport), so lift the
// current app's 520px #root cap for it only. The production app is unaffected.
if (showRedesign) rootEl.style.maxWidth = 'none'

createRoot(rootEl).render(
  <StrictMode>{root}</StrictMode>,
)
