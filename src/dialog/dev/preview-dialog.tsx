// Preview de desarrollo: elegí un diálogo y un cliente, jugalo.
import { produce } from 'immer';
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import '../../ui/app.css';
import { newGame } from '../../engine/newGame';
import { makeRng } from '../../engine/rng';
import type { GameState } from '../../engine/types';
import { avanzar, DIALOGOS, iniciarDialogo, opcionesDe } from '../dialogs';
import { DialogView } from '../DialogView';
import type { DialogState } from '../types';

function App() {
  const base = useMemo(() => newGame({ nombreEstudio: 'Estudio Demo', titular: 'Cr. Martín Prueba', especialidad: 'impuestos', dificultad: 'normal', seed: 42 }), []);
  const [g, setG] = useState<GameState>(base);
  const [defId, setDefId] = useState(DIALOGOS[0].id);
  const [clientId, setClientId] = useState(base.clients.find((c) => !c.propio)!.id);
  const [st, setSt] = useState<DialogState | null>(null);
  const [seed, setSeed] = useState(7);
  const rng = useMemo(() => makeRng(seed), [seed, st?.historial.length]);
  const def = DIALOGOS.find((d) => d.id === defId)!;
  const client = g.clients.find((c) => c.id === clientId)!;
  const titular = g.workers.find((w) => w.id === 'player')!;

  const start = () => {
    const r = makeRng(seed);
    const params = def.params ? def.params(g, client, r) : {};
    let s0 = iniciarDialogo(def, client, params);
    setG(produce(g, (d) => void (s0 = avanzar(s0, d, r))));
    setSt(s0);
  };
  const pick = (id: string) => {
    if (!st) return;
    let n = st;
    setG(produce(g, (d) => void (n = avanzar(st, d, rng, id))));
    setSt(n);
  };

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <div className="row wrap" style={{ padding: 10, gap: 8, background: 'var(--panel-2)', maxWidth: '100vw' }}>
        <select value={defId} onChange={(e) => setDefId(e.target.value)} data-testid="def" style={{ maxWidth: '100%' }}>
          {DIALOGOS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.icon} {d.titulo}
            </option>
          ))}
        </select>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} data-testid="client" style={{ maxWidth: '100%' }}>
          {g.clients.filter((c) => !c.propio).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} · {c.kind} · sat {Math.round(c.satisfaccion)}
            </option>
          ))}
        </select>
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 80 }} aria-label="seed" />
        <button className="btn primary sm" onClick={start} data-testid="start">
          Iniciar
        </button>
        <span className="small muted">
          caja {Math.round(g.estudio.caja / 1000)}k · rep {g.estudio.reputacion.toFixed(1)} · sat {Math.round(client.satisfaccion)} · honorario {client.honorario} · riesgo {client.riesgoFiscal} · errores {client.erroresLatentes.length} · tareas {g.tasks.length} · éticas {g.estudio.faltasEticas}
        </span>
      </div>
      <div style={{ minHeight: 0, maxWidth: 1100, width: '100%', margin: '0 auto', border: '1.5px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
        {st ? <DialogView state={st} def={def} client={client} titular={titular} opciones={opcionesDe(st, g, rng)} onOption={pick} onClose={() => setSt(null)} /> : <p style={{ padding: 20 }}>Elegí un diálogo y tocá Iniciar.</p>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
