import * as A from '../../engine/actions';
import { useGame } from '../../store/game';
import { Modal } from '../components';

export function EventModal() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const ev = g.events[0];
  if (!ev) return null;
  const c = ev.clientId ? g.clients.find((x) => x.id === ev.clientId) : undefined;
  return (
    <Modal label={ev.titulo}>
      <div className="event anim-pop" key={ev.id}>
        <div className="event-icon" aria-hidden>
          {ev.icon}
        </div>
        <h2>{ev.titulo}</h2>
        {c && <span className="chip">{c.nombre.split(' (')[0]}</span>}
        <p className="event-text">{ev.texto}</p>
        <div className="event-options">
          {ev.opciones.map((o) => (
            <button key={o.id} className="btn event-opt" disabled={o.disabled} onClick={() => act((d) => A.elegirOpcion(d, ev.id, o.id))}>
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </button>
          ))}
        </div>
        {g.events.length > 1 && <p className="tiny muted">+{g.events.length - 1} evento/s más esperando</p>}
      </div>
    </Modal>
  );
}
