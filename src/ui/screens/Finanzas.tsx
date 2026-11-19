import { useEffect, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as A from '../../engine/actions';
import { fechaAR, MESES_CORTOS, monthKey } from '../../engine/calendar';
import { costoMensualHerramientas, costoSueldos, porCobrar } from '../../engine/economy';
import { money, moneyShort, pct } from '../../engine/format';
import type { LedgerCategoria } from '../../engine/types';
import { useGame } from '../../store/game';
import { corto, costoMensual, Empty, ingresoMensual, Section, Segmented, Stat } from '../components';

// paleta validada (dataviz): slot 1 azul / slot 2 naranja, pasos claros y oscuros
const PAL = { light: { s1: '#2a78d6', s2: '#eb6834', grid: '#e4dccd', ink: '#4c5866' }, dark: { s1: '#3987e5', s2: '#d95926', grid: '#2f3d4d', ink: '#c3ccd6' } };

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

const CAT_LABEL: Record<LedgerCategoria, string> = {
  honorarios: 'Honorarios',
  sueldos: 'Sueldos',
  cargas_sociales: 'Cargas sociales',
  alquiler: 'Alquiler',
  servicios: 'Servicios',
  software: 'Software',
  multas: 'Multas',
  impuestos: 'Impuestos',
  marketing: 'Marketing',
  capacitacion: 'Capacitación',
  mudanza: 'Mudanza',
  indemnizacion: 'Indemnizaciones',
  otros: 'Otros',
};

const mesCorto = (m: string) => `${MESES_CORTOS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

export function Finanzas() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const dark = useDark();
  const pal = dark ? PAL.dark : PAL.light;
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico');
  const yaFacturado = g.estudio.facturasEmitidasMes === monthKey(g.date);
  const data = g.monthly.slice(-12).map((m) => ({ mes: mesCorto(m.mes), Cobrado: m.cobrado, Egresos: m.egresos, Caja: m.caja, resultado: m.resultado, multas: m.multas }));
  const pendientesCobro = g.invoices.filter((i) => !i.cobradaEl && !i.incobrable).sort((a, b) => (a.vence < b.vence ? -1 : 1));
  const movs = g.ledger.slice(-40).reverse();
  const tip = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }, formatter: (v: number) => money(v) };

  return (
    <div className="screen finanzas">
      <div className="stats-grid big">
        <Stat label="Caja" value={moneyShort(g.estudio.caja)} tone={g.estudio.caja < 0 ? 'neg' : undefined} />
        <Stat label="Por cobrar" value={moneyShort(porCobrar(g))} sub={`${pendientesCobro.length} facturas`} />
        <Stat label="Abonos/mes" value={moneyShort(ingresoMensual(g))} />
        <Stat label="Costos fijos/mes" value={moneyShort(costoMensual(g))} sub={`sueldos ${moneyShort(costoSueldos(g))} · software ${moneyShort(costoMensualHerramientas(g))}`} />
        <Stat label="Inflación del mes" value={pct(g.inflacion.mensual, 1)} sub={`acumulada ${pct(g.inflacion.indice - 1, 0)}`} />
        <Stat label="Condición fiscal" value={g.estudio.condicion === 'ri' ? 'Resp. Inscripto' : 'Monotributo'} />
      </div>

      <Section
        title="🧾 Facturación del mes"
        right={
          <button className="btn primary sm" disabled={yaFacturado} onClick={() => act((d) => A.facturarMes(d))}>
            {yaFacturado ? '✔ Ya facturaste' : 'Emitir facturas del mes'}
          </button>
        }
      >
        <p className="small muted">
          Emití los abonos a principio de mes: después del día 10 los clientes pagan más tarde. Con "Facturación electrónica automática" se hace solo.
          {g.estudio.prestamo && ` Préstamo: ${g.estudio.prestamo.restantes} cuotas de ${money(g.estudio.prestamo.cuota)}.`}
        </p>
      </Section>

      <Section
        title="📈 Evolución mensual"
        right={
          <Segmented
            size="sm"
            value={vista}
            onChange={setVista}
            options={[
              { v: 'grafico', label: 'Gráfico' },
              { v: 'tabla', label: 'Tabla' },
            ]}
          />
        }
      >
        {data.length < 1 ? (
          <Empty icon="📊">El gráfico aparece al terminar el primer mes.</Empty>
        ) : vista === 'grafico' ? (
          <div className="charts">
            <div className="chart">
              <h4 className="small">Cobrado vs. egresos</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={pal.grid} />
                  <XAxis dataKey="mes" tick={{ fill: pal.ink, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fill: pal.ink, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip {...tip} cursor={{ fill: 'rgba(127,127,127,0.12)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: pal.ink }} />
                  <RBar dataKey="Cobrado" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <RBar dataKey="Egresos" fill={pal.s2} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart">
              <h4 className="small">Caja a fin de mes</h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={pal.grid} />
                  <XAxis dataKey="mes" tick={{ fill: pal.ink, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fill: pal.ink, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip {...tip} />
                  <Line type="monotone" dataKey="Caja" stroke={pal.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Egresos</th>
                  <th className="num">Multas</th>
                  <th className="num">Resultado</th>
                  <th className="num">Caja</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.mes}>
                    <td>{d.mes}</td>
                    <td className="num">{money(d.Cobrado)}</td>
                    <td className="num">{money(d.Egresos)}</td>
                    <td className="num">{money(d.multas)}</td>
                    <td className={`num ${d.resultado < 0 ? 'neg' : 'pos'}`}>{money(d.resultado)}</td>
                    <td className="num">{money(d.Caja)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid2">
        <Section title={`📬 Cuentas por cobrar (${pendientesCobro.length})`}>
          {pendientesCobro.length ? (
            <div className="table-wrap scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Factura</th>
                    <th className="num">Importe</th>
                    <th>Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientesCobro.slice(0, 40).map((i) => {
                    const c = g.clients.find((x) => x.id === i.clientId);
                    const vencida = i.vence < g.date;
                    return (
                      <tr key={i.id}>
                        <td className="ellipsis" style={{ maxWidth: 160 }}>{corto(c?.nombre ?? '')}</td>
                        <td className="mono tiny">{i.numero}</td>
                        <td className="num">{money(i.monto)}</td>
                        <td className={vencida ? 'neg' : ''}>{fechaAR(i.vence)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="✅">No hay facturas pendientes de cobro.</Empty>
          )}
        </Section>
        <Section title="📒 Últimos movimientos">
          {movs.length ? (
            <div className="table-wrap scroll">
              <table className="tbl">
                <tbody>
                  {movs.map((l) => (
                    <tr key={l.id}>
                      <td className="tiny mono">{fechaAR(l.date).slice(0, 5)}</td>
                      <td className="small">
                        {l.concepto}
                        <div className="tiny muted">{CAT_LABEL[l.categoria]}</div>
                      </td>
                      <td className={`num ${l.monto < 0 ? 'neg' : 'pos'}`}>{money(l.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="📒">Todavía no hay movimientos.</Empty>
          )}
        </Section>
      </div>
    </div>
  );
}
