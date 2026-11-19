import { useMemo, useState } from 'react';
import { day, fechaLarga, feriados, isBusinessDay, lastDayOfMonth, MESES, month, nextMonthKey, weekday, year, ymd } from '../../engine/calendar';
import type { GameState } from '../../engine/types';
import { useGame } from '../../store/game';
import { Empty, pendientes, primerNombre, Segmented } from '../components';
import { TaskRow } from '../TaskRow';

function Calendario({ g, mes, sel, onSel }: { g: GameState; mes: string; sel?: string; onSel: (d?: string) => void }) {
  const [y, m] = mes.split('-').map(Number);
  const n = lastDayOfMonth(y, m);
  const primero = ymd(y, m, 1);
  const offset = (weekday(primero) + 6) % 7; // lunes primero
  const fer = feriados(y);
  const porDia = useMemo(() => {
    const map = new Map<string, { n: number; urg: boolean; vencidas: boolean }>();
    for (const t of g.tasks) {
      if (!t.vence.startsWith(mes)) continue;
      if (t.estado !== 'pendiente') continue;
      const e = map.get(t.vence) ?? { n: 0, urg: false, vencidas: false };
      e.n += 1;
      if (t.vencida) e.vencidas = true;
      map.set(t.vence, e);
    }
    return map;
  }, [g.tasks, mes]);
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: n }, (_, i) => ymd(y, m, i + 1))];
  return (
    <div className="cal">
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
        <span key={i} className="cal-h">
          {d}
        </span>
      ))}
      {celdas.map((d, i) => {
        if (!d) return <span key={i} />;
        const info = porDia.get(d);
        const habil = isBusinessDay(d);
        const cls = ['cal-d', !habil && 'inhabil', d === g.date && 'hoy', d < g.date && 'pasado', sel === d && 'sel', info && 'con', info?.vencidas && 'venc'].filter(Boolean).join(' ');
        return (
          <button key={d} className={cls} onClick={() => onSel(sel === d ? undefined : d)} title={`${fechaLarga(d)}${fer.get(d) ? ` · ${fer.get(d)}` : ''}${info ? ` · ${info.n} vencimiento/s` : ''}`}>
            <span>{day(d)}</span>
            {info && <i>{info.n}</i>}
          </button>
        );
      })}
    </div>
  );
}

export function Tareas() {
  const g = useGame((s) => s.game)!;
  const [vista, setVista] = useState<'pendientes' | 'presentadas'>('pendientes');
  const [quien, setQuien] = useState<string>('todos');
  const [dia, setDia] = useState<string | undefined>();
  const [mesOffset, setMesOffset] = useState(0);
  const mes = nextMonthKey(g.date.slice(0, 7), mesOffset);

  let lista = vista === 'pendientes' ? pendientes(g) : g.tasks.filter((t) => t.estado !== 'pendiente');
  if (quien === 'sin') lista = lista.filter((t) => !t.asignadoA || !g.workers.some((w) => w.queue.includes(t.id)));
  else if (quien !== 'todos') lista = lista.filter((t) => t.asignadoA === quien);
  if (dia) lista = lista.filter((t) => t.vence === dia);
  lista = lista.sort((a, b) => (vista === 'pendientes' ? (a.vence < b.vence ? -1 : 1) : (b.presentadaEl ?? '') < (a.presentadaEl ?? '') ? -1 : 1)).slice(0, 120);

  return (
    <div className="screen tareas">
      <div className="tareas-grid">
        <section className="card">
          <header className="section-head">
            <button className="btn sm ghost" onClick={() => setMesOffset(mesOffset - 1)} aria-label="Mes anterior">
              ‹
            </button>
            <h3 className="grow center">
              {MESES[month(mes + '-01') - 1]} {year(mes + '-01')}
            </h3>
            <button className="btn sm ghost" onClick={() => setMesOffset(mesOffset + 1)} aria-label="Mes siguiente">
              ›
            </button>
          </header>
          <Calendario g={g} mes={mes} sel={dia} onSel={setDia} />
          <p className="tiny muted mt">Los números son vencimientos pendientes. Si un vencimiento cae en día inhábil, se corre al próximo hábil.</p>
        </section>

        <section className="card">
          <header className="section-head wrap">
            <Segmented
              value={vista}
              onChange={setVista}
              options={[
                { v: 'pendientes', label: `Pendientes (${pendientes(g).length})` },
                { v: 'presentadas', label: 'Presentadas' },
              ]}
              size="sm"
            />
            <div className="spacer" />
            <select value={quien} onChange={(e) => setQuien(e.target.value)} className="sel-sm" aria-label="Filtrar por persona">
              <option value="todos">Todo el equipo</option>
              <option value="sin">Sin asignar</option>
              {g.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id === 'player' ? 'Yo' : primerNombre(w.nombre)}
                </option>
              ))}
            </select>
            {dia && (
              <button className="chip info" onClick={() => setDia(undefined)}>
                {dia.split('-').reverse().join('/')} ✕
              </button>
            )}
          </header>
          {lista.length ? (
            <div className="task-list">
              {lista.map((t) => (
                <TaskRow key={t.id} g={g} t={t} />
              ))}
            </div>
          ) : (
            <Empty icon="✅">No hay tareas con esos filtros.</Empty>
          )}
        </section>
      </div>
    </div>
  );
}
