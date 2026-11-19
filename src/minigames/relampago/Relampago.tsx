// ⚡ Despachar la pila: 45 segundos de clasificar comprobantes. Combos, timer y feedback instantáneo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../audio/audio';
import { makeRng } from '../../engine/rng';
import { MinigameShell } from '../MinigameShell';
import type { RelampagoProps, RelampagoResult } from '../types';
import { generarPila, RESPUESTAS, type Caso, type Respuesta } from './casos';
import './relampago.css';

const DURACION = 45;

export function Relampago({ seed, onComplete, onCancel }: RelampagoProps) {
  const pila = useMemo(() => generarPila(makeRng(seed), 60), [seed]);
  const [i, setI] = useState(0);
  const [fase, setFase] = useState<'intro' | 'jugando' | 'fin'>('intro');
  const [t, setT] = useState(DURACION);
  const [aciertos, setAciertos] = useState(0);
  const [errores, setErrores] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboMax, setComboMax] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; texto: string } | null>(null);
  const [saliendo, setSaliendo] = useState<'ok' | 'bad' | null>(null);
  const timer = useRef<number | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (fase !== 'jugando') return;
    const ini = Date.now();
    timer.current = window.setInterval(() => {
      const rest = DURACION - (Date.now() - ini) / 1000;
      if (rest <= 0) {
        setT(0);
        setFase('fin');
        if (timer.current) window.clearInterval(timer.current);
      } else setT(rest);
    }, 100);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [fase]);

  const caso: Caso | undefined = pila[i];

  const responder = useCallback(
    (r: Respuesta) => {
      if (fase !== 'jugando' || !caso || lock.current) return;
      lock.current = true;
      const ok = r === caso.respuesta;
      if (ok) {
        setAciertos((a) => a + 1);
        setCombo((c) => {
          const n = c + 1;
          setComboMax((m) => Math.max(m, n));
          return n;
        });
        audio.sfx(combo >= 4 ? 'corregido' : 'blip');
        setFlash({ ok: true, texto: combo + 1 >= 5 ? `¡Combo ×${combo + 1}!` : '✓' });
      } else {
        setErrores((e) => e + 1);
        setCombo(0);
        audio.sfx('fallo');
        setFlash({ ok: false, texto: caso.porque });
      }
      setSaliendo(ok ? 'ok' : 'bad');
      window.setTimeout(
        () => {
          setSaliendo(null);
          setI((k) => k + 1);
          lock.current = false;
          if (ok) setFlash(null);
        },
        ok ? 160 : 900,
      );
    },
    [fase, caso, combo],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const r = RESPUESTAS.find((x) => x.key === e.key);
      if (r) responder(r.id);
      if (e.key === 'Enter' && fase === 'intro') setFase('jugando');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [responder, fase]);

  useEffect(() => {
    if (fase === 'fin') audio.sfx(aciertos >= 20 ? 'exito' : 'notificacion');
  }, [fase, aciertos]);

  const resultado: RelampagoResult = { aciertos, errores, comboMax, score: aciertos + errores ? aciertos / (aciertos + errores) : 0 };
  const pct = (t / DURACION) * 100;

  return (
    <MinigameShell icon="⚡" titulo="Despachar la pila" subtitulo="45 segundos. ¿Débito, crédito o no computa?" onCancel={onCancel}>
      {fase === 'intro' && (
        <div className="rl-intro anim-pop">
          <p>
            Llegó una pila de comprobantes y hay que clasificarlos <b>ya</b>. Por cada uno decidí si genera <b>débito fiscal</b>, <b>crédito fiscal</b> o <b>no computa</b>.
          </p>
          <ul className="small">
            <li>Cada acierto adelanta media hora de carga en tus tareas más urgentes y baja tu estrés.</li>
            <li>Los errores cuestan tiempo (te muestran el porqué) y suman estrés.</li>
            <li>Encadená aciertos para hacer combo. Teclas 1 · 2 · 3.</li>
          </ul>
          <button className="btn primary" onClick={() => setFase('jugando')}>
            ¡Dale! (Enter)
          </button>
        </div>
      )}
      {fase === 'jugando' && caso && (
        <div className="rl-game">
          <div className="rl-top">
            <div className={`rl-timer ${t < 10 ? 'urgente' : ''}`}>
              <i style={{ width: `${pct}%` }} />
              <span className="mono">{Math.ceil(t)}s</span>
            </div>
            <div className="rl-score">
              <span className="pos">✓ {aciertos}</span>
              <span className="neg">✗ {errores}</span>
              {combo >= 3 && <span className="rl-combo anim-pop">🔥 ×{combo}</span>}
            </div>
          </div>
          <div className="rl-stack">
            {pila[i + 2] && <div className="rl-card back2" />}
            {pila[i + 1] && <div className="rl-card back1" />}
            <div key={i} className={`rl-card front ${saliendo ? `out-${saliendo}` : 'in'}`}>
              <div className="rl-card-head">
                <span className={`chip ${caso.dir === 'Emitida' ? 'info' : 'accent'}`}>{caso.dir}</span>
                <b>{caso.tipo}</b>
              </div>
              <div className="rl-quien">{caso.quien}</div>
              <div className="rl-concepto">{caso.concepto}</div>
            </div>
            {flash && (
              <div key={`${i}-f`} className={`rl-flash ${flash.ok ? 'ok' : 'bad'} anim-pop`}>
                {flash.texto}
              </div>
            )}
          </div>
          <div className="rl-btns">
            {RESPUESTAS.map((r) => (
              <button key={r.id} className={`btn rl-btn ${r.id}`} onClick={() => responder(r.id)}>
                <small>{r.key}</small>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {fase === 'fin' && (
        <div className="rl-fin anim-pop">
          <div className="rl-big">{aciertos}</div>
          <h3>{aciertos >= 35 ? '¡Rayo contable! 🌩️' : aciertos >= 20 ? '¡Despachador/a serial! ⚡' : aciertos >= 10 ? 'Buen ritmo 👍' : 'Calentando motores 🧉'}</h3>
          <p className="small muted">
            {aciertos} aciertos · {errores} errores · mejor combo ×{comboMax}
          </p>
          <p className="small">Cada acierto adelanta media hora de carga en las tareas más urgentes.</p>
          <button className="btn primary" onClick={() => onComplete(resultado)}>
            Volver al estudio
          </button>
        </div>
      )}
    </MinigameShell>
  );
}
