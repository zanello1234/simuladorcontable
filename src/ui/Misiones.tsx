// Tarjeta de misiones (metas de corto plazo) + acceso a logros.
import { useState } from 'react';
import { LOGROS, misionesVisibles } from '../engine/progression';
import { money } from '../engine/format';
import { precio } from '../engine/core';
import { useGame } from '../store/game';
import { Bar, Modal, Section } from './components';

export function Misiones() {
  const g = useGame((s) => s.game)!;
  const [logros, setLogros] = useState(false);
  const vis = misionesVisibles(g);
  const total = g.progreso.logros.length;
  return (
    <Section
      title="🎯 Misiones"
      right={
        <button className="btn sm ghost" onClick={() => setLogros(true)}>
          🏅 Logros {total}/{LOGROS.length}
        </button>
      }
    >
      {vis.length ? (
        <ul className="misiones">
          {vis.map((m) => {
            const p = m.progreso ? Math.min(1, m.progreso(g)) : 0;
            const premio = [m.premioCaja ? money(precio(g, m.premioCaja)) : '', m.premioRep ? `+${m.premioRep} ⭐` : ''].filter(Boolean).join(' · ');
            return (
              <li key={m.id} className="mision">
                <span className="mision-icon" aria-hidden>
                  {m.icon}
                </span>
                <div className="col tight grow minw0">
                  <b className="small">{m.titulo}</b>
                  <span className="tiny muted">{m.texto}</span>
                  {m.progreso && <Bar value={p * 100} label={`${Math.round(p * 100)}%`} />}
                </div>
                {premio && <span className="tiny mision-premio">{premio}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="small muted">Completaste todas las misiones. ¡Ahora el límite lo ponés vos!</p>
      )}
      {g.progreso.racha >= 3 && (
        <p className="small mt">
          🔥 Racha actual: <b>{g.progreso.racha}</b> presentaciones en término seguidas (récord {g.progreso.mejorRacha}).
        </p>
      )}
      {logros && (
        <Modal onClose={() => setLogros(false)} label="Logros">
          <div className="modal-pad">
            <h2>🏅 Logros</h2>
            <p className="small muted mb">
              {total} de {LOGROS.length} desbloqueados.
            </p>
            <ul className="logros">
              {LOGROS.map((l) => {
                const ok = g.progreso.logros.includes(l.id);
                return (
                  <li key={l.id} className={`logro ${ok ? 'ok' : ''}`}>
                    <span className="logro-icon" aria-hidden>
                      {ok ? l.icon : l.secreto ? '❓' : '🔒'}
                    </span>
                    <div className="col tight">
                      <b className="small">{ok || !l.secreto ? l.titulo : 'Logro secreto'}</b>
                      <span className="tiny muted">{ok || !l.secreto ? l.texto : 'Seguí jugando para descubrirlo.'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button className="btn block mt" onClick={() => setLogros(false)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </Section>
  );
}
