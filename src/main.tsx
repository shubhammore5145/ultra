import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA Service Worker for offline capability & automatic updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New MartGPT PWA update available.');
  },
  onOfflineReady() {
    console.log('MartGPT PWA is ready for offline use.');
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

