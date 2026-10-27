import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initI18n } from './i18n';
import { App } from './app/App';

declare global {
  const __APP_VERSION__: string;
}

void initI18n().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
