import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans' // self-hosted brand font
import './index.css'
import './styles/tokens.css'                     // design tokens (color + type)
import App from './App.jsx'
import TokenGallery from './components/TokenGallery.jsx'

// Dev-only: ?tokens renders the living token specimen instead of the app.
const showTokens = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('tokens')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {showTokens ? <TokenGallery /> : <App />}
  </StrictMode>,
)
