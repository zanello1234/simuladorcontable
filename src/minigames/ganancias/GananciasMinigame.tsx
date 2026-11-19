// Minijuego: DDJJ anual de Impuesto a las Ganancias de una persona humana (Ley 20.628).
import { useMemo, useState } from 'react';
import { money2, pct } from '../../engine/format';
import type { MinigameId } from '../../engine/types';
import { MinigameResultView, MinigameShell } from '../MinigameShell';
import type { MinigameMeta, MinigameProps, MinigameResult } from '../types';
import { CAT_CORTO, CAT_LABEL, evaluar, generarCasoGanancias, liquidar, opcionesImpuesto, opcionesSaldo, PARAM_BASE, type Cat, type Deduccion, type Respuestas } from './casoGanancias';
import './ganancias.css';

export const GANANCIAS_META: MinigameMeta = {
  id: 'ganancias_ph' as MinigameId,
  titulo: 'DDJJ de Ganancias · Personas Humanas',
  descripcion: 'Clasificá las rentas por categoría, aplicá deducciones generales y personales, determiná el impuesto con la escala y computá los pagos a cuenta.',
  horas: 3,
  icon: '📑',
};

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
const ETAPAS = ['Rentas', 'Deducciones', 'Cargas de familia', 'Determinación', 'Resultado'];
const CATS: Cat[] = ['c1', 'c2', 'c3', 'c4', 'no', 'cedular'];

export function GananciasMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoGanancias(seed, client, task.periodo, indice), [seed, client, task.periodo, indice]);
  const [etapa, setEtapa] = useState(0);
  const [resp, setResp] = useState<Respuestas>({ rentas: {}, deducciones: {}, cargas: {}, pagos: {} });
  const [ayuda, setAyuda] = useState(false);
  const [resultado, setResultado] = useState<MinigameResult>();

  const liq = useMemo(() => liquidar(caso, resp), [caso, resp]);
  const opI = useMemo(() => opcionesImpuesto(liq.gnsi, liq.impCedular, caso.tramos), [liq.gnsi, liq.impCedular, caso.tramos]);
  const opS = useMemo(() => opcionesSaldo(caso), [caso]);
  const clasificadas = caso.rentas.filter((r) => resp.rentas[r.id]).length;
  const dedMarcadas = caso.deducciones.filter((d) => resp.deducciones[d.id] !== undefined).length;
  const cargasMarcadas = caso.cargas.filter((c) => resp.cargas[c.id] !== undefined).length;

  if (resultado) {
    return (
      <MinigameShell icon={GANANCIAS_META.icon} titulo="DDJJ de Ganancias presentada" subtitulo={`${caso.contribuyente} · período fiscal ${caso.periodo}`} onCancel={onCancel}>
        <div className={resultado.score < 0.95 ? 'anim-shake' : ''}>
          <MinigameResultView {...resultado} onContinue={() => onComplete(resultado)} />
          <Anticipos liq={caso.solucion} />
        </div>
      </MinigameShell>
    );
  }

  const instrucciones = (
    <div className="gan-help-row">
      <span>
        {etapa === 0 && 'Clasificá cada ingreso y gasto del año: ¿a qué categoría va, está exento o no computa, o tributa por separado (cedular)?'}
        {etapa === 1 && 'Marcá qué comprobantes son deducciones generales admitidas (art. 85). Los topes se aplican solos.'}
        {etapa === 2 && 'Decidí qué familiares son cargas de familia deducibles (art. 30).'}
        {etapa === 3 && 'Con tu ganancia neta sujeta a impuesto, aplicá la escala del art. 94 y elegí el impuesto determinado.'}
        {etapa === 4 && 'Computá los pagos a cuenta que corresponden a Ganancias y elegí el resultado de la DDJJ.'}
      </span>
      <button className="btn sm ghost" onClick={() => setAyuda((a) => !a)} aria-expanded={ayuda}>
        📘 {ayuda ? 'Cerrar machete' : 'Machete'}
      </button>
    </div>
  );

  const footer = (
    <>
      {etapa > 0 && (
        <button className="btn" onClick={() => setEtapa(etapa - 1)}>
          ← Volver
        </button>
      )}
      <span className="spacer" />
      {etapa === 0 && (
        <button className="btn primary" disabled={clasificadas < caso.rentas.length} onClick={() => setEtapa(1)}>
          {clasificadas < caso.rentas.length ? `Faltan ${caso.rentas.length - clasificadas}` : 'Siguiente: deducciones →'}
        </button>
      )}
      {etapa === 1 && (
        <button className="btn primary" disabled={dedMarcadas < caso.deducciones.length} onClick={() => setEtapa(2)}>
          {dedMarcadas < caso.deducciones.length ? `Faltan ${caso.deducciones.length - dedMarcadas}` : 'Siguiente: cargas de familia →'}
        </button>
      )}
      {etapa === 2 && (
        <button className="btn primary" disabled={cargasMarcadas < caso.cargas.length} onClick={() => setEtapa(3)}>
          {cargasMarcadas < caso.cargas.length ? `Faltan ${caso.cargas.length - cargasMarcadas}` : 'Siguiente: determinación →'}
        </button>
      )}
      {etapa === 3 && (
        <button className="btn primary" disabled={!resp.impuestoId} onClick={() => setEtapa(4)}>
          Siguiente: pagos a cuenta →
        </button>
      )}
      {etapa === 4 && (
        <button className="btn primary" disabled={!resp.saldoId} onClick={() => setResultado(evaluar(caso, resp))} data-testid="gan-presentar">
          Presentar F.711 ✓
        </button>
      )}
    </>
  );

  return (
    <MinigameShell icon={GANANCIAS_META.icon} titulo={GANANCIAS_META.titulo} subtitulo={`${caso.contribuyente} · período fiscal ${caso.periodo}${caso.nuevoProfesional ? ' · nuevo profesional' : ''}`} instrucciones={instrucciones} footer={footer} onCancel={onCancel}>
      {ayuda && <Machete gni={caso.param.gni} />}

      <ol className="gan-steps" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <li key={e} className={i === etapa ? 'on' : i < etapa ? 'done' : ''}>
            <span>{i < etapa ? '✓' : i + 1}</span> {e}
          </li>
        ))}
      </ol>

      <div className="gan-sum" role="status">
        <div>
          <small>Ganancia neta</small>
          <b className="mono">{money2(liq.ganNeta)}</b>
        </div>
        <div>
          <small>Deducciones</small>
          <b className="mono">{money2(liq.dedGenerales + liq.gni + liq.conyuge + liq.hijos + liq.dedEspecial)}</b>
        </div>
        <div>
          <small>Sujeta a impuesto</small>
          <b className="mono">{money2(liq.gnsi)}</b>
        </div>
      </div>

      {etapa === 0 && (
        <div className="gan-list">
          {caso.rentas.map((r) => {
            const v = resp.rentas[r.id];
            return (
              <div key={r.id} className={`gan-row ${v ? 'done' : ''}`} data-ok={DEV ? r.cat : undefined} data-testid="gan-renta">
                <div className="gan-row-txt">
                  <b>{r.titulo}</b>
                  <small className="muted">{r.detalle}</small>
                </div>
                <span className={`mono gan-monto ${r.monto < 0 ? 'neg' : ''}`}>{r.monto < 0 ? '−' : ''}{money2(Math.abs(r.monto))}</span>
                <div className="gan-seg" role="radiogroup" aria-label={`Categoría de ${r.titulo}`}>
                  {CATS.map((c) => (
                    <button key={c} role="radio" aria-checked={v === c} className={v === c ? 'on' : ''} title={CAT_LABEL[c]} onClick={() => setResp((s) => ({ ...s, rentas: { ...s.rentas, [r.id]: c } }))}>
                      {CAT_CORTO[c]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="muted small gan-note">Las categorías: 1ª renta del suelo · 2ª capitales · 3ª empresas y explotaciones · 4ª trabajo personal. Los gastos se imputan a la categoría de la renta que generan.</p>
        </div>
      )}

      {etapa === 1 && (
        <div className="gan-list">
          {caso.deducciones.map((d) => (
            <FilaDeduccion key={d.id} d={d} valor={resp.deducciones[d.id]} computado={liq.detalleDG.find((x) => x.id === d.id)?.computado} onChange={(v) => setResp((s) => ({ ...s, deducciones: { ...s.deducciones, [d.id]: v } }))} />
          ))}
          <p className="muted small gan-note">Topes: prepaga y donaciones 5% de la ganancia neta · servicio doméstico hasta la GNI · alquiler 40% con tope GNI · seguro de vida, sepelio e intereses hipotecarios con importe fijo.</p>
        </div>
      )}

      {etapa === 2 && (
        <div className="gan-cards">
          {caso.cargas.map((c) => {
            const v = resp.cargas[c.id];
            return (
              <div key={c.id} className={`gan-carga card ${v === undefined ? '' : v ? 'si' : 'no'}`} data-ok={DEV ? String(c.computa) : undefined} data-testid="gan-carga">
                <div className="gan-carga-icon" aria-hidden>
                  {c.tipo === 'conyuge' ? '💍' : '🧒'}
                </div>
                <div className="gan-row-txt grow">
                  <b>{c.titulo}</b>
                  <small className="muted">{c.detalle}</small>
                  <small className="mono">Deducción: {money2(c.tipo === 'conyuge' ? caso.param.conyuge : caso.param.hijo)}</small>
                </div>
                <div className="gan-seg" role="radiogroup">
                  <button role="radio" aria-checked={v === true} className={v === true ? 'on ok' : ''} onClick={() => setResp((s) => ({ ...s, cargas: { ...s.cargas, [c.id]: true } }))}>
                    Computa
                  </button>
                  <button role="radio" aria-checked={v === false} className={v === false ? 'on bad' : ''} onClick={() => setResp((s) => ({ ...s, cargas: { ...s.cargas, [c.id]: false } }))}>
                    No computa
                  </button>
                </div>
              </div>
            );
          })}
          <div className="card gan-de">
            <b>Deducción especial (automática)</b>
            <p className="small">
              {liq.tipoDE === 'incrementada' && `Tenés rentas de 4ª en relación de dependencia: se aplica la deducción especial incrementada (${PARAM_BASE.deIncrementada}× GNI) sobre esa porción.`}
              {liq.tipoDE === 'mixta' && `Mezcla de 3ª y 4ª: la incrementada (${PARAM_BASE.deIncrementada}× GNI) solo alcanza a la porción de 4ª en relación de dependencia; como supera a la simple, es la que se toma.`}
              {liq.tipoDE === 'simple' && `Rentas de 3ª/4ª como autónomo: deducción especial simple (${PARAM_BASE.deSimple}× GNI), con tope en la ganancia de esas categorías.`}
              {liq.tipoDE === 'nuevos' && `Nuevo profesional / emprendedor: deducción especial de ${PARAM_BASE.deNuevos}× GNI.`}
            </p>
            <b className="mono">{money2(liq.dedEspecial)}</b>
          </div>
        </div>
      )}

      {etapa === 3 && (
        <div className="gan-det">
          <div className="gan-two">
            <div className="table-wrap">
              <table className="tbl">
                <tbody>
                  <tr><td>Ganancia neta de 1ª categoría</td><td className="num mono">{money2(liq.porCat.c1)}</td></tr>
                  <tr><td>Ganancia neta de 2ª categoría</td><td className="num mono">{money2(liq.porCat.c2)}</td></tr>
                  <tr><td>Ganancia neta de 3ª categoría</td><td className="num mono">{money2(liq.porCat.c3)}</td></tr>
                  <tr><td>Ganancia neta de 4ª categoría</td><td className="num mono">{money2(liq.porCat.c4)}</td></tr>
                  <tr className="gan-sub"><td>= Ganancia neta</td><td className="num mono">{money2(liq.ganNeta)}</td></tr>
                  <tr><td>(−) Deducciones generales (art. 85)</td><td className="num mono">{money2(liq.dedGenerales)}</td></tr>
                  <tr><td>(−) Ganancia no imponible</td><td className="num mono">{money2(liq.gni)}</td></tr>
                  <tr><td>(−) Cónyuge</td><td className="num mono">{money2(liq.conyuge)}</td></tr>
                  <tr><td>(−) Hijos</td><td className="num mono">{money2(liq.hijos)}</td></tr>
                  <tr><td>(−) Deducción especial</td><td className="num mono">{money2(liq.dedEspecial)}</td></tr>
                  <tr className="gan-sub"><td>= Ganancia neta sujeta a impuesto</td><td className="num mono"><b>{money2(liq.gnsi)}</b></td></tr>
                  {liq.dividendos > 0 && <tr><td>Dividendos (cedular 7%)</td><td className="num mono">{money2(liq.dividendos)} → {money2(liq.impCedular)}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <table className="tbl gan-escala">
                <thead>
                  <tr><th>Más de</th><th>Hasta</th><th className="num">Fijo</th><th className="num">+ %</th></tr>
                </thead>
                <tbody>
                  {caso.tramos.map((t, i) => {
                    const on = liq.gnsi > t.desde && liq.gnsi <= t.hasta;
                    return (
                      <tr key={i} className={on ? 'sel' : ''}>
                        <td className="mono">{money2(t.desde)}</td>
                        <td className="mono">{t.hasta === Infinity ? 'en adelante' : money2(t.hasta)}</td>
                        <td className="num mono">{money2(t.fijo)}</td>
                        <td className="num">{pct(t.alicuota)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <h3 className="gan-q">¿Cuál es el impuesto determinado?</h3>
          <div className="gan-opts" role="radiogroup">
            {opI.map((o) => (
              <button key={o.id} role="radio" aria-checked={resp.impuestoId === o.id} className={`gan-opt ${resp.impuestoId === o.id ? 'on' : ''}`} onClick={() => setResp((s) => ({ ...s, impuestoId: o.id }))} data-ok={DEV ? String(o.correcta) : undefined}>
                <span className="gan-radio" aria-hidden />
                <span className="mono">{o.label}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Impuesto = importe fijo del tramo + alícuota sobre el excedente del límite inferior{liq.dividendos > 0 ? ', más el 7% cedular sobre los dividendos' : ''}.</p>
        </div>
      )}

      {etapa === 4 && (
        <div className="gan-det">
          <div className="gan-pagos">
            {caso.pagos.map((p) => {
              const on = !!resp.pagos[p.id];
              return (
                <button key={p.id} className={`gan-pago card ${on ? 'on' : ''}`} onClick={() => setResp((s) => ({ ...s, pagos: { ...s.pagos, [p.id]: !on } }))} aria-pressed={on} data-ok={DEV ? String(p.corresponde) : undefined}>
                  <span className="gan-check" aria-hidden>{on ? '✓' : ''}</span>
                  <span className="gan-row-txt grow">
                    <b>{p.titulo}</b>
                    <small className="muted">{p.detalle}</small>
                  </span>
                  <span className="mono">{money2(p.monto)}</span>
                </button>
              );
            })}
          </div>
          <div className="gan-f711 card">
            <div className="gan-f711-head">
              <b>F.711 · Vista previa</b>
              <small className="muted">Impuesto a las Ganancias · Personas Humanas · PF {caso.periodo}</small>
            </div>
            <table className="tbl">
              <tbody>
                <tr><td>Impuesto determinado (escala)</td><td className="num mono">{money2(opI.find((o) => o.id === resp.impuestoId)?.monto ?? 0)}</td></tr>
                <tr><td>(−) Pagos a cuenta computados</td><td className="num mono">{money2(liq.pagos)}</td></tr>
                <tr className="gan-sub"><td>= Saldo de la declaración jurada</td><td className="num">?</td></tr>
              </tbody>
            </table>
          </div>
          <h3 className="gan-q">¿Qué resultado tiene la DDJJ?</h3>
          <div className="gan-opts" role="radiogroup">
            {opS.map((o) => (
              <button key={o.id} role="radio" aria-checked={resp.saldoId === o.id} className={`gan-opt ${resp.saldoId === o.id ? 'on' : ''}`} onClick={() => setResp((s) => ({ ...s, saldoId: o.id }))} data-ok={DEV ? String(o.correcta) : undefined}>
                <span className="gan-radio" aria-hidden />
                <span>{o.label}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Si ninguna coincide con tus números, volvé y revisá las etapas anteriores.</p>
        </div>
      )}
    </MinigameShell>
  );
}

function FilaDeduccion({ d, valor, computado, onChange }: { d: Deduccion; valor?: boolean; computado?: number; onChange: (v: boolean) => void }) {
  const tope = d.tope === 'pct5' ? 'tope 5% GN' : d.tope === 'gni' ? 'tope GNI' : d.tope === 'alq40' ? '40%, tope GNI' : d.tope === 'fijo' ? `tope ${money2(d.topeMonto ?? 0)}` : '';
  return (
    <div className={`gan-row ${valor === undefined ? '' : 'done'}`} data-ok={DEV ? String(d.deducible) : undefined} data-testid="gan-ded">
      <div className="gan-row-txt">
        <b>{d.titulo}</b>
        <small className="muted">{d.detalle}</small>
        {valor && computado !== undefined && computado < d.monto && <small className="chip warn">Computado {money2(computado)} ({tope})</small>}
        {!valor && tope && <small className="chip">{tope}</small>}
      </div>
      <span className="mono gan-monto">{money2(d.monto)}</span>
      <div className="gan-seg" role="radiogroup">
        <button role="radio" aria-checked={valor === true} className={valor === true ? 'on ok' : ''} onClick={() => onChange(true)}>
          Deducible
        </button>
        <button role="radio" aria-checked={valor === false} className={valor === false ? 'on bad' : ''} onClick={() => onChange(false)}>
          No deducible
        </button>
      </div>
    </div>
  );
}

function Anticipos({ liq }: { liq: ReturnType<typeof liquidar> }) {
  if (liq.anticipoProx <= 0) return null;
  return (
    <div className="card gan-antic">
      <b>📆 Anticipos del próximo período</b>
      <p className="small">
        5 anticipos del 20% sobre (impuesto determinado − retenciones): <b className="mono">{money2(liq.anticipoProx)}</b> cada uno. Agendalos: vencen entre agosto y abril.
      </p>
    </div>
  );
}

function Machete({ gni }: { gni: number }) {
  return (
    <div className="gan-machete card anim-up">
      <h3>📘 Machete de Ganancias (personas humanas)</h3>
      <ul>
        <li><b>Categorías:</b> 1ª renta del suelo (alquileres) · 2ª rentas de capital (intereses, regalías) · 3ª empresas y explotaciones unipersonales · 4ª trabajo personal (sueldos, honorarios, jubilaciones, directores).</li>
        <li><b>Exentos / no gravados (art. 26 y otros):</b> intereses de plazo fijo en pesos, indemnización por antigüedad, venta de la casa habitación.</li>
        <li><b>Cedular:</b> los dividendos tributan al 7% por separado; no entran en la escala.</li>
        <li><b>No deducible:</b> gastos personales, multas, el propio impuesto a las ganancias, representación por encima del tope.</li>
        <li><b>Deducciones generales (art. 85):</b> aportes jubilatorios (100%), prepaga y donaciones (5% de la GN), servicio doméstico (hasta GNI {money2(gni)}), 40% del alquiler de vivienda (tope GNI), seguro de vida, sepelio e intereses hipotecarios (topes fijos).</li>
        <li><b>Deducciones personales (art. 30):</b> GNI, cónyuge sin ingresos mayores a la GNI, hijos menores de 18 o incapacitados, deducción especial (simple autónomos, incrementada para empleados sobre la 4ª).</li>
        <li><b>Escala (art. 94):</b> progresiva por tramos: fijo + alícuota sobre el excedente.</li>
        <li><b>Pagos a cuenta:</b> retenciones y anticipos, percepciones computables, 33% del impuesto al cheque. El saldo de IVA y las retenciones de IIBB van en su propio impuesto.</li>
      </ul>
    </div>
  );
}
