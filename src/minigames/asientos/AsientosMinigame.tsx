// Minijuego: Asientos del mes (registración en el Libro Diario).
import { useMemo, useState } from 'react';
import { money2 } from '../../engine/format';
import { MinigameResultView, MinigameShell } from '../MinigameShell';
import type { MinigameMeta, MinigameProps, MinigameResult } from '../types';
import { asientoVacio, balancea, clonar, type Asiento } from './asiento';
import { evaluarAsientos, generarCasoAsientos, sumasYSaldos, type RespuestasAsientos } from './casoAsientos';
import { AsientoView, ConstructorAsiento, sanear } from './ConstructorAsiento';
import { PLAN, cuenta } from './planCuentas';
import './asientos.css';

export const ASIENTOS_META: MinigameMeta = {
  id: 'asientos',
  titulo: 'Asientos del mes',
  descripcion: 'Registrá en el Libro Diario las operaciones del mes del cliente: ventas, compras, cobros, pagos, sueldos y devengamientos.',
  horas: 2,
  icon: '📒',
};

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

export function AsientosMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoAsientos(seed, client, task.periodo, indice), [seed, client, task.periodo, indice]);
  const ops = caso.operaciones;
  const [i, setI] = useState(0);
  const [borrador, setBorrador] = useState<Asiento>(asientoVacio());
  const [grabados, setGrabados] = useState<RespuestasAsientos>({});
  const [marcaNada, setMarcaNada] = useState<Record<string, boolean>>({});
  const [ayuda, setAyuda] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const [fase, setFase] = useState<'carga' | 'diario'>('carga');
  const [resultado, setResultado] = useState<MinigameResult>();
  const op = ops[i];
  const grabado = grabados[op?.id];
  const total = ops.length;
  const hechos = ops.filter((o) => grabados[o.id] !== undefined).length;

  const ir = (k: number) => {
    setI(k);
    setBorrador(grabados[ops[k].id] ? clonar(grabados[ops[k].id]!) : asientoVacio());
    setAviso(undefined);
  };
  const grabar = (a: Asiento) => {
    const limpio = sanear(a);
    setGrabados((g) => ({ ...g, [op.id]: limpio }));
    setBorrador(clonar(limpio));
    setAviso(undefined);
    if (i < total - 1 && grabados[ops[i + 1].id] === undefined) setTimeout(() => ir(i + 1), 250);
  };
  const noRegistrar = () => {
    setMarcaNada((m) => ({ ...m, [op.id]: true }));
    grabar(asientoVacio());
  };
  const proponer = () => {
    setBorrador(clonar(op.propuesta));
    setAviso('El sistema propuso un asiento. Revisalo: puede tener un error típico. Corregilo o grabalo si estás de acuerdo.');
  };
  const presentar = () => setResultado(evaluarAsientos(caso, grabados));

  if (resultado) {
    return (
      <MinigameShell icon={ASIENTOS_META.icon} titulo="Libro Diario del mes" subtitulo={`${client.nombre} · ${caso.periodoLabel}`} onCancel={onCancel}>
        <div className={resultado.score < 0.95 ? 'anim-shake' : ''}>
          <MinigameResultView {...resultado} onContinue={() => onComplete(resultado)} />
        </div>
      </MinigameShell>
    );
  }

  const listo = balancea(sanear(borrador));
  const instrucciones = (
    <div className="as-help-row">
      <span>
        {fase === 'carga'
          ? 'Por cada operación armá el asiento: elegí las cuentas (código + nombre) y los importes del comprobante. Si la operación no corresponde a este mes, marcalo.'
          : 'Revisá el Libro Diario y las sumas y saldos. Si algo no te cierra, volvé a la operación y corregila.'}
      </span>
      <button className="btn sm ghost" onClick={() => setAyuda((a) => !a)} aria-expanded={ayuda}>
        📘 {ayuda ? 'Cerrar plan' : 'Plan de cuentas'}
      </button>
    </div>
  );

  const footer =
    fase === 'carga' ? (
      <>
        <span className="small muted">
          {hechos}/{total} registradas
        </span>
        <span className="spacer" />
        <button className="btn primary" disabled={hechos < total} onClick={() => setFase('diario')}>
          {hechos < total ? `Faltan ${total - hechos}` : 'Ver Libro Diario →'}
        </button>
      </>
    ) : (
      <>
        <button className="btn" onClick={() => setFase('carga')}>
          ← Volver a las operaciones
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={presentar} data-testid="as-cerrar">
          Cerrar el mes ✓
        </button>
      </>
    );

  return (
    <MinigameShell icon={ASIENTOS_META.icon} titulo={ASIENTOS_META.titulo} subtitulo={`${client.nombre} · ${caso.periodoLabel}`} instrucciones={instrucciones} footer={footer} onCancel={onCancel}>
      {ayuda && <Machete />}
      {fase === 'carga' && op && (
        <>
          <div className="as-nav" aria-label="Operaciones">
            {ops.map((o, k) => (
              <button key={o.id} className={`${k === i ? 'on' : ''} ${grabados[o.id] !== undefined ? 'done' : ''}`} onClick={() => ir(k)} title={o.titulo}>
                {k + 1}
              </button>
            ))}
          </div>
          <div className="as-op" data-ok={DEV ? JSON.stringify(op.solucion) : undefined} data-op={op.id}>
            <div className="as-doc">
              <span className="chip">{op.fecha}</span>
              <h4>{op.titulo}</h4>
              <ul>
                {op.detalle.map((d, k) => (
                  <li key={k}>{d}</li>
                ))}
              </ul>
              <div className="as-actions">
                <button className="btn sm" onClick={proponer}>
                  🤖 Proponer asiento
                </button>
                <button className={`btn sm ${marcaNada[op.id] ? 'warn' : ''}`} onClick={noRegistrar} title="Si el hecho no corresponde a este período">
                  🚫 No se registra este mes
                </button>
              </div>
              {aviso && <div className="as-alert">{aviso}</div>}
              {grabado && <p className="tiny pos mt">✓ Grabado{grabado.lineas.length === 0 ? ' como "no se registra"' : ''}. Podés corregirlo y volver a grabar.</p>}
            </div>
            <div>
              <ConstructorAsiento value={borrador} onChange={setBorrador} chips={op.chips} sugeridas={op.sugeridas} />
              <div className="as-actions">
                <button className="btn primary" disabled={!listo} onClick={() => grabar(borrador)} data-testid="as-grabar">
                  Grabar asiento
                </button>
                <button className="btn ghost sm" onClick={() => setBorrador(asientoVacio())}>
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {fase === 'diario' && (
        <div className="col">
          <h3>Libro Diario · {caso.periodoLabel}</h3>
          {ops.map((o, k) => (
            <AsientoView key={o.id} a={grabados[o.id] ?? asientoVacio()} titulo={`${k + 1}. ${o.fecha} · ${o.titulo}`} />
          ))}
          <h3 className="mt">Sumas y saldos del mes</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th className="num">Debe</th>
                  <th className="num">Haber</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {sumasYSaldos(grabados).map((r) => (
                  <tr key={r.cuenta}>
                    <td>
                      <span className="mono tiny">{r.cuenta}</span> {cuenta(r.cuenta).nombre}
                    </td>
                    <td className="num mono">{money2(r.debe)}</td>
                    <td className="num mono">{money2(r.haber)}</td>
                    <td className={`num mono ${r.saldo < 0 ? 'neg' : ''}`}>{money2(Math.abs(r.saldo))}{r.saldo < 0 ? ' (A)' : r.saldo > 0 ? ' (D)' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </MinigameShell>
  );
}

export function Machete() {
  return (
    <div className="card as-machete">
      <b>Plan de cuentas</b>
      <div className="table-wrap">
        <table className="tbl">
          <tbody>
            {PLAN.map((c) => (
              <tr key={c.codigo}>
                <td className="mono tiny">{c.codigo}</td>
                <td>{c.nombre}</td>
                <td className="tiny muted">{c.naturaleza === 'deudora' ? 'saldo deudor' : 'saldo acreedor'}{c.regularizadora ? ' · regularizadora' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted mt">Reglas de oro: lo devengado manda (no lo pagado); el IVA de un RI no es gasto ni ingreso; retenciones y percepciones sufridas son créditos; un anticipo recibido es un pasivo; pagar una deuda no es un gasto.</p>
    </div>
  );
}
