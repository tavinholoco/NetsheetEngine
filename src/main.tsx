import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
// Fase F (F.0c, ARQ-09) — fontes auto-hospedadas. O `@import` do Google Fonts
// era recusado pelo CSP de produção (`font-src 'self'`) e a tela caía em fonte
// de sistema. O Vite copia os woff2 para dist/assets, servidos pelo mesmo
// origin; o `unicode-range` de cada peso faz o navegador baixar só o `latin`.
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/share-tech-mono/400.css';
// Fase F (F.1.3) — a voz de display: Orbitron, variável (400–900, 11,5 KB), só
// em título de seção e na marca.
import '@fontsource-variable/orbitron';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Fase 7 (T7.1) — roteamento com URLs reais (/sheet, /dice, /room/:code...) */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
