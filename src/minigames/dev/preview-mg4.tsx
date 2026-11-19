// Preview de desarrollo: control de comprobantes (facturas apócrifas). Abrir /preview-mg4.html
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import type { Client, Task } from '../../engine/types';
import type { MinigameResult } from '../types';
import { ApocrifasMinigame } from '../apocrifas/ApocrifasMinigame';

const avatar = { piel: '#e0b48a', pelo: '#3a2a1a', peinado: 'corto' as const, ropa: '#2f6fb5', anteojos: false, barba: false };
const cliente: Client = {
  id: 'c1', nombre: 'Ferretería López SRL', cuit: '30-71234567-8', kind: 'srl', rubro: 'comercio', jurisdiccion: 'local',
  empleados: 3, volumen: 160, ordenDocumental: 0.6, pagador: 0.7, honorario: 400000, honorarioActualizadoEl: '2027-01-01',
  honorarioIndice: 1, satisfaccion: 70, desde: '2025-01-01', riesgoFiscal: 0.2, erroresLatentes: [], avatar, activo: true,
};
const task: Task = {
  id: 't-apoc', clientId: 'c1', kind: 'iva', periodo: '2027-03', titulo: 'Control de comprobantes', vence: '2027-04-20', generada: '2027-04-01', docsLlegan: '2027-04-05',
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
        <ApocrifasMinigame key={`${seed}-${k}`} task={task} client={cliente} seed={seed} indice={1.12} onComplete={(r) => setRes(r)} onCancel={() => setRes('cancel')} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
