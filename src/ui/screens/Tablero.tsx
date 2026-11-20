// Tablero del titular: la visión de dueño del estudio (cumplimiento, capacidad, rentabilidad,
// flujo de fondos, riesgo, equipo y objetivos propios).
import { useEffect, useMemo, useState } from 'react';
import { Bar as RBar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { capacidad7, costoHora, cumplimiento, equipoResumen, flujoFondos90, informeMensualCSV, ingresosMensuales, rentabilidadClientes, riesgoProfesional, type Etiqueta, type RentabilidadCliente, type Semaforo } from '../../engine/analytics';
import { fechaAR, fechaCorta } from '../../engine/calendar';
import { claudeDescargar } from '../../engine/cloud';
import { money, moneyShort, pct } from '../../engine/format';
import { nombreDe } from '../../engine/obligations';
import { valorObjetivo } from '../../engine/simulation';
import type { Area, Objetivo } from '../../engine/types';
import { useGame } from '../../store/game';
import { Bar, Cara, Empty, Section, Segmented, Stat } from '../components';
import '../tablero.css';

// paleta validada (misma que Finanzas): slot 1 azul / slot 2 naranja
const PAL = { light: { s1: '#2a78d6', s2: '#eb6834', grid: '#e4dccd', ink: '#4c5866', line: '#23303d' }, dark: { s1: '#3987e5', s2: '#d95926', grid: '#2f3d4d', ink: '#c3ccd6', line: '#e8edf2' } };

function useDark(): boolean {
  const get = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  };
  const [d, setD] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const h = () => setD(get());
    mq?.addEventListener('change', h);
    return () => mq?.removeEventListener('change', h);
  }, []);
  return d;
}

const SEM_ICON: Record<Semaforo, string> = { ok: '🟢', warn: '🟡', bad: '🔴' };
const ETQ: Record<Etiqueta, { icon: string; cls: string }> = {
  'pierde plata': { icon: '📉', cls: 'bad' },
  desactualizado: { icon: '📈', cls: 'warn' },
  moroso: { icon: '⏳', cls: 'warn' },
  riesgoso: { icon: '⚠️', cls: 'bad' },
  estrella: { icon: '⭐', cls: 'ok' },
};
const AREA_LABEL: Record<Area, string> = { impuestos: 'Impuestos', sueldos: 'Sueldos', contabilidad: 'Contabilidad' };
const OBJ_LABEL: Record<Objetivo['tipo'], { label: string; fmt: (v: number) => string; placeholder: number }> = {
  clientes: { label: 'Clientes activos', fmt: (v) => String(Math.round(v)), placeholder: 10 },
  facturacion: { label: 'Abonos mensuales', fmt: (v) => moneyShort(v), placeholder: 5_000_000 },
  caja: { label: 'Caja', fmt: (v) => moneyShort(v), placeholder: 10_000_000 },
  reputacion: { label: 'Reputación', fmt: (v) => String(Math.round(v)), placeholder: 60 },
  nota: { label: 'Nota mensual (A=5 … F=1)', fmt: (v) => ['', 'F', 'D', 'C', 'B', 'A'][Math.round(v)] ?? '-', placeholder: 5 },
  racha: { label: 'Mejor racha', fmt: (v) => String(Math.round(v)), placeholder: 25 },
};

type Col = 'nombre' | 'honorario' | 'horasPromedio' | 'porHora' | 'margen' | 'atraso' | 'deuda' | 'satisfaccion';

export function Tablero() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const openClient = useGame((s) => s.openClient);
  const openWorker = useGame((s) => s.openWorker);
  const setTab = useGame((s) => s.setTab);
  const toast = useGame((s) => s.toast);
  const dark = useDark();
  const pal = dark ? PAL.dark : PAL.light;

  const cum = useMemo(() => cumplimiento(g), [g]);
  const cap = useMemo(() => capacidad7(g), [g]);
  const rent = useMemo(() => rentabilidadClientes(g), [g]);
  const flujo = useMemo(() => flujoFondos90(g), [g]);
  const riesgo = useMemo(() => riesgoProfesional(g), [g]);
  const eq = useMemo(() => equipoResumen(g), [g]);
  const ch = costoHora(g);
  const ingresos = ingresosMensuales(g);
  const horasFact = rent.reduce((a, r) => a + r.horasPromedio, 0);
  const porHoraEstudio = horasFact ? ingresos / horasFact : 0;

  const [orden, setOrden] = useState<Col>('margen');
  const [asc, setAsc] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | Etiqueta>('todas');
  const [objTipo, setObjTipo] = useState<Objetivo['tipo']>('clientes');
  const [objMeta, setObjMeta] = useState<number>(OBJ_LABEL.clientes.placeholder);

  const lista = useMemo(() => {
    const l = rent.filter((r) => filtro === 'todas' || r.etiquetas.includes(filtro));
    const key = orden;
    return [...l].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : Number(va) - Number(vb);
      return asc ? cmp : -cmp;
    });
  }, [rent, filtro, orden, asc]);

  const sortBy = (c: Col) => {
    if (orden === c) setAsc(!asc);
    else {
      setOrden(c);
      setAsc(c === 'nombre');
    }
  };
  const th = (c: Col, label: string, cls = '') => (
    <th className={`${cls} sortable ${orden === c ? 'on' : ''}`} onClick={() => sortBy(c)} aria-sort={orden === c ? (asc ? 'ascending' : 'descending') : 'none'}>
      {label}
      {orden === c ? (asc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const descargar = async () => {
    const csv = informeMensualCSV(g);
    const nombre = `informe-${g.estudio.nombre.replace(/[^\w-]+/g, '_')}-${g.date}.csv`;
    const r = await claudeDescargar(nombre, csv);
    if (r === 'ok') return toast('Informe exportado.', 'ok');
    if (r === 'no') return toast('No se exportó el informe.', 'warn');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Informe exportado.', 'ok');
  };

  const tip = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }, formatter: (v: number) => money(v) };
  const dataFlujo = flujo.semanas.map((w) => ({ semana: w.label, Ingresos: w.ingresos, Egresos: w.egresos, Saldo: w.saldo }));
  const capPct = Math.min(100, cap.ratio * 100);

  return (
    <div className="screen tablero">
      <div className="tb-kpis">
        <Kpi icon={SEM_ICON[cum.semaforo]} label="Cumplimiento del mes" value={pct(cum.pct)} sub={`${cum.enTermino} en término · ${cum.tarde + cum.vencidasSinPresentar} fuera`} tone={cum.semaforo} />
        <Kpi icon="💰" label="Caja" value={moneyShort(g.estudio.caja)} sub={`mín. 90 días ${moneyShort(flujo.minimo.saldo)} (${fechaCorta(flujo.minimo.fecha)})`} tone={flujo.alerta ? 'bad' : flujo.minimo.saldo < g.estudio.caja * 0.3 ? 'warn' : 'ok'} />
        <Kpi icon="⏱️" label="$/hora del estudio" value={moneyShort(porHoraEstudio)} sub={`costo hora ${moneyShort(ch)}`} tone={porHoraEstudio > ch * 1.5 ? 'ok' : porHoraEstudio > ch ? 'warn' : 'bad'} />
        <Kpi icon="🤝" label="Clientes activos" value={String(rent.length)} sub={`${rent.filter((r) => r.etiquetas.includes('estrella')).length} estrella · ${rent.filter((r) => r.etiquetas.includes('pierde plata')).length} pierden plata`} tone="ok" />
        <Kpi icon="⭐" label="Reputación" value={String(Math.round(g.estudio.reputacion))} sub={`nivel ${g.estudio.nivel}`} tone={g.estudio.reputacion >= 60 ? 'ok' : g.estudio.reputacion >= 35 ? 'warn' : 'bad'} />
        <Kpi icon={SEM_ICON[riesgo.semaforo]} label="Riesgo profesional" value={`${riesgo.indice}/100`} sub={riesgo.detalle[0] ?? 'Sin alertas'} tone={riesgo.semaforo} />
      </div>

      <div className="tb-grid">
        <Section title={`${SEM_ICON[cap.semaforo]} Semáforo de la semana`} right={<span className="tiny muted">hasta {fechaCorta(cap.hasta)}</span>}>
          <div className="row small">
            <span>
              Carga <b>{cap.horasTotal} h</b> vs. capacidad <b>{cap.capacidad} h</b>
            </span>
            <div className="spacer" />
            <span className={`chip ${cap.semaforo}`}>{cap.ratio > 1 ? `Faltan ${(cap.horasTotal - cap.capacidad).toFixed(0)} h` : `${pct(cap.ratio)} ocupado`}</span>
          </div>
          <div className="cap-bar" role="img" aria-label={`Carga ${cap.horasTotal} de ${cap.capacidad} horas`}>
            {(['impuestos', 'sueldos', 'contabilidad'] as Area[]).map((a) => (
              <i key={a} className={`seg-${a}`} style={{ width: `${cap.capacidad ? Math.min(100, (cap.horasPorArea[a] / cap.capacidad) * 100) : 0}%` }} title={`${AREA_LABEL[a]}: ${cap.horasPorArea[a].toFixed(1)} h`} />
            ))}
            <span className="cap-line" style={{ left: `${Math.min(100, capPct > 100 ? (100 / cap.ratio) : 100)}%` }} />
          </div>
          <div className="row wrap tiny muted gap12">
            {(['impuestos', 'sueldos', 'contabilidad'] as Area[]).map((a) => (
              <span key={a}>
                <i className={`dot seg-${a}`} /> {AREA_LABEL[a]} {cap.horasPorArea[a].toFixed(1)} h
              </span>
            ))}
          </div>
          <ul className="plain cuellos">
            {cap.personas.map((p) => (
              <li key={p.id}>
                <button className="linkish" onClick={() => openWorker(p.id)}>
                  {SEM_ICON[p.semaforo]} <b>{p.nombre}</b>
                </button>
                <Bar value={p.ratio * 100} tone={p.semaforo === 'ok' ? undefined : p.semaforo} label={`${p.carga} h de ${p.capacidad} h`} />
                <span className="tiny mono">
                  {p.carga}/{p.capacidad} h
                </span>
              </li>
            ))}
          </ul>
          {cum.titularPendientes.length > 0 && (
            <p className="small warn-box mt">
              🎮 Tenés {cum.titularPendientes.length} tarea/s que solo podés hacer vos. La más urgente: <b>{cum.titularPendientes[0].titulo}</b> ({fechaCorta(cum.titularPendientes[0].vence)}).{' '}
              <button className="linkish" onClick={() => setTab('tareas')}>
                Ir a tareas →
              </button>
            </p>
          )}
        </Section>

        <Section title="💸 Flujo de fondos · 90 días" right={flujo.alerta ? <span className="chip bad">🚨 bache de caja</span> : <span className="chip ok">✔ sin baches</span>}>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={dataFlujo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={pal.grid} />
              <XAxis dataKey="semana" tick={{ fill: pal.ink, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fill: pal.ink, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip {...tip} cursor={{ fill: 'rgba(127,127,127,0.12)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: pal.ink }} />
              <RBar dataKey="Ingresos" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <RBar dataKey="Egresos" fill={pal.s2} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line type="monotone" dataKey="Saldo" stroke={pal.line} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--panel)' }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="stats-grid mt">
            <Stat label="Cobros esperados" value={moneyShort(flujo.totalIngresos)} />
            <Stat label="Pagos previstos" value={moneyShort(flujo.totalEgresos)} />
            <Stat label="Saldo mínimo" value={moneyShort(flujo.minimo.saldo)} sub={fechaAR(flujo.minimo.fecha)} tone={flujo.minimo.saldo < 0 ? 'neg' : undefined} />
          </div>
          {flujo.alerta && <p className="small bad-box mt">La caja se va a negativo alrededor del {fechaAR(flujo.minimo.fecha)}. Reclamá cobranzas, actualizá abonos o posponé gastos.</p>}
        </Section>

        <Section
          title="💼 Rentabilidad por cliente"
          className="span2"
          right={
            <Segmented
              size="sm"
              value={filtro}
              onChange={setFiltro}
              options={[
                { v: 'todas', label: `Todos (${rent.length})` },
                ...(Object.keys(ETQ) as Etiqueta[]).map((e) => ({ v: e, label: `${ETQ[e].icon} ${e} (${rent.filter((r) => r.etiquetas.includes(e)).length})` })),
              ]}
            />
          }
        >
          {lista.length ? (
            <>
              <div className="table-wrap rent-table">
                <table className="tbl">
                  <thead>
                    <tr>
                      {th('nombre', 'Cliente')}
                      {th('honorario', 'Abono', 'num')}
                      {th('horasPromedio', 'h/mes', 'num')}
                      {th('porHora', '$/h', 'num')}
                      {th('margen', 'Margen', 'num')}
                      {th('atraso', 'Atraso', 'num')}
                      {th('deuda', 'Deuda', 'num')}
                      {th('satisfaccion', 'Satisf.', 'num')}
                      <th>Etiquetas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((r) => (
                      <tr key={r.id} onClick={() => openClient(r.id)} className="clickable">
                        <td className="ellipsis" style={{ maxWidth: 180 }}>{r.nombre}</td>
                        <td className="num">{moneyShort(r.honorario)}</td>
                        <td className="num">{r.horasPromedio.toFixed(1)}</td>
                        <td className="num">{moneyShort(r.porHora)}</td>
                        <td className={`num ${r.margen < 0 ? 'neg' : 'pos'}`}>{moneyShort(r.margen)}</td>
                        <td className={`num ${r.atraso > 0.15 ? 'neg' : ''}`}>{pct(r.atraso)}</td>
                        <td className={`num ${r.deuda > 0 ? 'neg' : ''}`}>{r.deuda ? moneyShort(r.deuda) : '—'}</td>
                        <td className="num">
                          <Cara v={r.satisfaccion} /> {Math.round(r.satisfaccion)}
                        </td>
                        <td>
                          <Etiquetas r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rent-cards">
                {lista.map((r) => (
                  <button key={r.id} className="rent-card" onClick={() => openClient(r.id)}>
                    <div className="row">
                      <b className="ellipsis grow">{r.nombre}</b>
                      <Cara v={r.satisfaccion} />
                    </div>
                    <div className="rent-nums">
                      <span>
                        Abono <b>{moneyShort(r.honorario)}</b>
                      </span>
                      <span>
                        {r.horasPromedio.toFixed(1)} h · <b>{moneyShort(r.porHora)}/h</b>
                      </span>
                      <span className={r.margen < 0 ? 'neg' : 'pos'}>
                        Margen <b>{moneyShort(r.margen)}</b>
                      </span>
                      <span className={r.atraso > 0.15 ? 'neg' : ''}>Atraso {pct(r.atraso)}</span>
                      {r.deuda > 0 && <span className="neg">Debe {moneyShort(r.deuda)}</span>}
                    </div>
                    <Etiquetas r={r} />
                  </button>
                ))}
              </div>
              <p className="tiny muted mt">
                $/h = abono ÷ horas reales promedio por mes. Margen = abono − horas × costo hora del estudio ({moneyShort(ch)}). Atraso = inflación acumulada desde la última actualización del abono.
              </p>
            </>
          ) : (
            <Empty icon="🫥">No hay clientes con esa etiqueta.</Empty>
          )}
        </Section>

        <Section title={`${SEM_ICON[riesgo.semaforo]} Riesgo profesional`}>
          <div className="row">
            <div className="riesgo-indice">
              <b className={riesgo.semaforo}>{riesgo.indice}</b>
              <small>/100</small>
            </div>
            <div className="col grow tight">
              <Bar value={riesgo.indice} tone={riesgo.semaforo === 'ok' ? undefined : riesgo.semaforo} label="Índice de riesgo" />
              <span className="tiny muted">{riesgo.detalle.length ? riesgo.detalle.join(' · ') : 'Todo en orden: sin errores latentes conocidos ni pendientes críticos.'}</span>
            </div>
          </div>
          {riesgo.topClientes.length > 0 && (
            <>
              <h4 className="small mt">Clientes de mayor riesgo</h4>
              <ul className="plain riesgo-list">
                {riesgo.topClientes.map((c) => (
                  <li key={c.id}>
                    <button className="linkish" onClick={() => openClient(c.id)}>
                      ⚠️ <b>{c.nombre}</b>
                    </button>
                    <span className="tiny muted">
                      {c.errores} error/es latente/s (gravedad {c.gravedad}) · riesgo fiscal {pct(c.riesgoFiscal)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(riesgo.controlesPendientes.length > 0 || riesgo.titularPendientes.length > 0) && (
            <>
              <h4 className="small mt">Pendientes que solo podés hacer vos</h4>
              <ul className="plain riesgo-list">
                {riesgo.controlesPendientes.map((t) => (
                  <li key={t.id}>
                    <span>
                      🔎 <b>{t.titulo}</b>
                    </span>
                    <span className="tiny muted">vence {fechaCorta(t.vence)}</span>
                  </li>
                ))}
                {riesgo.titularPendientes
                  .filter((t) => t.kind !== 'control')
                  .map((t) => (
                    <li key={t.id}>
                      <span>
                        🎮 <b>{t.titulo}</b>
                      </span>
                      <span className="tiny muted">
                        {nombreDe(t.kind)} · vence {fechaCorta(t.vence)}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
          <div className="row small mt">
            Tu estrés <Bar value={riesgo.estresTitular} tone={riesgo.estresTitular > 75 ? 'bad' : riesgo.estresTitular > 50 ? 'warn' : undefined} label="Estrés del titular" /> <span className="mono tiny">{Math.round(riesgo.estresTitular)}</span>
          </div>
        </Section>

        <Section title="👥 Equipo" right={<span className={`chip ${eq.sano ? 'ok' : 'warn'}`}>sueldos/ingresos {pct(eq.sueldosSobreIngresos)}</span>}>
          <div className="table-wrap">
            <table className="tbl equipo-tbl">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="num">Carga</th>
                  <th className="num">Estrés</th>
                  <th className="num">Moral</th>
                  <th className="num">Costo</th>
                </tr>
              </thead>
              <tbody>
                {eq.personas.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => openWorker(p.id)}>
                    <td>
                      {SEM_ICON[p.semaforo]} <b>{primerNombre(p.nombre)}</b>
                      <div className="tiny muted">
                        {p.role}
                        {p.rasgo ? ` · ${p.rasgo.icon} ${p.rasgo.nombre}` : ''}
                        {p.horasExtraMes ? ` · ${p.horasExtraMes} h extra` : ''}
                      </div>
                    </td>
                    <td className="num">
                      {p.carga} h <span className="tiny muted">/ {p.capacidadSemanal}</span>
                    </td>
                    <td className={`num ${p.estres > 75 ? 'neg' : ''}`}>{p.estres}</td>
                    <td className={`num ${p.moral < 35 ? 'neg' : ''}`}>{p.moral}</td>
                    <td className="num">{p.costo ? moneyShort(p.costo) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted mt">
            Costo laboral mensual {moneyShort(eq.costoLaboralMensual)} (sueldos + cargas). Sano: menos del 45% de los abonos.
            {eq.aprendiendo ? ` Quien más está aprendiendo: ${eq.aprendiendo.nombre.split(' ')[0]}.` : ''}
          </p>
        </Section>

        <Section title="🎯 Objetivos del titular" right={<button className="btn sm" onClick={descargar}>📥 Informe mensual (CSV)</button>}>
          {g.objetivos.length ? (
            <ul className="plain objetivos">
              {g.objetivos.map((o) => {
                const v = valorObjetivo(g, o.tipo);
                const p = o.meta ? Math.min(1, v / o.meta) : 1;
                return (
                  <li key={o.id} className={o.cumplidoEl ? 'done' : ''}>
                    <div className="col grow tight">
                      <span className="small">
                        <b>{OBJ_LABEL[o.tipo].label}</b> ≥ {OBJ_LABEL[o.tipo].fmt(o.meta)}
                        {o.cumplidoEl && <span className="chip ok">✔ cumplido {fechaCorta(o.cumplidoEl)}</span>}
                      </span>
                      <Bar value={p * 100} label={`${OBJ_LABEL[o.tipo].fmt(v)} de ${OBJ_LABEL[o.tipo].fmt(o.meta)}`} />
                      <span className="tiny muted">
                        Hoy: {OBJ_LABEL[o.tipo].fmt(v)} · desde {fechaCorta(o.creado)}
                      </span>
                    </div>
                    <button
                      className="btn sm ghost"
                      aria-label="Quitar objetivo"
                      onClick={() =>
                        act((d) => {
                          d.objetivos = d.objetivos.filter((x) => x.id !== o.id);
                          return { ok: true, texto: 'Objetivo quitado.' };
                        })
                      }
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="small muted">Fijate metas propias: el tablero las sigue y te avisa cuando las cumplís.</p>
          )}
          <form
            className="row wrap mt obj-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!objMeta || objMeta <= 0) return;
              const meta = objMeta;
              const tipo = objTipo;
              act((d) => {
                d.objetivos.push({ id: 'o' + Date.now(), tipo, meta, creado: d.date });
                return { ok: true, texto: 'Objetivo agregado.' };
              });
            }}
          >
            <select
              id="obj-tipo"
              value={objTipo}
              onChange={(e) => {
                const t = e.target.value as Objetivo['tipo'];
                setObjTipo(t);
                setObjMeta(OBJ_LABEL[t].placeholder);
              }}
              aria-label="Tipo de objetivo"
            >
              {(Object.keys(OBJ_LABEL) as Objetivo['tipo'][]).map((t) => (
                <option key={t} value={t}>
                  {OBJ_LABEL[t].label}
                </option>
              ))}
            </select>
            <input id="obj-meta" type="number" min={1} step={objTipo === 'facturacion' || objTipo === 'caja' ? 100000 : 1} value={objMeta} onChange={(e) => setObjMeta(Number(e.target.value))} aria-label="Meta" style={{ width: 150 }} />
            <button type="submit" className="btn sm primary">
              Agregar
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}

/** Primer nombre, salteando títulos como "Cr." o "Cra." */
function primerNombre(n: string): string {
  const partes = n.split(' (')[0].split(' ').filter(Boolean);
  const i = partes.findIndex((w) => !/\.$/.test(w));
  return partes[i >= 0 ? i : 0] ?? n;
}

function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone: Semaforo }) {
  return (
    <div className={`kpi ${tone}`}>
      <span className="kpi-icon" aria-hidden>
        {icon}
      </span>
      <div className="col tight minw0">
        <span className="kpi-label">{label}</span>
        <b className="kpi-value">{value}</b>
        {sub && <span className="kpi-sub ellipsis">{sub}</span>}
      </div>
    </div>
  );
}

function Etiquetas({ r }: { r: RentabilidadCliente }) {
  if (!r.etiquetas.length) return <span className="tiny muted">—</span>;
  return (
    <span className="chips">
      {r.etiquetas.map((e) => (
        <span key={e} className={`chip ${ETQ[e].cls}`}>
          {ETQ[e].icon} {e}
        </span>
      ))}
    </span>
  );
}
