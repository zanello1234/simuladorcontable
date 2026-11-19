// Fila de tarea (se usa en Escritorio, Tareas y fichas de cliente).
import { memo } from 'react';
import * as A from '../engine/actions';
import { fechaAR, fechaCorta } from '../engine/calendar';
import { iconDe, horasRestantes } from '../engine/obligations';
import type { GameState, Task } from '../engine/types';
import { STEP_LABEL } from '../engine/types';
import { MINIGAMES } from '../minigames/registry';
import { useGame } from '../store/game';
import { corto, primerNombre, semaforo, StepDots, venceTexto } from './components';

interface Props {
  g: GameState;
  t: Task;
  compact?: boolean;
  showClient?: boolean;
}

function TaskRowImpl({ g, t, compact, showClient = true }: Props) {
  const act = useGame((s) => s.act);
  const openMinigame = useGame((s) => s.openMinigame);
  const openClient = useGame((s) => s.openClient);
  const c = g.clients.find((x) => x.id === t.clientId);
  const pendiente = t.estado === 'pendiente';
  const step = t.steps[t.stepIndex];
  const sem = pendiente ? semaforo(g, t) : t.estado === 'presentada' ? 'ok' : 'bad';
  const mg = pendiente && t.minigame ? A.minijuegoDisponible(g, t.id) : null;
  const h = horasRestantes(t);

  return (
    <div className={`task-row ${sem} ${compact ? 'compact' : ''} ${t.prioridad ? 'prio' : ''}`}>
      <div className={`task-due chip ${sem}`} title={`Vence ${fechaAR(t.vence)}`}>
        {pendiente ? venceTexto(g, t) : t.estado === 'presentada' ? '✔ En término' : '⏰ Tarde'}
        <small>{fechaCorta(t.vence)}</small>
      </div>
      <div className="task-main">
        <div className="task-title">
          <span className="task-icon" aria-hidden>
            {iconDe(t.kind)}
          </span>
          <b>{t.titulo}</b>
          {t.prioridad && <span title="Prioridad">⭐</span>}
          {t.honorarioExtra ? <span className="chip accent" title="Se factura aparte">+$</span> : null}
        </div>
        {showClient && c && (
          <button className="linkish small muted" onClick={() => openClient(c.id)}>
            {corto(c.nombre)}
          </button>
        )}
        {pendiente && (
          <div className="task-progress">
            <StepDots t={t} />
            <span className="tiny muted">
              {step ? STEP_LABEL[step.kind] : ''} · {h.toFixed(1)} h
              {!t.docsRecibidos && ' · 📭 sin papeles'}
              {t.saltearRevision && ' · sin revisión'}
            </span>
          </div>
        )}
        {!pendiente && t.presentadaEl && <span className="tiny muted">Presentada el {fechaAR(t.presentadaEl)}{t.corregidos ? ` · ${t.corregidos} error/es corregido/s en revisión` : ''}{t.minigameScore !== undefined ? ` · hecha a mano: ${Math.round(t.minigameScore * 100)}/100` : ''}</span>}
      </div>
      {pendiente && (
        <div className="task-actions">
          <select
            className="sel-sm"
            value={t.asignadoA ?? ''}
            onChange={(e) => act((d) => A.asignarTarea(d, t.id, e.target.value || undefined), { silent: true })}
            aria-label="Asignar a"
          >
            <option value="">— sin asignar —</option>
            {g.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.id === 'player' ? 'Yo (titular)' : primerNombre(w.nombre)}
              </option>
            ))}
          </select>
          {!compact && (
            <>
              <button className={`btn sm ghost ${t.prioridad ? 'on' : ''}`} title="Priorizar" onClick={() => act((d) => A.priorizar(d, t.id))}>
                ⭐
              </button>
              <button className="btn sm ghost" title={t.saltearRevision ? 'Volver a revisar antes de presentar' : 'Presentar sin revisión'} onClick={() => act((d) => A.toggleRevision(d, t.id))}>
                {t.saltearRevision ? '🙈' : '🔍'}
              </button>
            </>
          )}
          {!t.docsRecibidos && (
            <button className="btn sm" title="Reclamar documentación por WhatsApp" onClick={() => act((d) => A.reclamarDocs(d, t.id))}>
              📞 Reclamar
            </button>
          )}
          {mg && t.minigame && (
            <button className="btn sm primary" disabled={!mg.ok} title={mg.ok ? `${MINIGAMES[t.minigame].meta.titulo} (${MINIGAMES[t.minigame].meta.horas} h)` : mg.motivo} onClick={() => openMinigame(t.id)}>
              🎮 Hacerla yo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const TaskRow = memo(TaskRowImpl);
