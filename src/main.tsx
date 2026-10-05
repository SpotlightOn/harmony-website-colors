import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';
import './styles/site.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root is missing from the document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);