// Agenda real: calendario de vencimientos y lista con "marcar presentada".
import { useMemo, useState } from 'react';
import { fechaAR, MESES, month, nextMonthKey, year } from '../../engine/calendar';
import { useGame } from '../../store/game';
import { Empty, Segmented } from '../../ui/components';
import { Calendario } from '../../ui/screens/Tareas';
import { hoyISO, type RVencimiento } from '../model';
import { useReal } from '../store';

export function Agenda() {
  const g = useGame((s) => s.game);
  const { data, canEdit, guardarFila } = useReal();
  const hoy = hoyISO();
  const [mesOffset, setMesOffset] = useState(0);
  const [dia, setDia] = useState<string | undefined>();
  const [vista, setVista] = useState<'pendientes' | 'presentadas'>('pendientes');
  const [quien, setQuien] = useState('todos');
  const mes = nextMonthKey(hoy.slice(0, 7), mesOffset);
  const nombreCliente = (id: string) => data.clientes.find((c) => c.id === id)?.razonSocial ?? '—';
  const nombrePersona = (id: string) => data.equipo.find((p) => p.id === id)?.nombre ?? '';

  const lista = useMemo(() => {
    let l = data.vencimientos.filter((v) => (vista === 'pendientes' ? v.estado === 'pendiente' : v.estado !== 'pendiente'));
    if (quien !== 'todos') l = l.filter((v) => v.responsable === quien);
    if (dia) l = l.filter((v) => v.vence === dia);
    return l.sort((a, b) => (vista === 'pendientes' ? (a.vence < b.vence ? -1 : 1) : (b.presentadaEl || b.vence) < (a.presentadaEl || a.vence) ? -1 : 1)).slice(0, 200);
  }, [data.vencimientos, vista, quien, dia]);

  const marcar = (v: RVencimiento, estado: RVencimiento['estado']) => {
    const presentadaEl = estado === 'pendiente' ? '' : hoy;
    void guardarFila('vencimientos', { ...v, estado: estado === 'pendiente' ? 'pendiente' : hoy > v.vence ? 'presentada_tarde' : 'presentada', presentadaEl });
  };

  if (!g) return null;
  return (
    <div className="screen tareas">
      <div className="tareas-grid">
        <section className="card">
          <header className="section-head">
            <button className="btn sm ghost" onClick={() => setMesOffset(mesOffset - 1)} aria-label="Mes anterior">‹</button>
            <h3 className="grow center">{MESES[month(mes + '-01') - 1]} {year(mes + '-01')}</h3>
            <button className="btn sm ghost" onClick={() => setMesOffset(mesOffset + 1)} aria-label="Mes siguiente">›</button>
          </header>
          <Calendario g={g} mes={mes} sel={dia} onSel={setDia} />
          <p className="tiny muted mt">Los números son vencimientos pendientes. Cargalos o generalos por mes en "Cargar datos → Vencimientos".</p>
        </section>
        <section className="card">
          <header className="section-head wrap">
            <Segmented size="sm" value={vista} onChange={setVista} options={[{ v: 'pendientes', label: `Pendientes (${data.vencimientos.filter((v) => v.estado === 'pendiente').length})` }, { v: 'presentadas', label: 'Presentadas' }]} />
            <div className="spacer" />
            <select value={quien} onChange={(e) => setQuien(e.target.value)} className="sel-sm" aria-label="Filtrar por persona">
              <option value="todos">Todo el equipo</option>
              {data.equipo.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {dia && <button className="chip info" onClick={() => setDia(undefined)}>{fechaAR(dia)} ✕</button>}
          </header>
          {lista.length ? (
            <div className="task-list">
              {lista.map((v) => {
                const dias = Math.round((new Date(v.vence).getTime() - new Date(hoy).getTime()) / 86400000);
                const sem = v.estado !== 'pendiente' ? (v.estado === 'presentada' ? 'ok' : 'bad') : dias < 0 ? 'bad' : dias <= 3 ? 'warn' : 'ok';
                return (
                  <div key={v.id} className={`task-row ${sem}`}>
                    <div className={`task-due chip ${sem}`}>
                      {v.estado === 'pendiente' ? (dias < 0 ? 'VENCIDA' : dias === 0 ? 'Vence HOY' : `${dias} días`) : v.estado === 'presentada' ? '✔ En término' : '⏰ Tarde'}
                      <small>{fechaAR(v.vence).slice(0, 5)}</small>
                    </div>
                    <div className="task-main">
                      <div className="task-title"><b>{v.impuesto} {v.periodo}</b></div>
                      <span className="small muted">{nombreCliente(v.clienteId)}{v.responsable ? ` · ${nombrePersona(v.responsable)}` : ''}{v.horasEstimadas ? ` · ${v.horasEstimadas} h` : ''}</span>
                      {v.notas && <span className="tiny muted">{v.notas}</span>}
                    </div>
                    {canEdit && (
                      <div className="task-actions">
                        {v.estado === 'pendiente' ? (
                          <button className="btn sm primary" onClick={() => marcar(v, 'presentada')}>✔ Presentada</button>
                        ) : (
                          <button className="btn sm ghost" onClick={() => marcar(v, 'pendiente')}>↩ Volver a pendiente</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon="✅">No hay vencimientos con esos filtros.</Empty>
          )}
        </section>
      </div>
    </div>
  );
}
