// Preview de desarrollo del Tablero del titular con una partida jugada headless. Abrir /preview-tablero.html
import { produce } from 'immer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../app.css';
import * as A from '../../engine/actions';
import { monthKey } from '../../engine/calendar';
import { newGame } from '../../engine/newGame';
import { tick } from '../../engine/simulation';
import type { GameState } from '../../engine/types';
import { useGame } from '../../store/game';
import { Toasts } from '../components';
import { ClientModal } from '../modals/ClientModal';
import { WorkerModal } from '../modals/WorkerModal';
import { Tablero } from '../screens/Tablero';

const params = new URLSearchParams(location.search);
const meses = Number(params.get('meses') || 3);
const seed = Number(params.get('seed') || 4242);
if (params.get('theme')) document.documentElement.setAttribute('data-theme', params.get('theme')!);

function jugar(): GameState {
  let s = newGame({ nombreEstudio: 'Estudio Preview', titular: 'Cr. Preview', especialidad: 'impuestos', dificultad: 'normal', seed });
  const ini = monthKey(s.date);
  const [y, m] = ini.split('-').map(Number);
  const hasta = `${y + Math.floor((m - 1 + meses) / 12)}-${String(((m - 1 + meses) % 12) + 1).padStart(2, '0')}-03`;
  let guard = 0;
  while (s.date < hasta && !s.gameOver && guard++ < 30000) {
    s = produce(s, (d) => {
      while (d.events.length) A.elegirOpcion(d, d.events[0].id, (d.events[0].opciones.find((o) => !o.disabled) ?? d.events[0].opciones[0]).id);
      if (d.dialogo) A.cerrarConversacion(d);
      if (d.estudio.facturasEmitidasMes !== monthKey(d.date)) A.facturarMes(d);
      for (const p of [...d.prospects]) A.enviarPropuesta(d, p.id, p.honorarioReferencia);
      if (d.workers.length < 3 && d.estudio.caja > 4_000_000 && d.candidates.length) {
        if (d.workers.length >= 2 && d.estudio.oficina === 0) A.mudarOficina(d, 1);
        A.contratar(d, d.candidates[0].id);
      }
      for (const t of d.tasks) if (t.estado === 'pendiente' && t.requiereTitular && A.minijuegoDisponible(d, t.id).ok) A.completarMinijuego(d, t.id, 0.9, 2);
      tick(d);
    });
  }
  return s;
}

const g = produce(jugar(), (d) => {
  d.objetivos.push({ id: 'o1', tipo: 'clientes', meta: 12, creado: d.estudio.inicio }, { id: 'o2', tipo: 'caja', meta: 2_000_000, creado: d.estudio.inicio, cumplidoEl: d.date });
});
useGame.getState().load(g);

function App() {
  const workerModal = useGame((s) => s.workerModalId);
  const clientModal = useGame((s) => s.clientModalId);
  return (
    <div style={{ padding: 12, maxWidth: 1400, margin: '0 auto' }}>
      <p className="tiny muted">Preview · {g.date} · {meses} meses · seed {seed}</p>
      <Tablero />
      <Toasts />
      {workerModal && <WorkerModal />}
      {clientModal && <ClientModal />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
