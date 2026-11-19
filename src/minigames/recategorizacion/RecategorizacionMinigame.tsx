// Minijuego: recategorización semestral de Monotributo.
import { useMemo, useState } from 'react';
import { MinigameResultView, MinigameShell } from '../MinigameShell';
import type { MinigameMeta, MinigameProps, MinigameResult } from '../types';
import { money, num } from '../../engine/format';
import {
  EXCLUSION,
  LETRAS,
  catLabel,
  evaluarRecat,
  generarCasoRecat,
  type CasoRecat,
  type ParamId,
} from './casoRecat';
import './recategorizacion.css';

export const RECATEGORIZACION_META: MinigameMeta = {
  id: 'recategorizacion',
  titulo: 'Recategorización de Monotributo',
  descripcion: 'Sumá los ingresos de los últimos 12 meses, ubicá cada parámetro en la tabla y definí la nueva categoría.',
  horas: 1.5,
  icon: '📊',
};

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
const ETAPAS = ['Ingresos', 'Parámetros', 'Categoría'];

export function RecategorizacionMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoRecat(seed, client, task.periodo, indice), [seed, client, task.periodo, indice]);
  const [etapa, setEtapa] = useState(0);
  const [ingresosId, setIngresosId] = useState<string>();
  const [confirmado, setConfirmado] = useState(false);
  const [params, setParams] = useState<Partial<Record<ParamId, number>>>({});
  const [final, setFinal] = useState<number>();
  const [resultado, setResultado] = useState<MinigameResult>();

  const opIng = caso.opcionesIngresos.find((o) => o.id === ingresosId);
  const paramsCompletos = caso.parametros.every((p) => params[p.id] !== undefined);
  const subtitulo = `${client.nombre} · ${caso.periodoLabel} · ${caso.actividad === 'servicios' ? 'Locación de servicios' : 'Venta de bienes'}`;

  if (resultado) {
    return (
      <MinigameShell icon={RECATEGORIZACION_META.icon} titulo="Recategorización presentada" subtitulo={subtitulo} onCancel={onCancel}>
        <div className={resultado.score < 0.95 ? 'anim-shake' : ''}>
          <MinigameResultView {...resultado} onContinue={() => onComplete(resultado)} />
        </div>
      </MinigameShell>
    );
  }

  const instrucciones = (
    <span>
      {etapa === 0 && 'Revisá la facturación de los últimos 12 meses y elegí el total de ingresos brutos que corresponde declarar.'}
      {etapa === 1 && 'Para cada parámetro, marcá en qué categoría cae según la tabla: la primera cuyo tope no superás.'}
      {etapa === 2 && 'Definí la categoría final del monotributista.'}
    </span>
  );

  const footer = (
    <>
      {etapa > 0 && (
        <button className="btn" onClick={() => setEtapa(etapa - 1)}>
          ← Volver
        </button>
      )}
      <span className="spacer" />
      {etapa === 0 && !confirmado && (
        <button className="btn primary" disabled={!ingresosId} onClick={() => setConfirmado(true)} data-testid="rc-confirmar-ingresos">
          Confirmar ingresos
        </button>
      )}
      {etapa === 0 && confirmado && (
        <button className="btn primary" onClick={() => setEtapa(1)}>
          Siguiente: parámetros →
        </button>
      )}
      {etapa === 1 && (
        <button className="btn primary" disabled={!paramsCompletos} onClick={() => setEtapa(2)}>
          Siguiente: categoría final →
        </button>
      )}
      {etapa === 2 && (
        <button
          className="btn primary"
          disabled={final === undefined}
          onClick={() => setResultado(evaluarRecat(caso, { ingresosId, params, final }))}
          data-testid="rc-presentar"
        >
          Confirmar recategorización ✓
        </button>
      )}
    </>
  );

  return (
    <MinigameShell
      icon={RECATEGORIZACION_META.icon}
      titulo={RECATEGORIZACION_META.titulo}
      subtitulo={subtitulo}
      instrucciones={instrucciones}
      footer={footer}
      onCancel={onCancel}
    >
      <ol className="rc-steps" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <li key={e} className={i === etapa ? 'on' : i < etapa ? 'done' : ''}>
            <span>{i < etapa ? '✓' : i + 1}</span> {e}
          </li>
        ))}
      </ol>

      {etapa === 0 && (
        <div className="rc-ingresos">
          <div className="table-wrap rc-meses">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Facturado</th>
                  <th className="num">Notas de crédito</th>
                </tr>
              </thead>
              <tbody>
                {caso.meses.map((m) => (
                  <tr key={m.mes}>
                    <td>{m.label}</td>
                    <td className="num mono">{money(m.facturado)}</td>
                    <td className="num mono">{m.nc ? <span className="neg">−{money(m.nc)}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
                <tr className="rc-tot">
                  <td>Totales</td>
                  <td className="num mono">{money(caso.totalFacturado)}</td>
                  <td className="num mono">{caso.totalNC ? `−${money(caso.totalNC)}` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rc-side">
            <h3>Ingresos brutos a declarar</h3>
            <div className="rc-opts" role="radiogroup">
              {caso.opcionesIngresos.map((o) => {
                const on = ingresosId === o.id;
                const estado = confirmado ? (o.correcta ? 'ok' : on ? 'bad' : '') : '';
                return (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={on}
                    disabled={confirmado}
                    className={`rc-opt ${on ? 'on rc-pick' : ''} ${estado}`}
                    onClick={() => setIngresosId(o.id)}
                    data-ok={DEV ? String(o.correcta) : undefined}
                  >
                    <span className="rc-radio" aria-hidden />
                    <span className="mono">{money(o.monto)}</span>
                  </button>
                );
              })}
            </div>
            {confirmado && (
              <div className={`rc-feedback ${opIng?.correcta ? 'ok anim-pop' : 'bad anim-shake'}`}>
                {opIng?.correcta ? '✓ ¡Bien! Facturado menos notas de crédito, 12 meses completos.' : `✗ El total correcto es ${money(caso.ingresos)}: facturado − notas de crédito de los 12 meses.`}
              </div>
            )}
            {caso.categoriaActual && (
              <p className="muted small">
                Categoría actual: <b>{caso.categoriaActual}</b>
              </p>
            )}
          </div>
        </div>
      )}

      {etapa === 1 && (
        <div className="rc-params">
          {caso.parametros.map((p) => (
            <div key={p.id} className={`card rc-param ${params[p.id] !== undefined ? 'done' : ''}`}>
              <div className="rc-param-head">
                <span>{p.label}</span>
                <b className="mono">{p.display}</b>
              </div>
              <CatPicker valor={params[p.id]} correcta={p.categoria} onChange={(v) => setParams((s) => ({ ...s, [p.id]: v }))} excedeLabel="Excede K" />
            </div>
          ))}
        </div>
      )}

      {etapa === 2 && (
        <div className="rc-final">
          <div className="rc-resumen">
            {caso.parametros.map((p) => (
              <div key={p.id} className="rc-res-item">
                <small className="muted">{p.label}</small>
                <span>
                  <span className="mono">{p.display}</span> → <b className="chip info">{params[p.id] !== undefined ? catLabel(params[p.id]!) : '?'}</b>
                </span>
              </div>
            ))}
          </div>
          {caso.categoriaActual && (
            <p className="small">
              Categoría actual: <b>{caso.categoriaActual}</b>
            </p>
          )}
          <h3>¿Qué categoría le corresponde?</h3>
          <CatPicker valor={final} correcta={caso.categoriaFinal} onChange={setFinal} excedeLabel="Exclusión → RI" grande />
          {final !== undefined && final < EXCLUSION && (
            <p className="muted small anim-up">
              Cuota mensual de la categoría {LETRAS[final]} ({caso.actividad === 'servicios' ? 'servicios' : 'venta de bienes'}):{' '}
              <b className="mono">{money(caso.actividad === 'servicios' ? caso.tabla[final].cuotaServicios : caso.tabla[final].cuotaVentas)}</b>
            </p>
          )}
          {final === EXCLUSION && <p className="muted small anim-up">Exclusión: el contribuyente deja el régimen simplificado y se da de alta en IVA y Ganancias.</p>}
        </div>
      )}

      {etapa > 0 && <TablaReferencia caso={caso} marcada={etapa === 2 ? final : undefined} />}
    </MinigameShell>
  );
}

function CatPicker({
  valor,
  correcta,
  onChange,
  excedeLabel,
  grande,
}: {
  valor?: number;
  correcta: number;
  onChange: (v: number) => void;
  excedeLabel: string;
  grande?: boolean;
}) {
  const ops = [...LETRAS.map((_, i) => i), EXCLUSION];
  return (
    <div className={`rc-picker ${grande ? 'grande' : ''}`} role="radiogroup">
      {ops.map((i) => (
        <button
          key={i}
          role="radio"
          aria-checked={valor === i}
          className={`${i === EXCLUSION ? 'excede' : ''} ${valor === i ? 'on rc-pick' : ''}`}
          onClick={() => onChange(i)}
          data-ok={DEV ? String(i === correcta) : undefined}
        >
          {i === EXCLUSION ? excedeLabel : LETRAS[i]}
        </button>
      ))}
    </div>
  );
}

function TablaReferencia({ caso, marcada }: { caso: CasoRecat; marcada?: number }) {
  return (
    <details className="rc-tabla" open>
      <summary>Tabla de categorías (valores vigentes en el juego)</summary>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Cat.</th>
              <th className="num">Ingresos brutos anuales</th>
              <th className="num">Superficie</th>
              <th className="num">Energía anual</th>
              <th className="num">Alquileres anuales</th>
              <th className="num">Cuota {caso.actividad === 'servicios' ? 'servicios' : 'ventas'}</th>
            </tr>
          </thead>
          <tbody>
            {caso.tabla.map((f, i) => (
              <tr key={f.cat} className={marcada === i ? 'sel' : ''}>
                <td>
                  <b>{f.cat}</b>
                </td>
                <td className="num mono">{money(f.ingresos)}</td>
                <td className="num mono">{num(f.superficie)} m²</td>
                <td className="num mono">{num(f.energia)} kW</td>
                <td className="num mono">{money(f.alquiler)}</td>
                <td className="num mono">{money(caso.actividad === 'servicios' ? f.cuotaServicios : f.cuotaVentas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted tiny">Valores de juego, inspirados en la tabla oficial. Se actualizan con la inflación de la partida.</p>
    </details>
  );
}
