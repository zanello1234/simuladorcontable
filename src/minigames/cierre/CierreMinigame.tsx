// Minijuego: Cierre de ejercicio (ajustes, clasificación en rubros y estados contables).
import { useMemo, useState } from 'react';
import { money2 } from '../../engine/format';
import { MinigameResultView, MinigameShell } from '../MinigameShell';
import type { MinigameMeta, MinigameProps, MinigameResult } from '../types';
import { asientoVacio, balancea, clonar, type Asiento } from '../asientos/asiento';
import { AsientoView, ConstructorAsiento, sanear } from '../asientos/ConstructorAsiento';
import { Machete } from '../asientos/AsientosMinigame';
import { cuenta, RUBRO_LABEL, RUBROS_PATRIMONIALES, RUBROS_RESULTADO, RUBRO_SECCION, type RubroEECC } from '../asientos/planCuentas';
import { aplicarAjustes, estadosDesde, evaluarCierre, generarCasoCierre, opcionesReserva, opcionesResultado, resultadoDe, type Clasif, type Plazo } from './casoCierre';
import '../asientos/asientos.css';

export const CIERRE_META: MinigameMeta = {
  id: 'cierre',
  titulo: 'Cierre de ejercicio',
  descripcion: 'Ajustes de cierre, clasificación en rubros y armado de los estados contables para firmar.',
  horas: 4,
  icon: '📚',
};

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
const ETAPAS = ['Ajustes de cierre', 'Rubros', 'Estados contables'];

export function CierreMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoCierre(seed, client, task.periodo, indice), [seed, client, task.periodo, indice]);
  const [etapa, setEtapa] = useState(0);
  const [i, setI] = useState(0);
  const [modo, setModo] = useState<'opciones' | 'armar'>('opciones');
  const [elegida, setElegida] = useState<Record<string, number | undefined>>({});
  const [armados, setArmados] = useState<Record<string, Asiento | undefined>>({});
  const [borrador, setBorrador] = useState<Asiento>(asientoVacio());
  const [clasif, setClasif] = useState<Record<string, Clasif>>({});
  const [resOpt, setResOpt] = useState<number>();
  const [rlOpt, setRlOpt] = useState<number>();
  const [ayuda, setAyuda] = useState(false);
  const [resultado, setResultado] = useState<MinigameResult>();

  const aj = caso.ajustes[i];
  const respuestaDe = (id: string): Asiento | undefined => armados[id] ?? (elegida[id] !== undefined ? caso.ajustes.find((a) => a.id === id)!.opciones[elegida[id]!] : undefined);
  const ajustesResp = Object.fromEntries(caso.ajustes.map((a) => [a.id, respuestaDe(a.id)]));
  const hechos = caso.ajustes.filter((a) => respuestaDe(a.id) !== undefined).length;
  // saldos para clasificar: con los asientos del jugador (si falta alguno, con la solución)
  const saldos = useMemo(() => aplicarAjustes(caso.preCierre, Object.fromEntries(caso.ajustes.map((a) => [a.id, ajustesResp[a.id] ?? a.solucion]))), [caso, JSON.stringify(ajustesResp)]);
  const saldosCorrectos = useMemo(() => aplicarAjustes(caso.preCierre, Object.fromEntries(caso.ajustes.map((a) => [a.id, a.solucion]))), [caso]);
  const clasificados = saldos.filter((s) => clasif[s.cuenta]?.rubro && (RUBRO_SECCION[clasif[s.cuenta].rubro!] !== 'activo' && RUBRO_SECCION[clasif[s.cuenta].rubro!] !== 'pasivo' ? true : !!clasif[s.cuenta]?.plazo)).length;
  const res = resultadoDe(saldosCorrectos);
  const opcRes = useMemo(() => opcionesResultado(res, saldosCorrectos), [res, saldosCorrectos]);
  const opcRl = useMemo(() => opcionesReserva(res, saldosCorrectos), [res, saldosCorrectos]);
  const estados = useMemo(() => estadosDesde(saldosCorrectos, clasif), [saldosCorrectos, clasif]);

  const ir = (k: number) => {
    setI(k);
    setModo('opciones');
    setBorrador(armados[caso.ajustes[k].id] ? clonar(armados[caso.ajustes[k].id]!) : asientoVacio());
  };
  const firmar = () => setResultado(evaluarCierre(caso, { ajustes: ajustesResp, clasif, resultadoOpcion: resOpt, reservaOpcion: rlOpt }));

  if (resultado) {
    return (
      <MinigameShell icon={CIERRE_META.icon} titulo="Estados contables firmados" subtitulo={`${client.nombre} · ${caso.cierreLabel}`} onCancel={onCancel}>
        <div className={resultado.score < 0.95 ? 'anim-shake' : ''}>
          <MinigameResultView {...resultado} onContinue={() => onComplete(resultado)} />
        </div>
      </MinigameShell>
    );
  }

  const instrucciones = (
    <div className="as-help-row">
      <span>
        {etapa === 0 && 'Por cada situación de cierre, elegí el asiento correcto entre los propuestos o armalo vos.'}
        {etapa === 1 && 'Asigná cada cuenta a su rubro de los estados contables y, si es de activo o pasivo, si es corriente o no corriente.'}
        {etapa === 2 && 'Verificá la igualdad patrimonial, elegí el resultado del ejercicio y la reserva legal, y firmá.'}
      </span>
      <button className="btn sm ghost" onClick={() => setAyuda((a) => !a)} aria-expanded={ayuda}>
        📘 {ayuda ? 'Cerrar plan' : 'Plan de cuentas'}
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
        <button className="btn primary" disabled={hechos < caso.ajustes.length} onClick={() => setEtapa(1)}>
          {hechos < caso.ajustes.length ? `Faltan ${caso.ajustes.length - hechos} ajustes` : 'Siguiente: rubros →'}
        </button>
      )}
      {etapa === 1 && (
        <button className="btn primary" disabled={clasificados < saldos.length} onClick={() => setEtapa(2)}>
          {clasificados < saldos.length ? `Faltan ${saldos.length - clasificados} cuentas` : 'Siguiente: estados →'}
        </button>
      )}
      {etapa === 2 && (
        <button className="btn primary" disabled={resOpt === undefined || rlOpt === undefined} onClick={firmar} data-testid="ci-firmar">
          Firmar EECC ✓
        </button>
      )}
    </>
  );

  return (
    <MinigameShell icon={CIERRE_META.icon} titulo={CIERRE_META.titulo} subtitulo={`${client.nombre} · ${caso.cierreLabel}`} instrucciones={instrucciones} footer={footer} onCancel={onCancel}>
      {ayuda && <Machete />}
      <ol className="as-steps" aria-label="Etapas">
        {ETAPAS.map((e, k) => (
          <li key={e} className={k === etapa ? 'on' : k < etapa ? 'done' : ''}>
            <span>{k < etapa ? '✓' : k + 1}</span> {e}
          </li>
        ))}
      </ol>

      {etapa === 0 && aj && (
        <>
          <div className="as-nav" aria-label="Ajustes">
            {caso.ajustes.map((a, k) => (
              <button key={a.id} className={`${k === i ? 'on' : ''} ${respuestaDe(a.id) !== undefined ? 'done' : ''}`} onClick={() => ir(k)} title={a.titulo}>
                {k + 1}
              </button>
            ))}
          </div>
          <div className="as-op" data-ok={DEV ? String(aj.correcta) : undefined} data-aj={aj.id}>
            <div className="as-doc">
              <h4>{aj.titulo}</h4>
              <ul>
                {aj.datos.map((d, k) => (
                  <li key={k}>{d}</li>
                ))}
              </ul>
              <div className="as-actions">
                <button className={`btn sm ${modo === 'opciones' ? 'primary' : ''}`} onClick={() => setModo('opciones')}>
                  Elegir entre propuestas
                </button>
                <button className={`btn sm ${modo === 'armar' ? 'primary' : ''}`} onClick={() => setModo('armar')}>
                  ✍️ Armarlo yo
                </button>
              </div>
            </div>
            {modo === 'opciones' ? (
              <div className="as-opciones">
                {aj.opciones.map((o, k) => (
                  <button
                    key={k}
                    className={`as-opcion ${elegida[aj.id] === k && !armados[aj.id] ? 'on' : ''}`}
                    data-idx={k}
                    onClick={() => {
                      setElegida((e) => ({ ...e, [aj.id]: k }));
                      setArmados((a) => ({ ...a, [aj.id]: undefined }));
                    }}
                  >
                    <AsientoView a={o} titulo={`Propuesta ${k + 1}`} />
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <ConstructorAsiento value={borrador} onChange={setBorrador} chips={aj.chips} sugeridas={aj.sugeridas} />
                <div className="as-actions">
                  <button className="btn primary" disabled={!balancea(sanear(borrador))} onClick={() => setArmados((a) => ({ ...a, [aj.id]: sanear(borrador) }))}>
                    Grabar asiento
                  </button>
                  {armados[aj.id] && <span className="tiny pos">✓ Grabado</span>}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {etapa === 1 && (
        <div className="cl-list">
          <div className="small muted">Balance ajustado · {saldos.length} cuentas. Saldo (D) deudor / (A) acreedor.</div>
          {saldos.map((s) => {
            const c = cuenta(s.cuenta);
            const r = clasif[s.cuenta] ?? {};
            const sec = r.rubro ? RUBRO_SECCION[r.rubro] : undefined;
            const pidePlazo = sec === 'activo' || sec === 'pasivo';
            const ok = !!r.rubro && (!pidePlazo || !!r.plazo);
            return (
              <div key={s.cuenta} className={`cl-row ${ok ? 'ok' : ''}`} data-ok={DEV ? `${c.rubro}|${caso.plazos[s.cuenta] ?? 'na'}` : undefined} data-cuenta={s.cuenta}>
                <span>
                  <span className="mono tiny">{s.cuenta}</span> <b>{c.nombre}</b>
                  {caso.fichaPlazo[s.cuenta] && <div className="tiny muted">{caso.fichaPlazo[s.cuenta]}</div>}
                </span>
                <span className="mono num">
                  {money2(Math.abs(s.saldo))} {s.saldo < 0 ? '(A)' : '(D)'}
                </span>
                <select value={r.rubro ?? ''} onChange={(e) => setClasif((m) => ({ ...m, [s.cuenta]: { ...m[s.cuenta], rubro: (e.target.value || undefined) as RubroEECC | undefined } }))} aria-label={`Rubro de ${c.nombre}`}>
                  <option value="">— rubro —</option>
                  <optgroup label="Estado de situación patrimonial">
                    {RUBROS_PATRIMONIALES.map((k) => (
                      <option key={k} value={k}>
                        {RUBRO_LABEL[k]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Estado de resultados">
                    {RUBROS_RESULTADO.map((k) => (
                      <option key={k} value={k}>
                        {RUBRO_LABEL[k]}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {pidePlazo ? (
                  <select value={r.plazo ?? ''} onChange={(e) => setClasif((m) => ({ ...m, [s.cuenta]: { ...m[s.cuenta], plazo: (e.target.value || undefined) as Plazo | undefined } }))} aria-label={`Plazo de ${c.nombre}`}>
                    <option value="">— plazo —</option>
                    <option value="corriente">Corriente</option>
                    <option value="no_corriente">No corriente</option>
                  </select>
                ) : (
                  <span className="tiny muted">{sec ? 'sin plazo' : ''}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {etapa === 2 && (
        <div className="col">
          <div className="ee-grid">
            <div className="ee">
              <h4>Estado de situación patrimonial</h4>
              <div className="sub">
                {client.nombre} · {caso.cierreLabel} · en pesos
              </div>
              <div className="ee-row sec">
                <span>Activo corriente</span>
              </div>
              {estados.activoCorriente.map(([r, v]) => (
                <div key={r} className="ee-row ind">
                  <span>{RUBRO_LABEL[r as RubroEECC]}</span>
                  <span className="mono">{money2(v)}</span>
                </div>
              ))}
              <div className="ee-row sec">
                <span>Activo no corriente</span>
              </div>
              {estados.activoNoCorriente.map(([r, v]) => (
                <div key={r} className="ee-row ind">
                  <span>{RUBRO_LABEL[r as RubroEECC]}</span>
                  <span className="mono">{money2(v)}</span>
                </div>
              ))}
              <div className="ee-row tot">
                <span>Total del activo</span>
                <span className="mono">{money2(estados.totalActivo)}</span>
              </div>
              <div className="ee-row sec">
                <span>Pasivo corriente</span>
              </div>
              {estados.pasivoCorriente.map(([r, v]) => (
                <div key={r} className="ee-row ind">
                  <span>{RUBRO_LABEL[r as RubroEECC]}</span>
                  <span className="mono">{money2(v)}</span>
                </div>
              ))}
              <div className="ee-row sec">
                <span>Pasivo no corriente</span>
              </div>
              {estados.pasivoNoCorriente.map(([r, v]) => (
                <div key={r} className="ee-row ind">
                  <span>{RUBRO_LABEL[r as RubroEECC]}</span>
                  <span className="mono">{money2(v)}</span>
                </div>
              ))}
              <div className="ee-row tot">
                <span>Total del pasivo</span>
                <span className="mono">{money2(estados.totalPasivo)}</span>
              </div>
              <div className="ee-row sec">
                <span>Patrimonio neto</span>
              </div>
              {estados.pn.map(([r, v]) => (
                <div key={r} className={`ee-row ind ${v < 0 ? 'neg' : ''}`}>
                  <span>{r === 'resultado_ejercicio' ? 'Resultado del ejercicio' : RUBRO_LABEL[r as RubroEECC]}</span>
                  <span className="mono">{money2(v)}</span>
                </div>
              ))}
              <div className="ee-row tot">
                <span>Total del patrimonio neto</span>
                <span className="mono">{money2(estados.totalPN)}</span>
              </div>
              <div className={`ee-row tot ${Math.abs(estados.totalActivo - estados.totalPasivo - estados.totalPN) < 1 ? 'pos' : 'neg'}`}>
                <span>Pasivo + PN</span>
                <span className="mono">{money2(estados.totalPasivo + estados.totalPN)}</span>
              </div>
              {Math.abs(estados.totalActivo - estados.totalPasivo - estados.totalPN) >= 1 && <div className="as-alert">La igualdad patrimonial no cierra con tu clasificación: alguna cuenta está en la sección equivocada.</div>}
            </div>
            <div className="ee">
              <h4>Estado de resultados</h4>
              <div className="sub">{caso.cierreLabel} · en pesos</div>
              {[
                ['Ventas netas', estados.er.ventas],
                ['Costo de mercaderías vendidas', -estados.er.cmv],
                ['Resultado bruto', estados.er.bruto],
                ['Gastos de administración', -estados.er.admin],
                ['Gastos de comercialización', -estados.er.com],
                ['Resultados financieros y por tenencia (incl. RECPAM)', -estados.er.rfyt],
                ['Resultado antes del impuesto', estados.er.antesImp],
                ['Impuesto a las ganancias', -estados.er.imp],
              ].map(([l, v]) => (
                <div key={String(l)} className={`ee-row ${String(l).startsWith('Resultado') ? 'tot' : 'ind'} ${Number(v) < 0 ? 'neg' : ''}`}>
                  <span>{l}</span>
                  <span className="mono">{money2(Number(v))}</span>
                </div>
              ))}
              <div className="mt">
                <b className="small">¿Cuál es el resultado neto del ejercicio?</b>
                <div className="as-opciones mt">
                  {opcRes.map((o) => (
                    <button key={o.monto} className={`as-opcion ${resOpt === o.monto ? 'on' : ''}`} data-ok={DEV ? String(o.correcta) : undefined} onClick={() => setResOpt(o.monto)}>
                      <span className="mono">{money2(o.monto)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt">
                <b className="small">Reserva legal a constituir (LGS art. 70)</b>
                <div className="as-opciones mt">
                  {opcRl.map((o) => (
                    <button key={o.monto} className={`as-opcion ${rlOpt === o.monto ? 'on' : ''}`} data-ok={DEV ? String(o.correcta) : undefined} onClick={() => setRlOpt(o.monto)}>
                      <span className="mono">{money2(o.monto)}</span> <span className="tiny muted">{o.detalle}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </MinigameShell>
  );
}
