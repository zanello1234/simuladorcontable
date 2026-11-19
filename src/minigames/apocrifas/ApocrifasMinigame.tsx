// Minijuego: control de comprobantes de compra y detección de facturas apócrifas.
import { useMemo, useState } from 'react';
import { fechaAR } from '../../engine/calendar';
import { money, money2 } from '../../engine/format';
import type { MinigameId } from '../../engine/types';
import { MinigameResultView, MinigameShell } from '../MinigameShell';
import type { MinigameMeta, MinigameProps, MinigameResult } from '../types';
import { CONSULTAS, MOTIVO, MOTIVOS, creditoApocrifoImpugnado, cuitEsValido, evaluarApocrifas, generarCasoApocrifas, respuestaConsulta, type Consulta, type Decision, type Evaluacion, type Factura, type Motivo } from './casoApocrifas';
import './apocrifas.css';

export const APOCRIFAS_META: MinigameMeta = {
  id: 'apocrifas' as MinigameId,
  titulo: 'Control de comprobantes',
  descripcion: 'Revisá las facturas de compra del mes, consultá ARCA y rechazá las apócrifas antes de computar el crédito fiscal.',
  horas: 2,
  icon: '🕵️',
};

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
const LETRA_COD: Record<string, string> = { A: '01', B: '06', C: '11', M: '51' };

export function ApocrifasMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoApocrifas(seed, client, task.periodo, indice), [seed, client, task.periodo, indice]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, Decision | undefined>>({});
  const [consultas, setConsultas] = useState<Record<string, Partial<Record<Consulta, true>>>>({});
  const [ayuda, setAyuda] = useState(false);
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [resultado, setResultado] = useState<(MinigameResult & { ev: Evaluacion; impugnadoApocrifo: number }) | undefined>();

  const usadas = Object.values(consultas).reduce((a, c) => a + Object.keys(c).length, 0);
  const restantes = caso.presupuestoConsultas - usadas;
  const decididas = caso.facturas.filter((f) => decisiones[f.id]).length;
  const f = caso.facturas.find((x) => x.id === abierta);

  const consultar = (fid: string, c: Consulta) => {
    if (consultas[fid]?.[c] || restantes <= 0) return;
    setConsultas({ ...consultas, [fid]: { ...(consultas[fid] ?? {}), [c]: true } });
  };
  const decidir = (fid: string, d: Decision) => {
    setDecisiones({ ...decisiones, [fid]: d });
    setEligiendoMotivo(false);
  };
  const presentar = () => {
    const ev = evaluarApocrifas(caso, { decisiones, consultasUsadas: usadas });
    setResultado({ score: ev.score, resumen: ev.resumen, errores: ev.errores, ev, impugnadoApocrifo: creditoApocrifoImpugnado(caso, { decisiones, consultasUsadas: usadas }) });
  };

  if (resultado) {
    const { ev, impugnadoApocrifo } = resultado;
    const avisoCliente =
      ev.truchasDetectadas > 0
        ? `"Hay ${ev.truchasDetectadas} comprobante/s que no voy a computar: no pasan los controles de ARCA. Si los incluimos y después viene una fiscalización, el ajuste es el IVA más intereses y una multa de 1 vez el impuesto omitido (art. 45, Ley 11.683); si lo consideran doloso, de 2 a 6 veces (art. 46). Pedile al proveedor que regularice o buscá otro."`
        : '"Los comprobantes del mes están en orden."';
    return (
      <MinigameShell icon={APOCRIFAS_META.icon} titulo="Control de comprobantes terminado" subtitulo={`${client.nombre} · ${caso.periodoLabel}`} onCancel={onCancel}>
        <div className="ap-resumen card">
          <div className="ap-kpis">
            <div>
              <span className="tiny muted">Crédito fiscal computado</span>
              <b className="mono">{money(ev.creditoComputado)}</b>
            </div>
            <div>
              <span className="tiny muted">Crédito impugnado</span>
              <b className="mono">{money(ev.creditoImpugnado)}</b>
            </div>
            <div>
              <span className="tiny muted">Riesgo evitado (IVA + multa art. 45)</span>
              <b className="mono pos">{money(impugnadoApocrifo * 2)}</b>
            </div>
            {ev.creditoApocrifoComputado > 0 && (
              <div>
                <span className="tiny muted">Crédito apócrifo que dejaste pasar</span>
                <b className="mono neg">{money(ev.creditoApocrifoComputado)}</b>
              </div>
            )}
          </div>
          <p className="small">
            <b>Lo que le decís al cliente:</b> {avisoCliente}
          </p>
        </div>
        <div className={resultado.score < 0.95 ? 'anim-shake' : ''}>
          <MinigameResultView score={resultado.score} resumen={resultado.resumen} errores={resultado.errores} onContinue={() => onComplete({ score: resultado.score, resumen: resultado.resumen, errores: resultado.errores })} />
        </div>
      </MinigameShell>
    );
  }

  const instrucciones = (
    <div className="ap-help-row">
      <span>
        Mirá cada factura, consultá lo que no podés ver a simple vista y decidí: <b>computar</b> o <b>impugnar</b>. Tenés <b>{restantes}</b> consultas disponibles de {caso.presupuestoConsultas}: elegí bien.
      </span>
      <button className="btn sm" onClick={() => setAyuda(!ayuda)}>
        📘 Machete
      </button>
    </div>
  );

  return (
    <MinigameShell icon={APOCRIFAS_META.icon} titulo="Control de comprobantes" subtitulo={`${client.nombre} · compras de ${caso.periodoLabel}`} instrucciones={instrucciones} onCancel={onCancel} footer={
      <>
        <span className="small muted">
          {decididas}/{caso.facturas.length} decididas · consultas {usadas}/{caso.presupuestoConsultas}
        </span>
        <div className="spacer" />
        <button className="btn primary" disabled={decididas < caso.facturas.length} onClick={presentar}>
          {decididas < caso.facturas.length ? `Faltan ${caso.facturas.length - decididas}` : 'Cerrar el control'}
        </button>
      </>
    }>
      {ayuda && (
        <div className="card ap-machete">
          <b>Qué mira un contador antes de computar un crédito fiscal</b>
          <ul>
            <li>
              <b>CUIT:</b> verificá el dígito. Multiplicá los 10 primeros dígitos por 5-4-3-2-7-6-5-4-3-2, sumá, calculá 11 − (suma mod 11): si da 11 es 0; si da 10 el CUIT no existe.
            </li>
            <li>
              <b>Letra:</b> un monotributista emite C (sin IVA). La A y la M discriminan IVA; la B no. Si la letra no cierra con la condición del emisor, no hay crédito.
            </li>
            <li>
              <b>CAE y vencimiento:</b> la fecha de emisión tiene que ser anterior al vencimiento del CAE. Y el CAE tiene que existir en ARCA para ese CUIT, número y fecha ("Validar comprobante").
            </li>
            <li>
              <b>Constancia de inscripción:</b> estado activo, condición y actividad coherente con lo que te factura.
            </li>
            <li>
              <b>APOC:</b> la base de ARCA de emisores de facturas apócrifas.
            </li>
            <li>
              <b>Capacidad operativa:</b> empleados, antigüedad, domicilio, bienes. Una "empresa" de 2 meses, sin gente y en un baldío no presta servicios por millones.
            </li>
            <li>
              <b>Pago:</b> Ley 25.345 (antievasión): los pagos por encima del tope tienen que ser bancarizados y a nombre del emisor; si no, el gasto y el crédito no son computables. Tope de juego: {money(caso.topeEfectivo)} [A CONFIRMAR].
            </li>
            <li>
              <b>Duplicados:</b> cotejá punto de venta y número contra lo ya cargado.
            </li>
          </ul>
          <details className="small">
            <summary>Comprobantes ya cargados en el período anterior</summary>
            <div className="ap-cargados mono">{caso.cargadosAntes.join(' · ')}</div>
          </details>
        </div>
      )}

      {!f ? (
        <div className="ap-lista">
          {caso.facturas.map((x) => {
            const d = decisiones[x.id];
            const nq = Object.keys(consultas[x.id] ?? {}).length;
            return (
              <button key={x.id} className={`ap-item ${d ? (d.rechaza ? 'rechazada' : 'ok') : ''}`} onClick={() => setAbierta(x.id)} data-ok={DEV ? (x.apocrifa ? `trucha:${x.motivo}` : 'legit') : undefined} data-testid="ap-item">
                <span className={`ap-letra l-${x.letra}`}>{x.letra}</span>
                <span className="col tight grow minw0">
                  <b className="ellipsis">{x.emisor}</b>
                  <span className="tiny muted ellipsis">
                    {x.ptoVta}-{x.numero} · {fechaAR(x.fecha)} · {x.concepto}
                  </span>
                </span>
                <span className="col tight right">
                  <span className="mono small">{money(x.total)}</span>
                  <span className="tiny">{d ? (d.rechaza ? `✖ ${MOTIVO[d.motivo!].corto}` : '✔ Computar') : nq ? `${nq} consulta/s` : 'Sin revisar'}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <FichaFactura
          f={f}
          casoCargados={caso.cargadosAntes}
          topeEfectivo={caso.topeEfectivo}
          consultas={consultas[f.id] ?? {}}
          restantes={restantes}
          decision={decisiones[f.id]}
          eligiendoMotivo={eligiendoMotivo}
          onConsultar={(c) => consultar(f.id, c)}
          onComputar={() => decidir(f.id, { rechaza: false })}
          onRechazar={() => setEligiendoMotivo(true)}
          onMotivo={(m) => decidir(f.id, { rechaza: true, motivo: m })}
          onCancelarMotivo={() => setEligiendoMotivo(false)}
          onVolver={() => {
            setAbierta(null);
            setEligiendoMotivo(false);
          }}
          respuesta={(c) => respuestaConsulta(caso, f, c)}
        />
      )}
    </MinigameShell>
  );
}

interface FichaProps {
  f: Factura;
  casoCargados: string[];
  topeEfectivo: number;
  consultas: Partial<Record<Consulta, true>>;
  restantes: number;
  decision?: Decision;
  eligiendoMotivo: boolean;
  onConsultar: (c: Consulta) => void;
  onComputar: () => void;
  onRechazar: () => void;
  onMotivo: (m: Motivo) => void;
  onCancelarMotivo: () => void;
  onVolver: () => void;
  respuesta: (c: Consulta) => { titulo: string; lineas: string[]; alerta: boolean };
}

function FichaFactura({ f, consultas, restantes, decision, eligiendoMotivo, onConsultar, onComputar, onRechazar, onMotivo, onCancelarMotivo, onVolver, respuesta }: FichaProps) {
  const discrimina = f.iva > 0;
  const cuitOk = cuitEsValido(f.cuit);
  return (
    <div className="ap-ficha anim-up">
      <div className="row">
        <button className="btn sm ghost" onClick={onVolver}>
          ← Volver a la pila
        </button>
        <div className="spacer" />
        {decision && <span className={`chip ${decision.rechaza ? 'bad' : 'ok'}`}>{decision.rechaza ? `Impugnada: ${MOTIVO[decision.motivo!].corto}` : 'Marcada para computar'}</span>}
      </div>

      {/* Factura dibujada */}
      <div className="factura" data-ok={DEV ? (f.apocrifa ? `trucha:${f.motivo}` : 'legit') : undefined}>
        <div className="fac-head">
          <div className="fac-emisor">
            <b>{f.emisor}</b>
            <span className="tiny">Razón social: {f.emisor}</span>
            <span className="tiny">Domicilio comercial: {f.domicilio}</span>
            <span className="tiny">Condición frente al IVA: {f.condicionEmisor}</span>
          </div>
          <div className="fac-letra">
            <b>{f.letra}</b>
            <span>Cód. {LETRA_COD[f.letra]}</span>
          </div>
          <div className="fac-datos">
            <b>FACTURA</b>
            <span className="tiny">ORIGINAL</span>
            <span className="mono">
              Punto de venta: {f.ptoVta} Comp. Nro: {f.numero}
            </span>
            <span>Fecha de emisión: {fechaAR(f.fecha)}</span>
            <span className={`mono ${cuitOk ? '' : 'fac-dudoso'}`}>CUIT: {f.cuit}</span>
            <span className="tiny">Ingresos Brutos: Convenio Multilateral · Inicio de actividades: {fechaAR(f.constancia.inscriptoDesde)}</span>
          </div>
        </div>
        <div className="fac-cliente tiny">
          <span>Período facturado: {fechaAR(f.fecha).slice(3)} · Condición de venta: {f.pagoResumen === 'Efectivo' ? 'Contado' : 'Cuenta corriente'}</span>
        </div>
        <table className="fac-tabla">
          <thead>
            <tr>
              <th>Producto / Servicio</th>
              <th className="num">Cant.</th>
              <th className="num">Precio unit.</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{f.concepto}</td>
              <td className="num">1,00</td>
              <td className="num">{money2(f.neto)}</td>
              <td className="num">{money2(f.neto)}</td>
            </tr>
          </tbody>
        </table>
        <div className="fac-totales">
          {discrimina ? (
            <>
              <span>Importe neto gravado</span>
              <b className="mono">{money2(f.neto)}</b>
              <span>IVA {f.iva / f.neto > 0.15 ? '21%' : '10,5%'}</span>
              <b className="mono">{money2(f.iva)}</b>
            </>
          ) : (
            <>
              <span>Subtotal</span>
              <b className="mono">{money2(f.neto)}</b>
            </>
          )}
          <span className="fac-total">Importe total</span>
          <b className="mono fac-total">{money2(f.total)}</b>
        </div>
        <div className="fac-foot">
          <div className="fac-qr" aria-hidden>
            {Array.from({ length: 49 }, (_, i) => (
              <i key={i} className={(Number(f.cae[i % 14]) + i) % 3 ? 'on' : ''} />
            ))}
          </div>
          <div className="col tight">
            <span className="tiny">Comprobante Autorizado</span>
            <span className="mono">CAE N°: {f.cae}</span>
            <span className={`mono ${f.caeVto < f.fecha ? 'fac-dudoso' : ''}`}>Fecha de Vto. de CAE: {fechaAR(f.caeVto)}</span>
            <span className="tiny muted">Registrado como pagado por: {f.pagoResumen}</span>
          </div>
        </div>
      </div>

      {/* Consultas */}
      <div className="ap-consultas">
        <div className="row">
          <b className="small">Consultas</b>
          <span className="tiny muted">quedan {restantes}</span>
        </div>
        <div className="ap-consulta-btns">
          {CONSULTAS.map((c) => (
            <button key={c.id} className={`btn sm ${consultas[c.id] ? 'done' : ''}`} disabled={!consultas[c.id] && restantes <= 0} title={c.descripcion} onClick={() => onConsultar(c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        {CONSULTAS.filter((c) => consultas[c.id]).map((c) => {
          const r = respuesta(c.id);
          return (
            <div key={c.id} className={`ap-respuesta anim-pop ${r.alerta ? 'alerta' : ''}`}>
              <b className="small">
                {c.icon} {r.titulo}
              </b>
              {r.lineas.map((l, i) => (
                <span key={i} className="small">
                  {l}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* Decisión */}
      {!eligiendoMotivo ? (
        <div className="ap-decision">
          <button className="btn primary" onClick={onComputar}>
            ✔ Computar
          </button>
          <button className="btn danger" onClick={onRechazar}>
            ✖ Rechazar / impugnar
          </button>
        </div>
      ) : (
        <div className="ap-motivos anim-up">
          <b className="small">¿Por qué la impugnás?</b>
          {MOTIVOS.map((m) => (
            <button key={m.id} className="btn sm block ap-motivo" onClick={() => onMotivo(m.id)}>
              {m.label}
            </button>
          ))}
          <button className="btn sm ghost" onClick={onCancelarMotivo}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
