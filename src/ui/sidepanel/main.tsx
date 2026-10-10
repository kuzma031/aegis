import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidepanelApp } from './SidepanelApp';
import '../styles/base.css';
import '../styles/components.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Side panel root element not found');
}

createRoot(root).render(
  <StrictMode>
    <SidepanelApp />
  </StrictMode>,
);
