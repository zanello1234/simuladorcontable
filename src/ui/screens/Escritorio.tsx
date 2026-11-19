import * as A from '../../engine/actions';
import { addBusinessDays, monthKey } from '../../engine/calendar';
import { money, moneyShort } from '../../engine/format';
import { porCobrar } from '../../engine/economy';
import { player } from '../../engine/core';
import { tareasQueDeboHacer } from '../../engine/titular';
import type { PlayerIdle } from '../../engine/types';
import { AvatarFace } from '../../scene/Avatar';
import { useGame } from '../../store/game';
import { Bar, capacidadDiaria, cargaDe, costoMensual, Empty, ingresoMensual, pendientes, primerNombre, Section, Segmented, Stat, Toggle } from '../components';
import { Misiones } from '../Misiones';
import { TaskRow } from '../TaskRow';

export function Escritorio() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const setTab = useGame((s) => s.setTab);
  const openWorker = useGame((s) => s.openWorker);
  const openRelampago = useGame((s) => s.openRelampago);
  const relampagoHoy = g.progreso.relampagoEl === g.date;

  const pend = pendientes(g).sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0));
  const horizonte = addBusinessDays(g.date, 5);
  const proximas = pend.filter((t) => t.vence <= horizonte).slice(0, 8);
  const sinPapeles = pend.filter((t) => !t.docsRecibidos).slice(0, 6);
  const jugables = pend.filter((t) => t.minigame && A.minijuegoDisponible(g, t.id).ok).slice(0, 6);
  const yo = player(g);
  const facturar = g.estudio.facturasEmitidasMes !== monthKey(g.date) && g.clients.some((c) => c.activo && !c.propio);
  const ingresos = ingresoMensual(g);
  const costos = costoMensual(g);

  const alertas: { tone: string; text: string; action?: { label: string; fn: () => void } }[] = [];
  const debo = tareasQueDeboHacer(g);
  if (debo.length) alertas.push({ tone: 'warn', text: `🎮 ${debo.length} tarea/s ${debo.length === 1 ? 'tiene' : 'tienen'} que hacerla vos (modo simulador): tu equipo no puede avanzarlas.`, action: { label: 'Ver', fn: () => setTab('tareas') } });
  if (facturar) alertas.push({ tone: 'warn', text: '🧾 Todavía no emitiste las facturas de este mes.', action: { label: 'Facturar ahora', fn: () => act((d) => A.facturarMes(d)) } });
  if (g.prospects.length) alertas.push({ tone: 'info', text: `🙋 ${g.prospects.length} prospecto/s esperan tu propuesta.`, action: { label: 'Ver', fn: () => setTab('clientes') } });
  if (g.flags.arcaCaida) alertas.push({ tone: 'bad', text: '🔥 ARCA está caída: hoy no se puede presentar.' });
  if (g.flags.corteLuz) alertas.push({ tone: 'bad', text: '⚡ Corte de luz en el barrio.' });
  if (g.estudio.caja < 0) alertas.push({ tone: 'bad', text: `🚨 Caja en rojo hace ${g.estudio.diasEnRojo} día/s hábiles (máximo 45).` });
  if (yo.estres > 80) alertas.push({ tone: 'warn', text: '🥵 Estás al límite de estrés. Delegá o tomate un día.' });

  return (
    <div className="screen escritorio">
      {alertas.length > 0 && (
        <div className="alerts">
          {alertas.map((a, i) => (
            <div key={i} className={`alert ${a.tone} anim-up`}>
              <span>{a.text}</span>
              {a.action && (
                <button className="btn sm" onClick={a.action.fn}>
                  {a.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="dash-grid">
        <Section title="⏰ Vencimientos de los próximos 5 días" right={<button className="btn sm ghost" onClick={() => setTab('tareas')}>Ver agenda →</button>} className="span2">
          {proximas.length ? (
            <div className="task-list">
              {proximas.map((t) => (
                <TaskRow key={t.id} g={g} t={t} compact />
              ))}
            </div>
          ) : (
            <Empty icon="🌴">Nada vence en los próximos días. Buen momento para captar clientes o capacitarte.</Empty>
          )}
        </Section>

        <Misiones />

        <Section title="🎮 Hacelas vos (modo simulador)">
          <button className={`btn block relampago-btn ${relampagoHoy ? '' : 'primary'}`} disabled={relampagoHoy || yo.ocupadoHoras > 0} onClick={() => openRelampago(true)} title={relampagoHoy ? 'Ya despachaste la pila hoy' : '45 segundos: clasificá comprobantes y adelantá la carga'}>
            ⚡ Despachar la pila <small>{relampagoHoy ? `· hecho hoy (récord ${g.progreso.relampagoMejor})` : '· 45 s · adelanta la carga'}</small>
          </button>
          <p className="small muted mb mt">Liquidá con tus propias manos: si lo hacés bien, no hay errores y ganás experiencia.</p>
          {jugables.length ? (
            <div className="task-list">
              {jugables.map((t) => (
                <TaskRow key={t.id} g={g} t={t} compact />
              ))}
            </div>
          ) : (
            <Empty icon="🧉">No hay liquidaciones listas para hacer a mano (faltan papeles o ya están hechas).</Empty>
          )}
        </Section>

        <Section title="🙋 Tu día (titular)">
          <div className="me">
            <AvatarFace avatar={yo.avatar} size={56} />
            <div className="col grow">
              <b>{g.estudio.titular}</b>
              <span className="small muted">{yo.statusText}</span>
              <div className="row small">
                Estrés <Bar value={yo.estres} tone={yo.estres > 75 ? 'bad' : yo.estres > 50 ? 'warn' : undefined} label="Estrés" />
              </div>
            </div>
          </div>
          <div className="col mt">
            <span className="small">Cuando no tenés tareas:</span>
            <Segmented<PlayerIdle>
              value={g.estudio.idle}
              onChange={(v) => act((d) => A.setIdle(d, v), { silent: true })}
              options={[
                { v: 'networking', label: '📞 Networking', title: 'Más prospectos' },
                { v: 'estudiar', label: '📚 Estudiar', title: 'Subís habilidades' },
                { v: 'descansar', label: '☕ Descansar', title: 'Bajás el estrés' },
              ]}
            />
            <div className="row wrap">
              <Toggle on={yo.horasExtra} onChange={() => act((d) => A.toggleHorasExtra(d, 'player'))} label="Quedarme hasta las 20" />
              <button className="btn sm" onClick={() => act((d) => A.darDiaLibre(d, 'player'))}>
                🏖️ Tomarme el día
              </button>
            </div>
          </div>
        </Section>

        <Section title="📭 Esperando documentación">
          {sinPapeles.length ? (
            <div className="task-list">
              {sinPapeles.map((t) => (
                <TaskRow key={t.id} g={g} t={t} compact />
              ))}
            </div>
          ) : (
            <Empty icon="📬">Tenés todos los papeles. ¡Milagro!</Empty>
          )}
        </Section>

        <Section title="👥 Equipo ahora" right={<button className="btn sm ghost" onClick={() => setTab('equipo')}>Gestionar →</button>}>
          <div className="team-mini">
            {g.workers.map((w) => {
              const carga = cargaDe(g, w);
              const dias = carga / capacidadDiaria(w);
              return (
                <button key={w.id} className="team-mini-row" onClick={() => openWorker(w.id)}>
                  <AvatarFace avatar={w.avatar} size={34} />
                  <div className="col grow tight">
                    <span className="small">
                      <b>{w.id === 'player' ? 'Vos' : primerNombre(w.nombre)}</b> <span className="muted">· {w.statusText}</span>
                    </span>
                    <Bar value={dias} max={10} tone={dias > 8 ? 'bad' : dias > 5 ? 'warn' : undefined} label={`${carga.toFixed(1)} h de trabajo en cola`} />
                  </div>
                  <span className="tiny muted mono">{carga.toFixed(0)} h</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="📊 Números del mes" right={<button className="btn sm ghost" onClick={() => setTab('finanzas')}>Finanzas →</button>}>
          <div className="stats-grid">
            <Stat label="Abonos mensuales" value={moneyShort(ingresos)} />
            <Stat label="Costos fijos" value={moneyShort(costos)} />
            <Stat label="Resultado estimado" value={moneyShort(ingresos - costos)} tone={ingresos - costos >= 0 ? 'pos' : 'neg'} />
            <Stat label="Por cobrar" value={moneyShort(porCobrar(g))} />
          </div>
          <p className="tiny muted mt">Costos fijos: sueldos + cargas, alquiler, servicios, software, Caja profesional y marketing. Resultado estimado = abonos − costos fijos (sin impuestos ni multas). {money(ingresos)} de abonos.</p>
        </Section>
      </div>
    </div>
  );
}
