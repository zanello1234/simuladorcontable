// Preview de desarrollo: Asientos del mes y Cierre de ejercicio. Abrir /preview-mg5.html
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import type { Client, Task } from '../../engine/types';
import type { MinigameResult } from '../types';
import { AsientosMinigame } from '../asientos/AsientosMinigame';
import { CierreMinigame } from '../cierre/CierreMinigame';

const avatar = { piel: '#e0b48a', pelo: '#3a2a1a', peinado: 'corto' as const, ropa: '#2f6fb5', anteojos: false, barba: false };
const cliente: Client = {
  id: 'c1', nombre: 'Ferretería López SRL', cuit: '30-71234567-8', kind: 'srl', rubro: 'comercio', jurisdiccion: 'local',
  empleados: 3, volumen: 160, ordenDocumental: 0.6, pagador: 0.7, honorario: 400000, honorarioActualizadoEl: '2027-01-01',
  honorarioIndice: 1, satisfaccion: 70, desde: '2025-01-01', riesgoFiscal: 0.2, erroresLatentes: [], avatar, activo: true, cierre: 12,
};
const task = (kind: Task['kind'], periodo: string): Task => ({
  id: `t-${kind}`, clientId: 'c1', kind, periodo, titulo: kind, vence: '2027-04-28', generada: '2027-04-01', docsLlegan: '2027-04-05',
  docsRecibidos: true, reclamos: 0, steps: [], stepIndex: 2, estado: 'pendiente', errores: 0, corregidos: 0, saltearRevision: false, vencida: false,
});

function App() {
  const params = new URLSearchParams(location.search);
  const [juego, setJuego] = useState<'asientos' | 'cierre'>((params.get('mg') as 'asientos' | 'cierre') || 'asientos');
  const [seed, setSeed] = useState(Number(params.get('seed') || 4242));
  const [res, setRes] = useState<MinigameResult | 'cancel'>();
  const [k, setK] = useState(0);
  const props = { seed, indice: 1.12, onComplete: (r: MinigameResult) => setRes(r), onCancel: () => setRes('cancel') };
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100vh' }}>
      <div className="row wrap">
        <button className={`btn sm ${juego === 'asientos' ? 'primary' : ''}`} onClick={() => { setJuego('asientos'); setRes(undefined); setK(k + 1); }}>Asientos</button>
        <button className={`btn sm ${juego === 'cierre' ? 'primary' : ''}`} onClick={() => { setJuego('cierre'); setRes(undefined); setK(k + 1); }}>Cierre</button>
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 110 }} aria-label="seed" />
        <button className="btn sm" onClick={() => { setSeed(Math.floor(Math.random() * 1e6)); setRes(undefined); setK(k + 1); }}>Nuevo caso</button>
        {res && <pre id="mg-result" className="tiny" style={{ margin: 0, maxWidth: 600, whiteSpace: 'pre-wrap' }}>{JSON.stringify(res)}</pre>}
      </div>
      <div style={{ flex: 1, minHeight: 0, background: 'var(--panel)', border: '1.5px solid var(--line)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        {juego === 'asientos' ? (
          <AsientosMinigame key={`as-${seed}-${k}`} task={task('registracion', '2027-03')} client={cliente} {...props} />
        ) : (
          <CierreMinigame key={`ci-${seed}-${k}`} task={task('balance', '2026')} client={cliente} {...props} />
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
