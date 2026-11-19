// Página de desarrollo para jugar los minijuegos de sueldos y conciliación sin el resto del juego.
// Abrir /preview-mg2.html?mg=sueldos&seed=3 con `npx vite`.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import { ConciliacionMinigame } from '../conciliacion/ConciliacionMinigame';
import { SueldosMinigame } from '../sueldos/SueldosMinigame';
import type { MinigameResult } from '../types';
import { mockClient, mockTask } from './mocks-mg2';

type Mg = 'sueldos' | 'conciliacion';

function Preview() {
  const qs = new URLSearchParams(location.search);
  const [mg, setMg] = useState<Mg>((qs.get('mg') as Mg) || 'sueldos');
  const [seed, setSeed] = useState(Number(qs.get('seed') || 7));
  const [n, setN] = useState(0);
  const [res, setRes] = useState<MinigameResult | 'cancel' | null>(null);
  const client = useMemo(() => mockClient({ kind: qs.get('kind') === 'mono' ? 'monotributista' : 'srl', empleados: Number(qs.get('emp') || 4) }), []);
  const task = useMemo(() => (mg === 'sueldos' ? mockTask('sueldos', qs.get('periodo') || '2027-03') : mockTask('balance', qs.get('periodo') || '2026')), [mg]);
  const props = {
    task,
    client,
    seed,
    indice: 1.12,
    onComplete: (r: MinigameResult) => setRes(r),
    onCancel: () => setRes('cancel'),
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="row wrap" style={{ padding: 8, background: 'var(--brand)', color: '#fff' }}>
        <b>Preview MG2</b>
        <button className={`btn sm ${mg === 'sueldos' ? 'primary' : ''}`} onClick={() => { setMg('sueldos'); setRes(null); setN(n + 1); }}>Sueldos</button>
        <button className={`btn sm ${mg === 'conciliacion' ? 'primary' : ''}`} onClick={() => { setMg('conciliacion'); setRes(null); setN(n + 1); }}>Conciliación</button>
        <label className="small">seed <input type="number" value={seed} style={{ width: 70 }} onChange={(e) => setSeed(Number(e.target.value))} /></label>
        <button className="btn sm" onClick={() => { setRes(null); setN(n + 1); }}>Reiniciar</button>
        {res && <span className="small" data-testid="resultado">{res === 'cancel' ? 'cancelado' : `score ${res.score.toFixed(3)} · ${res.resumen}`}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 'min(16px, 2vw)', display: 'flex' }}>
        <div className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1100, margin: '0 auto' }}>
          {mg === 'sueldos' ? <SueldosMinigame key={`s${n}-${seed}`} {...props} /> : <ConciliacionMinigame key={`c${n}-${seed}`} {...props} />}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
