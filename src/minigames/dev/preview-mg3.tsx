// Preview de desarrollo: Ganancias PH con datos mock. Abrir /preview-mg3.html?seed=N
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import type { Client, Task } from '../../engine/types';
import type { MinigameResult } from '../types';
import { GananciasMinigame } from '../ganancias/GananciasMinigame';

const avatar = { piel: '#e0b48a', pelo: '#3a2a1a', peinado: 'corto' as const, ropa: '#2f6fb5', anteojos: false, barba: false };
const cliente: Client = {
  id: 'c1', nombre: 'Jorge Pérez (Almacén Ricci)', cuit: '20-22334455-6', kind: 'ri_persona', rubro: 'comercio', jurisdiccion: 'local',
  empleados: 2, volumen: 120, ordenDocumental: 0.6, pagador: 0.7, honorario: 250000, honorarioActualizadoEl: '2027-01-01',
  honorarioIndice: 1, satisfaccion: 70, desde: '2025-01-01', riesgoFiscal: 0.2, erroresLatentes: [], avatar, activo: true,
};
const task: Task = {
  id: 't-gan', clientId: 'c1', kind: 'ganancias_ph', periodo: '2026', titulo: 'Ganancias PH 2026', vence: '2027-06-12', generada: '2027-04-01', docsLlegan: '2027-04-20',
  docsRecibidos: true, reclamos: 0, steps: [], stepIndex: 2, estado: 'pendiente', errores: 0, corregidos: 0, saltearRevision: false, vencida: false,
};

function App() {
  const params = new URLSearchParams(location.search);
  const [seed, setSeed] = useState(Number(params.get('seed') || 12345));
  const [res, setRes] = useState<MinigameResult | 'cancel'>();
  const [k, setK] = useState(0);
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100vh' }}>
      <div className="row wrap">
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 110 }} aria-label="seed" />
        <button className="btn sm" onClick={() => { setSeed(Math.floor(Math.random() * 1e6)); setRes(undefined); setK(k + 1); }}>Nuevo caso</button>
        {res && <pre id="mg-result" className="tiny" style={{ margin: 0, maxWidth: 600, whiteSpace: 'pre-wrap' }}>{JSON.stringify(res)}</pre>}
      </div>
      <div style={{ flex: 1, minHeight: 0, background: 'var(--panel)', border: '1.5px solid var(--line)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <GananciasMinigame key={`${seed}-${k}`} task={task} client={cliente} seed={seed} indice={1.12} onComplete={(r) => setRes(r)} onCancel={() => setRes('cancel')} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
