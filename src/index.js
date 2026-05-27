import React from 'react';
import ReactDOM from 'react-dom/client';


import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    } catch {
      // Ignore cleanup failures; the app should continue loading normally.
    }
  });
}

if ('caches' in window) {
  window.addEventListener('load', async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    } catch {
      // Ignore cleanup failures; network requests remain the source of truth.
    }
  });
}
