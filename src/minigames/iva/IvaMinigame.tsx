// Minijuego: liquidación mensual de IVA (Responsable Inscripto).
import { useMemo, useState } from 'react';
import { MinigameResultView, MinigameShell } from '../MinigameShell';
import type { MinigameMeta, MinigameProps, MinigameResult } from '../types';
import { money2 } from '../../engine/format';
import { fechaAR } from '../../engine/calendar';
import {
  CLASIF_LABEL,
  TIPO_LABEL,
  evaluarIva,
  generarCasoIva,
  totales,
  type Clasif,
  type Comprobante,
} from './casoIva';
import './iva.css';

export const IVA_META: MinigameMeta = {
  id: 'iva',
  titulo: 'Liquidación de IVA',
  descripcion: 'Clasificá los comprobantes del mes, computá los pagos a cuenta y determiná el saldo de la DDJJ.',
  horas: 2,
  icon: '🧾',
};

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
const CLASIFS: Clasif[] = ['debito', 'credito', 'no_computa'];
const CORTO: Record<Clasif, string> = { debito: 'Débito', credito: 'Crédito', no_computa: 'No computa' };
const ETAPAS = ['Comprobantes', 'Pagos a cuenta', 'Determinación'];

export function IvaMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoIva(seed, client, task.periodo, indice), [seed, client, task.periodo, indice]);
  const [etapa, setEtapa] = useState(0);
  const [clasif, setClasif] = useState<Record<string, Clasif | undefined>>({});
  const [pagos, setPagos] = useState<Record<string, boolean | undefined>>({});
  const [opcionId, setOpcionId] = useState<string>();
  const [ayuda, setAyuda] = useState(false);
  const [resultado, setResultado] = useState<MinigameResult>();

  const { df, cf } = useMemo(() => totales(caso.comprobantes, clasif), [caso, clasif]);
  const pac = caso.pagos.reduce((a, p) => a + (pagos[p.id] ? p.monto : 0), 0);
  const clasificados = caso.comprobantes.filter((c) => clasif[c.id]).length;
  const total = caso.comprobantes.length;

  const presentar = () => setResultado(evaluarIva(caso, { clasif, pagos, opcionId }));

  if (resultado) {
    return (
      <MinigameShell icon={IVA_META.icon} titulo="DDJJ de IVA presentada" subtitulo={`${client.nombre} · ${caso.periodoLabel}`} onCancel={onCancel}>
        <div className={resultado.score < 0.95 ? 'anim-shake' : ''}>
          <MinigameResultView {...resultado} onContinue={() => onComplete(resultado)} />
        </div>
      </MinigameShell>
    );
  }

  const instrucciones = (
    <div className="iva-help-row">
      <span>
        {etapa === 0 && 'Clasificá cada comprobante del mes: ¿genera débito fiscal, crédito fiscal o no computa? El sistema va sumando a medida que avanzás.'}
        {etapa === 1 && 'Marcá qué retenciones y percepciones se computan como pago a cuenta en la DDJJ de IVA.'}
        {etapa === 2 && 'Con tus números, elegí el resultado correcto de la declaración jurada.'}
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
        <button className="btn primary" disabled={clasificados < total} onClick={() => setEtapa(1)}>
          {clasificados < total ? `Faltan ${total - clasificados}` : 'Siguiente: pagos a cuenta →'}
        </button>
      )}
      {etapa === 1 && (
        <button className="btn primary" onClick={() => setEtapa(2)}>
          Siguiente: determinación →
        </button>
      )}
      {etapa === 2 && (
        <button className="btn primary" disabled={!opcionId} onClick={presentar} data-testid="iva-presentar">
          Presentar DDJJ ✓
        </button>
      )}
    </>
  );

  return (
    <MinigameShell
      icon={IVA_META.icon}
      titulo={IVA_META.titulo}
      subtitulo={`${client.nombre} · período ${caso.periodoLabel}`}
      instrucciones={instrucciones}
      footer={footer}
      onCancel={onCancel}
    >
      {ayuda && <Machete />}

      <ol className="iva-steps" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <li key={e} className={i === etapa ? 'on' : i < etapa ? 'done' : ''}>
            <span>{i < etapa ? '✓' : i + 1}</span> {e}
          </li>
        ))}
      </ol>

      <div className="iva-sum" role="status">
        <div>
          <small>Débito fiscal</small>
          <b className="mono">{money2(df)}</b>
        </div>
        <div>
          <small>Crédito fiscal</small>
          <b className="mono">{money2(cf)}</b>
        </div>
        {etapa === 0 ? (
          <div>
            <small>Clasificados</small>
            <b>
              {clasificados}/{total}
            </b>
            <div className="bar">
              <i style={{ width: `${(clasificados / total) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div>
            <small>Pagos a cuenta</small>
            <b className="mono">{money2(pac)}</b>
          </div>
        )}
      </div>

      {etapa === 0 && (
        <div className="iva-list">
          <div className="iva-row iva-head" aria-hidden>
            <span>Fecha</span>
            <span>Comprobante</span>
            <span>Contraparte · concepto</span>
            <span className="num">Neto</span>
            <span className="num">IVA</span>
            <span className="num">Total</span>
            <span>Clasificación</span>
          </div>
          {caso.comprobantes.map((c) => (
            <FilaComprobante key={c.id} c={c} valor={clasif[c.id]} onChange={(v) => setClasif((s) => ({ ...s, [c.id]: v }))} />
          ))}
        </div>
      )}

      {etapa === 1 && (
        <div className="iva-pagos">
          {caso.pagos.map((p) => {
            const on = !!pagos[p.id];
            return (
              <button
                key={p.id}
                className={`iva-pago card ${on ? 'on' : ''}`}
                onClick={() => setPagos((s) => ({ ...s, [p.id]: !on }))}
                aria-pressed={on}
                data-ok={DEV ? String(p.corresponde) : undefined}
              >
                <span className="iva-check" aria-hidden>
                  {on ? '✓' : ''}
                </span>
                <span className="iva-pago-txt">
                  <b>{p.titulo}</b>
                  <small className="muted">{p.detalle}</small>
                </span>
                <span className="mono iva-pago-monto">{money2(p.monto)}</span>
              </button>
            );
          })}
          <p className="muted small">Tocá una tarjeta para computarla (o descomputarla) en esta DDJJ.</p>
        </div>
      )}

      {etapa === 2 && (
        <div className="iva-det">
          <div className="table-wrap">
            <table className="tbl">
              <tbody>
                <tr>
                  <td>Débito fiscal</td>
                  <td className="num mono">{money2(df)}</td>
                </tr>
                <tr>
                  <td>(−) Crédito fiscal</td>
                  <td className="num mono">{money2(cf)}</td>
                </tr>
                <tr>
                  <td>(−) Saldo técnico a favor del período anterior</td>
                  <td className="num mono">{money2(caso.saldoAnterior)}</td>
                </tr>
                <tr className="iva-det-q">
                  <td>= Saldo técnico</td>
                  <td className="num">?</td>
                </tr>
                <tr>
                  <td>(−) Pagos a cuenta computados (retenciones y percepciones)</td>
                  <td className="num mono">{money2(pac)}</td>
                </tr>
                <tr className="iva-det-q">
                  <td>= Resultado de la DDJJ</td>
                  <td className="num">?</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3 className="iva-q">¿Qué resultado da la declaración jurada?</h3>
          <div className="iva-opts" role="radiogroup">
            {caso.opciones.map((o) => (
              <button
                key={o.id}
                role="radio"
                aria-checked={opcionId === o.id}
                className={`iva-opt ${opcionId === o.id ? 'on iva-pick' : ''}`}
                onClick={() => setOpcionId(o.id)}
                data-ok={DEV ? String(o.correcta) : undefined}
              >
                <span className="iva-radio" aria-hidden />
                <span>{o.label}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Si ninguna opción coincide con tus números, volvé y revisá la clasificación.</p>
        </div>
      )}
    </MinigameShell>
  );
}

function FilaComprobante({ c, valor, onChange }: { c: Comprobante; valor?: Clasif; onChange: (v: Clasif) => void }) {
  const neg = c.signo < 0 ? '−' : '';
  return (
    <div className={`iva-row ${valor ? 'done' : ''}`} data-ok={DEV ? c.aceptadas[0] : undefined} data-testid="iva-row">
      <span className="iva-fecha mono">{fechaAR(c.fecha).slice(0, 5)}</span>
      <span className="iva-comp">
        <span className={`chip ${c.sentido === 'emitido' ? 'info' : 'accent'}`}>{c.sentido === 'emitido' ? 'Emitido' : 'Recibido'}</span>
        <b className={c.signo < 0 ? 'neg' : ''}>{TIPO_LABEL[c.tipo]}</b>
        <small className="mono muted">{c.numero}</small>
      </span>
      <span className="iva-cp">
        <b>{c.contraparte}</b> <small className="muted">({c.condicion})</small>
        <small className="iva-concepto">{c.concepto}</small>
        {c.percepcion ? <span className="chip warn">Percepción IVA {money2(c.percepcion)}</span> : null}
      </span>
      <span className="num mono iva-neto" data-label="Neto">
        {neg}
        {money2(c.neto)}
      </span>
      <span className="num mono iva-iva" data-label="IVA">
        {c.discrimina || c.sentido === 'emitido' ? (
          <>
            {neg}
            {money2(c.iva)} <small className="muted">{c.discrimina ? `${String(c.alicuota * 100).replace('.', ',')}%` : 'contenido'}</small>
          </>
        ) : (
          <small className="muted">no discrimina</small>
        )}
      </span>
      <span className="num mono iva-total" data-label="Total">
        {neg}
        {money2(c.total)}
      </span>
      <span className="iva-seg" role="radiogroup" aria-label={`Clasificación ${TIPO_LABEL[c.tipo]} ${c.numero}`}>
        {CLASIFS.map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={valor === k}
            title={CLASIF_LABEL[k]}
            className={`seg-${k} ${valor === k ? 'on iva-pick' : ''}`}
            onClick={() => onChange(k)}
          >
            {CORTO[k]}
          </button>
        ))}
      </span>
    </div>
  );
}

function Machete() {
  return (
    <div className="iva-machete card anim-up">
      <h3>📘 Machete de IVA</h3>
      <ul>
        <li>
          <b>Débito fiscal:</b> el IVA de tus ventas, discriminado (Factura A) o contenido en el precio (Factura B a consumidor final). Las notas de crédito emitidas lo reducen.
        </li>
        <li>
          <b>Crédito fiscal:</b> solo el IVA <b>discriminado</b> en comprobantes de compra (Factura A) vinculados con tu actividad gravada. Las notas de crédito recibidas lo reducen.
        </li>
        <li>
          <b>No computa:</b> Factura B o C recibidas (no discriminan IVA) y gastos personales o no vinculados, aunque vengan en Factura A.
        </li>
        <li>
          <b>Saldo técnico</b> = débito − crédito − saldo técnico a favor del mes anterior. Si da a favor, se traslada al mes siguiente.
        </li>
        <li>
          <b>Pagos a cuenta</b> (retenciones y percepciones de IVA) se restan <b>después</b> del saldo técnico. Si superan el impuesto, generan <b>saldo de libre disponibilidad</b>.
        </li>
        <li>Las retenciones de Ganancias o percepciones de IIBB se computan en su propio impuesto, no en IVA.</li>
      </ul>
    </div>
  );
}
