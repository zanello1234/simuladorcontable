import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import '../ui/app.css';
import './real.css';
import { RealApp } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RealApp />
  </StrictMode>,
);
