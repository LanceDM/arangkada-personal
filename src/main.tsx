import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Side-effect import: binds every feature port to an implementation. Must run
// before anything renders, since the first screen may already read history.
import './app/dependencies';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
