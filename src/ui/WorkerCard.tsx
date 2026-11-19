// Ficha de un integrante del equipo (pantalla Equipo y modal desde la escena).
import * as A from '../engine/actions';
import { ROLES } from '../engine/config';
import { RASGOS } from '../engine/traits';
import { tarea } from '../engine/core';
import { money, moneyShort } from '../engine/format';
import { horasRestantes } from '../engine/obligations';
import type { Worker } from '../engine/types';
import { AREAS } from '../engine/types';
import { AvatarFace } from '../scene/Avatar';
import { useGame } from '../store/game';
import { Bar, capacidadDiaria, cargaDe, ConfirmButton, corto, Toggle } from './components';

const AREA_ICON = { impuestos: '🧾', sueldos: '💵', contabilidad: '📚' } as const;

export function WorkerCard({ w, full }: { w: Worker; full?: boolean }) {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const carga = cargaDe(g, w);
  const dias = carga / capacidadDiaria(w);
  const esYo = w.id === 'player';
  return (
    <article className={`card worker ${w.renunciaEl ? 'leaving' : ''}`}>
      <header className="row">
        <AvatarFace avatar={w.avatar} size={56} />
        <div className="col tight grow minw0">
          <b className="ellipsis">{esYo ? `${w.nombre} (vos)` : w.nombre}</b>
          <span className="small muted">
            {ROLES[w.role].label}
            {w.rasgo && (
              <span className="chip rasgo" title={RASGOS[w.rasgo].descripcion}>
                {RASGOS[w.rasgo].icon} {RASGOS[w.rasgo].nombre}
              </span>
            )}
          </span>
          <span className="tiny">{w.statusText}</span>
        </div>
        {!esYo && <span className="mono small">{moneyShort(w.sueldo)}</span>}
      </header>
      {w.renunciaEl && <div className="alert bad small">Renunció: se va el {w.renunciaEl.split('-').reverse().join('/')}</div>}
      <div className="skills">
        {AREAS.map((a) => (
          <div key={a} className="skill">
            <span className="small">
              {AREA_ICON[a]} {a}
            </span>
            <Bar value={w.skills[a]} label={`${a} ${Math.round(w.skills[a])}`} />
            <span className="tiny mono">{Math.round(w.skills[a])}</span>
          </div>
        ))}
      </div>
      <div className="row wrap small gap12">
        <span title="Velocidad">⚡ {w.velocidad.toFixed(2)}×</span>
        <span className="row" title="Moral">
          😊 <Bar value={w.moral} tone={w.moral < 30 ? 'bad' : w.moral < 50 ? 'warn' : undefined} label="Moral" />
        </span>
        <span className="row" title="Estrés">
          🔥 <Bar value={w.estres} tone={w.estres > 75 ? 'bad' : w.estres > 50 ? 'warn' : undefined} label="Estrés" />
        </span>
      </div>
      <div className="row small">
        <span>Carga: <b>{carga.toFixed(1)} h</b> (~{dias.toFixed(1)} días)</span>
      </div>
      {full && w.queue.length > 0 && (
        <ol className="queue">
          {w.queue.slice(0, 12).map((id, i) => {
            const t = tarea(g, id);
            if (!t) return null;
            const c = g.clients.find((x) => x.id === t.clientId);
            return (
              <li key={id} className={t.id === w.currentTaskId ? 'cur' : ''}>
                <span className="grow ellipsis small">
                  {t.prioridad ? '⭐ ' : ''}
                  {t.titulo} · <span className="muted">{corto(c?.nombre ?? '')}</span>
                </span>
                <span className="tiny mono muted">{horasRestantes(t).toFixed(1)}h</span>
                {!g.estudio.autoAsignar && (
                  <>
                    <button className="btn sm ghost" disabled={i === 0} onClick={() => act((d) => A.moverEnCola(d, w.id, id, -1), { silent: true })} aria-label="Subir">
                      ▲
                    </button>
                    <button className="btn sm ghost" disabled={i === w.queue.length - 1} onClick={() => act((d) => A.moverEnCola(d, w.id, id, 1), { silent: true })} aria-label="Bajar">
                      ▼
                    </button>
                  </>
                )}
              </li>
            );
          })}
          {w.queue.length > 12 && <li className="tiny muted">…y {w.queue.length - 12} más</li>}
        </ol>
      )}
      <footer className="row wrap">
        <Toggle on={w.horasExtra} onChange={() => act((d) => A.toggleHorasExtra(d, w.id))} label="Horas extra" />
        <div className="spacer" />
        <button className="btn sm" onClick={() => act((d) => A.darDiaLibre(d, w.id))} title="Baja mucho el estrés">
          🏖️ Día libre
        </button>
        {!esYo && (
          <>
            <button className="btn sm" onClick={() => act((d) => A.darAumento(d, w.id, 0.1))} title={`+10%: ${money(w.sueldo * 0.1)}`}>
              💸 +10%
            </button>
            <ConfirmButton title="Hay que pagar preaviso e indemnización" confirmLabel="¿Despedir? Confirmar" onConfirm={() => act((d) => A.despedir(d, w.id))}>
              Despedir
            </ConfirmButton>
          </>
        )}
      </footer>
    </article>
  );
}
