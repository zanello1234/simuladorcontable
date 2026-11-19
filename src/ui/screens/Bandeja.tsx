import { useState } from 'react';
import * as A from '../../engine/actions';
import { fechaCorta } from '../../engine/calendar';
import type { Canal } from '../../engine/types';
import { useGame } from '../../store/game';
import { Empty, Segmented } from '../components';

const CANAL: Record<Canal, { icon: string; label: string }> = {
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  email: { icon: '✉️', label: 'Mail' },
  dfe: { icon: '🏛️', label: 'Domicilio Fiscal Electrónico' },
  sistema: { icon: '🔔', label: 'Sistema' },
  telefono: { icon: '📞', label: 'Teléfono' },
};

export function Bandeja() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const [filtro, setFiltro] = useState<'todos' | 'noleidos' | 'dfe'>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  let msgs = g.inbox;
  if (filtro === 'noleidos') msgs = msgs.filter((m) => !m.leido);
  if (filtro === 'dfe') msgs = msgs.filter((m) => m.canal === 'dfe');

  return (
    <div className="screen bandeja">
      <div className="row wrap mb">
        <Segmented
          size="sm"
          value={filtro}
          onChange={setFiltro}
          options={[
            { v: 'todos', label: 'Todos' },
            { v: 'noleidos', label: `No leídos (${g.inbox.filter((m) => !m.leido).length})` },
            { v: 'dfe', label: '🏛️ ARCA' },
          ]}
        />
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => act((d) => A.marcarLeido(d), { silent: true })}>
          Marcar todo leído
        </button>
      </div>
      {msgs.length ? (
        <ul className="inbox">
          {msgs.map((m) => {
            const open = abierto === m.id;
            return (
              <li key={m.id} className={`msg ${m.leido ? '' : 'unread'} ${m.importante ? 'imp' : ''} ${m.canal}`}>
                <button
                  className="msg-head"
                  onClick={() => {
                    setAbierto(open ? null : m.id);
                    if (!m.leido) act((d) => A.marcarLeido(d, m.id), { silent: true });
                  }}
                  aria-expanded={open}
                >
                  <span className="msg-icon" title={CANAL[m.canal].label} aria-hidden>
                    {CANAL[m.canal].icon}
                  </span>
                  <span className="col tight grow minw0">
                    <span className="msg-from small">{m.de}</span>
                    <span className="msg-subj ellipsis">{m.asunto}</span>
                  </span>
                  <span className="tiny muted">{fechaCorta(m.date)}</span>
                </button>
                {open && <p className="msg-body small anim-up">{m.cuerpo}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon="📭">Bandeja vacía.</Empty>
      )}
    </div>
  );
}
