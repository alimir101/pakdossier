import { render } from 'preact';
import { App } from './app';
import './styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

// Register only in production: in dev the SW fights the HMR asset graph.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline is a bonus, never a hard requirement */
    });
  });
}
