import { useState } from 'react';
import * as A from '../../engine/actions';
import { fechaAR } from '../../engine/calendar';
import { KIND_LABEL } from '../../engine/config';
import { honorarioReferencia } from '../../engine/clients';
import { deudaVencida } from '../../engine/economy';
import { money, moneyShort, pct } from '../../engine/format';
import { horasMensualesEstimadas, OBLIGACIONES } from '../../engine/obligations';
import { AvatarFace } from '../../scene/Avatar';
import { useGame } from '../../store/game';
import { Bar, Cara, Modal, Stat } from '../components';
import { TaskRow } from '../TaskRow';

export function ClientModal() {
  const g = useGame((s) => s.game)!;
  const id = useGame((s) => s.clientModalId);
  const close = useGame((s) => s.openClient);
  const act = useGame((s) => s.act);
  const c = g.clients.find((x) => x.id === id);
  const [nuevo, setNuevo] = useState(c?.honorario ?? 0);
  if (!c) return null;
  const tareas = g.tasks.filter((t) => t.clientId === c.id).sort((a, b) => (a.estado === 'pendiente' ? -1 : 1) - (b.estado === 'pendiente' ? -1 : 1) || (a.vence < b.vence ? -1 : 1));
  const ref = honorarioReferencia(c, g.inflacion.indice);
  const d = deudaVencida(g, c.id);
  const atraso = g.inflacion.indice / c.honorarioIndice - 1;
  const obligaciones = OBLIGACIONES.filter((o) => o.aplica(c));
  return (
    <Modal wide onClose={() => close(undefined)} label={c.nombre}>
      <div className="modal-pad">
        <header className="row mb">
          <AvatarFace avatar={c.avatar} size={64} />
          <div className="col tight grow minw0">
            <h2 className="ellipsis">{c.nombre}</h2>
            <span className="small muted">
              CUIT {c.cuit} · {KIND_LABEL[c.kind]} · {c.rubro} {c.jurisdiccion === 'convenio' ? '· Convenio Multilateral' : '· IIBB local'}
              {c.categoria ? ` · Cat. ${c.categoria}` : ''}
              {c.cierre ? ` · cierre ${String(c.cierre).padStart(2, '0')}` : ''}
            </span>
          </div>
          <button className="btn ghost sm" onClick={() => close(undefined)} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="stats-grid">
          <Stat label="Abono" value={moneyShort(c.honorario)} sub={`ref. ${moneyShort(ref)}`} />
          <Stat label="Horas/mes" value={`~${horasMensualesEstimadas(c)} h`} sub={`${moneyShort(c.honorario / Math.max(1, horasMensualesEstimadas(c)))}/h`} />
          <Stat label="Satisfacción" value={<><Cara v={c.satisfaccion} /> {Math.round(c.satisfaccion)}</>} />
          <Stat label="Deuda vencida" value={moneyShort(d.monto)} tone={d.monto > 0 ? 'neg' : undefined} sub={`${d.facturas} factura/s`} />
        </div>
        {!c.propio && (
          <div className="card mt">
            <div className="row wrap">
              <b className="small">Ajustar abono</b>
              <span className="tiny muted">Desactualizado {pct(Math.max(0, atraso), 1)} contra inflación · cliente desde {fechaAR(c.desde)}</span>
              <div className="spacer" />
              <input type="number" value={nuevo} step={1000} onChange={(e) => setNuevo(Number(e.target.value))} style={{ width: 130 }} aria-label="Nuevo abono" />
              <button className="btn sm primary" disabled={!nuevo || nuevo === c.honorario} onClick={() => act((dd) => A.setHonorario(dd, c.id, nuevo))}>
                Aplicar
              </button>
            </div>
            <div className="row small mt">
              Orden documental <Bar value={c.ordenDocumental * 100} label="Orden documental" /> Puntualidad de pago <Bar value={c.pagador * 100} label="Puntualidad" />
            </div>
          </div>
        )}
        <h3 className="mt">Obligaciones</h3>
        <div className="chips mb">
          {obligaciones.map((o) => (
            <span key={o.kind} className="chip" title={o.descripcion}>
              {o.icon} {o.nombre}
            </span>
          ))}
        </div>
        <h3>Tareas</h3>
        <div className="task-list">
          {tareas.slice(0, 20).map((t) => (
            <TaskRow key={t.id} g={g} t={t} showClient={false} />
          ))}
          {!tareas.length && <p className="small muted">Sin tareas por ahora.</p>}
        </div>
        {!c.propio && c.activo && (
          <div className="row mt">
            <div className="spacer" />
            <button
              className="btn sm danger"
              onClick={() => {
                if (window.confirm(`¿Dar de baja a ${c.nombre}? Se pierden sus tareas pendientes.`)) {
                  act((dd) => A.darDeBajaCliente(dd, c.id));
                  close(undefined);
                }
              }}
            >
              Dar de baja
            </button>
          </div>
        )}
        <p className="tiny muted mt">Abono de referencia de mercado: {money(ref)} (según tipo, empleados, volumen y jurisdicción).</p>
      </div>
    </Modal>
  );
}
