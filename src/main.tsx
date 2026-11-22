import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA Service Worker for offline capability & automatic updates
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New update available, applying immediately...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] MartGPT PWA is ready for offline use.');
  },
  onRegisteredSW(_swUrl, r) {
    if (r) {
      r.update().catch(() => {});
      setInterval(() => r.update().catch(() => {}), 60 * 1000);
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

