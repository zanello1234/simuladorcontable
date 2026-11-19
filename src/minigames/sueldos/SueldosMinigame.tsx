// Minijuego: liquidación de sueldos (recibo de haberes, CCT 130/75 simplificado).
import { useEffect, useMemo, useRef, useState } from 'react';
import { MinigameShell, MinigameResultView } from '../MinigameShell';
import type { MinigameMeta, MinigameProps } from '../types';
import { money2 } from '../../engine/format';
import {
  CONCEPTOS,
  CONCEPTO_LABEL,
  completo,
  evaluarSueldos,
  generarCasoSueldos,
  opcionesPara,
  reciboDesde,
  type ConceptoKey,
  type EmpleadoCaso,
  type EvaluacionSueldos,
  type Opcion,
  type Respuestas,
} from './caso';
import './sueldos.css';

export const SUELDOS_META: MinigameMeta = {
  id: 'sueldos',
  titulo: 'Liquidación de sueldos',
  descripcion: 'Armá los recibos de haberes: antigüedad, horas extra, presentismo y aportes. El neto tiene que cerrar.',
  horas: 2,
  icon: '🧾',
};

const PREGUNTA: Record<ConceptoKey, (e: EmpleadoCaso) => string> = {
  antiguedad: (e) => `¿Cuánto le corresponde a ${nom(e)} por antigüedad?`,
  horasExtra: (e) => `¿Cuánto cobra ${nom(e)} por horas extra?`,
  presentismo: (e) => `¿Corresponde el presentismo de ${nom(e)}? ¿Por cuánto?`,
  base: () => '¿Sobre qué importe calculás los aportes?',
  aportes: () => '¿Qué aportes le descontás del recibo?',
};

const PISTA: Record<ConceptoKey, string> = {
  antiguedad: 'CCT 130/75: 1% del básico de convenio por cada año de antigüedad.',
  horasExtra: 'Valor hora = (básico + antigüedad) / 200. En días hábiles se pagan con un recargo del 50% (LCT).',
  presentismo: 'Adicional por asistencia y puntualidad: 1/12 de (básico + antigüedad). Se pierde con ausencias injustificadas.',
  base: 'Los aportes se calculan sobre la remuneración bruta remunerativa (todos los conceptos remunerativos del mes).',
  aportes: 'Aportes del trabajador: jubilación 11% (SIPA), Ley 19.032 3% (PAMI), obra social 3% y cuota sindical (2% en el juego).',
};

const nom = (e: EmpleadoCaso) => e.nombre.split(' ')[0];

export function SueldosMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoSueldos(seed, client, task, indice), [seed, client, task, indice]);
  const [resp, setResp] = useState<Respuestas[]>(() => caso.empleados.map(() => ({})));
  const [emp, setEmp] = useState(0);
  const [fase, setFase] = useState<'liquidar' | 'confirmar' | 'resultado'>('liquidar');
  const [res, setRes] = useState<EvaluacionSueldos | null>(null);
  const [pista, setPista] = useState(false);
  const [recien, setRecien] = useState<ConceptoKey | null>(null);

  const ancla = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ancla.current?.closest('.mg-body')?.scrollTo({ top: 0 });
  }, [fase, emp]);

  const e = caso.empleados[emp];
  const r = resp[emp];
  const pendiente = CONCEPTOS.find((k) => !r[k]);
  const opciones = useMemo(() => (pendiente ? opcionesPara(e, pendiente, r, seed) : []), [e, pendiente, r, seed]);
  const todosCompletos = resp.every(completo);

  const elegir = (o: Opcion) => {
    if (!pendiente) return;
    const nuevo = [...resp];
    nuevo[emp] = { ...r, [pendiente]: o };
    setResp(nuevo);
    setRecien(pendiente);
    setPista(false);
  };

  /** volver a responder un concepto: borra ese y los siguientes (dependen de él) */
  const corregir = (i: number, k: ConceptoKey) => {
    const idx = CONCEPTOS.indexOf(k);
    const nuevo = [...resp];
    const copia: Respuestas = {};
    CONCEPTOS.slice(0, idx).forEach((c) => {
      if (resp[i][c]) copia[c] = resp[i][c];
    });
    nuevo[i] = copia;
    setResp(nuevo);
    setEmp(i);
    setFase('liquidar');
    setRecien(null);
  };

  const confirmar = () => {
    setRes(evaluarSueldos(caso, resp));
    setFase('resultado');
  };

  if (fase === 'resultado' && res) {
    return (
      <MinigameShell
        icon="🧾"
        titulo="Liquidación de sueldos"
        subtitulo={`${caso.empresa} · ${caso.periodoLabel}`}
        onCancel={onCancel}
        footer={
          <button className="btn primary" onClick={() => onComplete({ score: res.score, resumen: res.resumen, errores: res.errores })}>
            Continuar
          </button>
        }
      >
        <span ref={ancla} />
        <MinigameResultView
          score={res.score}
          resumen={res.resumen}
          errores={res.errores}
          onContinue={() => onComplete({ score: res.score, resumen: res.resumen, errores: res.errores })}
        />
      </MinigameShell>
    );
  }

  const footer =
    fase === 'confirmar' ? (
      <>
        <span className="muted small sl-foot-txt">Tocá una línea de cualquier recibo para corregirla.</span>
        <button className="btn" onClick={() => setFase('liquidar')}>
          ← Volver
        </button>
        <button className="btn primary" onClick={confirmar}>
          Confirmar netos y enviar recibos
        </button>
      </>
    ) : (
      <>
        <span className="muted small sl-foot-txt">
          Empleado {emp + 1} de {caso.empleados.length}
        </span>
        <button className="btn" disabled={emp === 0} onClick={() => setEmp(emp - 1)}>
          ← Anterior
        </button>
        {emp < caso.empleados.length - 1 ? (
          <button className={`btn ${completo(r) ? 'primary' : ''}`} onClick={() => setEmp(emp + 1)}>
            Siguiente →
          </button>
        ) : (
          <button className="btn primary" disabled={!todosCompletos} onClick={() => setFase('confirmar')}>
            Revisar netos →
          </button>
        )}
      </>
    );

  return (
    <MinigameShell
      icon="🧾"
      titulo="Liquidación de sueldos"
      subtitulo={`${caso.empresa} · período ${caso.periodoLabel}`}
      instrucciones={
        <>
          Armá el recibo de cada empleado eligiendo el importe correcto de cada concepto (o <b>No corresponde</b>). Al final confirmás los netos.
          {caso.restantes > 0 && <> El resto de la nómina ({caso.restantes}) lo liquida el sistema.</>}
          {caso.esMesSAC && <> El SAC del semestre se liquida en un recibo aparte.</>}
        </>
      }
      footer={footer}
      onCancel={onCancel}
    >
      <div className="sl">
        <span ref={ancla} />
        <nav className="sl-tabs" aria-label="Empleados">
          {caso.empleados.map((x, i) => {
            const n = CONCEPTOS.filter((k) => resp[i][k]).length;
            return (
              <button
                key={x.legajo}
                className={`sl-tab ${i === emp && fase === 'liquidar' ? 'on' : ''} ${completo(resp[i]) ? 'done' : ''}`}
                onClick={() => {
                  setEmp(i);
                  setFase('liquidar');
                }}
              >
                <span className="sl-tab-n">{completo(resp[i]) ? '✓' : i + 1}</span>
                <span className="sl-tab-name">{x.nombre}</span>
                <span className="sl-tab-prog">
                  {n}/{CONCEPTOS.length}
                </span>
              </button>
            );
          })}
        </nav>

        {fase === 'confirmar' ? (
          <div className="sl-confirm anim-up">
            <div className="table-wrap">
              <table className="tbl sl-conf-tbl">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th className="num">Remunerativo</th>
                    <th className="num">Aportes</th>
                    <th className="num">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {caso.empleados.map((x, i) => {
                    const rc = reciboDesde(x, resp[i]);
                    return (
                      <tr key={x.legajo}>
                        <td>{x.nombre}</td>
                        <td className="num mono">{money2(rc.remunerativo)}</td>
                        <td className="num mono">{money2(rc.totalAportes)}</td>
                        <td className="num mono">
                          <b>{money2(rc.neto)}</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="sl-recibos">
              {caso.empleados.map((x, i) => (
                <Recibo key={x.legajo} e={x} r={resp[i]} empresa={caso.empresa} cuit={caso.cuit} periodo={caso.periodoLabel} onCorregir={(k) => corregir(i, k)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="sl-grid">
            <section className="sl-left">
              <div className="card sl-nov">
                <div className="sl-nov-head">
                  <span className="sl-nov-tit">Novedades del mes</span>
                  <b>{e.nombre}</b>
                  <span className="muted small">
                    Leg. {e.legajo} · {e.categoria} · ingreso {e.ingreso}
                  </span>
                </div>
                <div className="sl-stats">
                  <div className="sl-stat">
                    <span>Básico de convenio</span>
                    <b className="mono">{money2(e.basico)}</b>
                  </div>
                  <div className="sl-stat">
                    <span>Antigüedad</span>
                    <b>{e.anios === 0 ? 'menos de 1 año' : `${e.anios} año${e.anios > 1 ? 's' : ''}`}</b>
                  </div>
                  <div className={`sl-stat ${e.ausencias ? 'bad' : 'ok'}`}>
                    <span>Ausencias injustificadas</span>
                    <b>{e.ausencias === 0 ? 'Ninguna' : `${e.ausencias} día${e.ausencias > 1 ? 's' : ''}`}</b>
                  </div>
                  <div className={`sl-stat ${e.horasExtra ? 'info' : ''}`}>
                    <span>Horas extra (días hábiles)</span>
                    <b>{e.horasExtra} hs</b>
                  </div>
                </div>
              </div>

              <div className="card sl-q" key={`${emp}-${pendiente ?? 'fin'}`}>
                {pendiente ? (
                  <div className="anim-up">
                    <div className="sl-q-step">
                      Paso {CONCEPTOS.indexOf(pendiente) + 1} de {CONCEPTOS.length} · {CONCEPTO_LABEL[pendiente]}
                    </div>
                    <h3>{PREGUNTA[pendiente](e)}</h3>
                    <div className={`sl-opts ${pendiente === 'aportes' ? 'wide' : ''}`}>
                      {opciones.map((o) => (
                        <button key={o.id} className={`sl-opt ${o.monto === null ? 'nc' : ''}`} onClick={() => elegir(o)}>
                          {pendiente === 'aportes' ? (
                            <>
                              <span className="sl-opt-detail">{o.label}</span>
                              <span className="mono sl-opt-amt">{money2(o.monto ?? 0)}</span>
                            </>
                          ) : (
                            <span className={o.monto === null ? '' : 'mono sl-opt-amt'}>{o.label}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button className="btn ghost sm sl-pista-btn" onClick={() => setPista(!pista)}>
                      💡 {pista ? 'Ocultar pista' : 'Ver pista'}
                    </button>
                    {pista && <p className="sl-pista anim-up">{PISTA[pendiente]}</p>}
                  </div>
                ) : (
                  <div className="sl-done anim-pop">
                    <div className="sl-done-ico">✅</div>
                    <h3>Recibo de {nom(e)} listo</h3>
                    <p className="muted small">Neto a cobrar: <b className="mono">{money2(reciboDesde(e, r).neto)}</b></p>
                    {emp < caso.empleados.length - 1 ? (
                      <button className="btn primary" onClick={() => setEmp(emp + 1)}>
                        Siguiente empleado →
                      </button>
                    ) : todosCompletos ? (
                      <button className="btn primary" onClick={() => setFase('confirmar')}>
                        Revisar netos →
                      </button>
                    ) : (
                      <button className="btn" onClick={() => setEmp(resp.findIndex((x) => !completo(x)))}>
                        Falta completar otro recibo →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            <Recibo e={e} r={r} empresa={caso.empresa} cuit={caso.cuit} periodo={caso.periodoLabel} actual={pendiente} recien={recien} onCorregir={(k) => corregir(emp, k)} />
          </div>
        )}
      </div>
    </MinigameShell>
  );
}

// ----------------------------------------------------------------------------- Recibo visual

interface ReciboProps {
  e: EmpleadoCaso;
  r: Respuestas;
  empresa: string;
  cuit: string;
  periodo: string;
  actual?: ConceptoKey;
  recien?: ConceptoKey | null;
  onCorregir: (k: ConceptoKey) => void;
}

function Recibo({ e, r, empresa, cuit, periodo, actual, recien, onCorregir }: ReciboProps) {
  const rc = reciboDesde(e, r);
  const fila = (k: ConceptoKey, concepto: string, unidades: string, monto: number | null | undefined) => {
    const resp = r[k];
    const cls = `sl-line ${actual === k ? 'cur' : ''} ${recien === k ? 'new' : ''} ${resp ? 'ok' : 'pend'}`;
    return (
      <tr key={k} className={cls} onClick={resp ? () => onCorregir(k) : undefined} title={resp ? 'Tocá para corregir' : undefined}>
        <td>{concepto}</td>
        <td className="num">{resp ? unidades : ''}</td>
        <td className="num mono">{resp ? (monto === null || monto === undefined ? <span className="muted">—</span> : money2(monto)) : <span className="sl-dots">· · ·</span>}</td>
        <td className="num mono" />
      </tr>
    );
  };
  return (
    <section className="sl-recibo" aria-label={`Recibo de ${e.nombre}`}>
      <div className="sl-paper">
        <header className="sl-paper-head">
          <div>
            <div className="sl-paper-title">RECIBO DE HABERES</div>
            <div className="tiny">
              {empresa} · CUIT {cuit}
            </div>
          </div>
          <div className="tiny sl-paper-per">
            Período
            <br />
            <b>{periodo}</b>
          </div>
        </header>
        <div className="sl-paper-emp tiny">
          <span>
            <b>{e.nombre}</b>
          </span>
          <span>CUIL {e.cuil}</span>
          <span>Leg. {e.legajo}</span>
          <span>{e.categoria}</span>
        </div>
        <table className="sl-paper-tbl">
          <thead>
            <tr>
              <th>Concepto</th>
              <th className="num">Unid.</th>
              <th className="num">Haberes</th>
              <th className="num">Deducciones</th>
            </tr>
          </thead>
          <tbody>
            <tr className="sl-line ok fixed">
              <td>Sueldo básico</td>
              <td className="num">30 d</td>
              <td className="num mono">{money2(e.basico)}</td>
              <td />
            </tr>
            {fila('antiguedad', 'Antigüedad', `${e.anios} a`, r.antiguedad?.monto)}
            {fila('horasExtra', 'Horas extra 50%', `${e.horasExtra} hs`, r.horasExtra?.monto)}
            {fila('presentismo', 'Presentismo', '', r.presentismo?.monto)}
            <tr className={`sl-line sl-sub ${actual === 'base' ? 'cur' : ''} ${recien === 'base' ? 'new' : ''} ${r.base ? 'ok' : 'pend'}`} onClick={r.base ? () => onCorregir('base') : undefined}>
              <td>Base de aportes</td>
              <td />
              <td className="num mono">{r.base ? money2(r.base.monto ?? 0) : <span className="sl-dots">· · ·</span>}</td>
              <td />
            </tr>
            {r.aportes ? (
              r.aportes.lineas!.map((l) => (
                <tr key={l.concepto} className={`sl-line ok ded ${recien === 'aportes' ? 'new' : ''}`} onClick={() => onCorregir('aportes')}>
                  <td>{l.concepto}</td>
                  <td className="num">{(l.tasa * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%</td>
                  <td />
                  <td className="num mono">{money2(l.monto)}</td>
                </tr>
              ))
            ) : (
              <tr className={`sl-line pend ${actual === 'aportes' ? 'cur' : ''}`}>
                <td>Aportes</td>
                <td />
                <td />
                <td className="num">
                  <span className="sl-dots">· · ·</span>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Totales</td>
              <td />
              <td className="num mono">{money2(rc.remunerativo)}</td>
              <td className="num mono">{money2(rc.totalAportes)}</td>
            </tr>
          </tfoot>
        </table>
        <div className={`sl-neto ${CONCEPTOS.every((k) => r[k]) ? 'final' : ''}`}>
          <span>NETO A COBRAR</span>
          <b className="mono">{money2(rc.neto)}</b>
        </div>
        <div className="sl-firma tiny muted">Recibí conforme el importe neto de la presente liquidación · Firma del empleado</div>
      </div>
    </section>
  );
}
