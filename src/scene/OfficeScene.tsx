// Escena animada de la oficina (corte lateral tipo "casa de muñecas").
// Componente puro: todo se deriva de `state`.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameState, Worker } from '../engine/types';
import { MS_POR_HORA, OFICINAS } from '../engine/config';
import { diffDays } from '../engine/calendar';
import { SeatedWorker, SeatedInspector, type ScreenMode } from './Character';
import { FxLayer } from './Fx';
import { BASE_H, BASE_W, headPos, layoutFor, type DeskSlot } from './layout';
import { BackProps, FrontProps, screenForTools } from './Props';
import { AmbientLight, Backdrop } from './Rooms';
import './scene.css';

export interface OfficeSceneProps {
  state: GameState;
  onWorkerClick?: (id: string) => void;
  onDoorClick?: () => void;
  onCalendarClick?: () => void;
}

/** ancho mínimo de viewBox antes de pasar a modo "paneo" (scroll horizontal) */
const MIN_VB = 1140;

function screenFor(w: Worker, s: GameState, working: ScreenMode): ScreenMode {
  if (s.flags.corteLuz) return 'off';
  if (w.status === 'agotado') return 'sleep';
  if (s.flags.arcaCaida) return 'arca';
  if (w.status === 'minijuego') return 'mini';
  if (w.status === 'trabajando') return working;
  if (w.status === 'esperando') return 'wait';
  return 'idle';
}

export function OfficeScene({ state, onWorkerClick, onDoorClick, onCalendarClick }: OfficeSceneProps) {
  const level = Math.max(0, Math.min(OFICINAS.length - 1, state.estudio.oficina | 0));
  const L = layoutFor(level);

  // ---------------------------------------------------------------- tamaño / encuadre responsivo
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let vbX = 0;
  let vbW = BASE_W;
  let mode: 'auto' | 'fill' | 'scroll' = 'auto';
  let svgW = 0;
  if (box.w > 60 && box.h > 60) {
    const want = (BASE_H * box.w) / box.h;
    if (want >= MIN_VB) {
      mode = 'fill';
      vbW = want;
      vbX = (BASE_W - want) / 2;
    } else {
      mode = 'scroll';
      vbW = MIN_VB;
      vbX = (BASE_W - MIN_VB) / 2;
      svgW = (box.h * MIN_VB) / BASE_H;
    }
  }

  const centered = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (mode === 'scroll' && el && !centered.current) {
      el.scrollLeft = Math.max(0, (svgW - box.w) / 2);
      centered.current = true;
    }
    if (mode !== 'scroll') centered.current = false;
  }, [mode, svgW, box.w]);

  const [hint, setHint] = useState(true);
  useEffect(() => {
    if (mode !== 'scroll') return;
    const t = setTimeout(() => setHint(false), 4500);
    return () => clearTimeout(t);
  }, [mode]);

  // ---------------------------------------------------------------- interacción
  const [hover, setHover] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleWorkerClick = useCallback(
    (id: string) => {
      setHover(id);
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setHover((h) => (h === id ? null : h)), 2600);
      onWorkerClick?.(id);
    },
    [onWorkerClick],
  );
  const handleHover = useCallback((id: string | null) => {
    clearTimeout(hoverTimer.current);
    setHover(id);
  }, []);

  const [doorOpen, setDoorOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const onShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 550);
  }, []);

  // ---------------------------------------------------------------- derivados
  const urgent = useMemo(() => state.tasks.filter((t) => t.estado === 'pendiente' && diffDays(t.vence, state.date) <= 3).length, [state.tasks, state.date]);
  const inspector = useMemo(
    () => state.events.some((e) => e.defId === 'inspeccion') || state.tasks.some((t) => t.kind === 'requerimiento' && t.estado === 'pendiente'),
    [state.events, state.tasks],
  );

  const placed = useMemo(() => {
    const out: { w: Worker; slot: DeskSlot }[] = [];
    const used = new Set<number>();
    for (const w of state.workers) {
      let idx = w.deskIndex;
      if (idx < 0 || idx >= L.slots.length || used.has(idx)) {
        idx = L.slots.findIndex((_, i) => !used.has(i));
        if (idx < 0) continue; // sin lugar: no se dibuja
      }
      used.add(idx);
      out.push({ w, slot: L.slots[idx] });
    }
    return out;
  }, [state.workers, L]);

  const workerHead = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const { w, slot } of placed) m[w.id] = headPos(slot);
    return m;
  }, [placed]);

  const working = screenForTools(state.tools);
  const msPerHour = state.speed === 0 ? MS_POR_HORA[1] : MS_POR_HORA[state.speed];
  const paused = state.speed === 0;
  const token = state.tools.includes('firma_digital');

  const renderWorker = ({ w, slot }: { w: Worker; slot: DeskSlot }) => (
    <SeatedWorker
      key={w.id}
      id={w.id}
      nombre={w.nombre}
      avatar={w.avatar}
      status={w.status}
      estres={w.estres}
      moral={w.moral}
      papers={w.queue.length}
      isPlayer={w.id === 'player'}
      x={slot.x}
      y={slot.y}
      s={slot.s}
      deskStyle={L.deskStyle}
      screen={screenFor(w, state, working)}
      token={token && w.id === 'player'}
      dark={state.flags.corteLuz}
      onClick={handleWorkerClick}
      onHover={handleHover}
    />
  );

  const back = placed.filter((p) => p.slot.row === 'back');
  const front = placed.filter((p) => p.slot.row === 'front');
  const hovered = hover ? placed.find((p) => p.w.id === hover) : undefined;
  const playerSlot = placed.find((p) => p.w.id === 'player')?.slot;

  const svg = (
    <svg
      className="office-svg"
      viewBox={`${vbX} 0 ${vbW} ${BASE_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={mode === 'scroll' ? { width: svgW, height: '100%' } : mode === 'fill' ? { width: '100%', height: '100%' } : { width: '100%', height: 'auto' }}
      role="img"
      aria-label={`Oficina: ${OFICINAS[level].nombre}`}
    >
      <g className="ambient">
        <Backdrop
          level={level}
          L={L}
          hour={state.hour}
          tick={state.tick}
          msPerHour={msPerHour}
          paused={paused}
          date={state.date}
          urgent={urgent}
          doorOpen={doorOpen}
          estudio={state.estudio.nombre}
          arcaCaida={state.flags.arcaCaida}
          onDoorClick={onDoorClick}
          onCalendarClick={onCalendarClick}
        />
        <BackProps tools={state.tools} L={L} />
        {back.map(renderWorker)}
        {inspector && (
          <g transform={`translate(${L.waiting.x},${L.waiting.y}) scale(${L.waiting.s})`}>
            <SeatedInspector />
          </g>
        )}
        {front.map(renderWorker)}
        <FrontProps tools={state.tools} L={L} />
        <AmbientLight hour={state.hour} vbX={vbX} vbW={vbW} />
        {state.flags.corteLuz && <Blackout vbX={vbX} vbW={vbW} at={playerSlot ? { x: playerSlot.x + 40, y: playerSlot.y - 20 } : { x: 600, y: 360 }} />}
        {state.flags.prorroga && (
          <g transform={`translate(${L.calendar.x - 6},${L.calendar.y + 62})`}>
            <rect x={0} y={0} width={64} height={14} rx={3} fill="#1f8a70" />
            <text x={32} y={10} textAnchor="middle" fontSize={8.4} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
              PRÓRROGA
            </text>
          </g>
        )}
      </g>
      <FxLayer fx={state.fx} L={L} workerHead={workerHead} clients={state.clients} vbX={vbX} vbW={vbW} onDoor={setDoorOpen} onShake={onShake} />
      {hovered && <Bubble w={hovered.w} slot={hovered.slot} vbX={vbX} vbW={vbW} />}
    </svg>
  );

  return (
    <div ref={outerRef} className={`office-scene lvl-${level}${paused ? ' paused' : ''}${shake ? ' shake' : ''}`}>
      <div ref={scrollRef} className={mode === 'scroll' ? 'office-scroll scroll' : 'office-scroll'}>
        {svg}
      </div>
      {mode === 'scroll' && hint && <div className="office-hint">⟷ Deslizá para recorrer la oficina</div>}
    </div>
  );
}

function Bubble({ w, slot, vbX, vbW }: { w: Worker; slot: DeskSlot; vbX: number; vbW: number }) {
  const hp = headPos(slot);
  const title = w.id === 'player' ? `${w.nombre} (Titular)` : w.nombre;
  const text = w.statusText || '—';
  const t = text.length > 46 ? `${text.slice(0, 45)}…` : text;
  const width = Math.max(title.length * 7.4, t.length * 6.3) + 24;
  const x = Math.min(vbX + vbW - width / 2 - 8, Math.max(vbX + width / 2 + 8, hp.x));
  const y = Math.max(46, hp.y - 30 * slot.s - 24);
  return (
    <g className="bubble-tip" transform={`translate(${x},${y})`} pointerEvents="none">
      <rect x={-width / 2 + 2} y={-34 + 3} width={width} height={42} rx={10} fill="#000" opacity={0.18} />
      <rect x={-width / 2} y={-34} width={width} height={42} rx={10} fill="#fffdf7" stroke="#1d2b3a" strokeWidth={1.6} />
      <path d={`M${hp.x - x - 7} 7.5 L${hp.x - x} 17 L${hp.x - x + 7} 7.5 Z`} fill="#fffdf7" stroke="#1d2b3a" strokeWidth={1.6} strokeLinejoin="round" />
      <rect x={hp.x - x - 6} y={5} width={12} height={4} fill="#fffdf7" />
      <text x={0} y={-17} textAnchor="middle" fontSize={12} fontWeight={900} fill="#1d2b3a" fontFamily="system-ui, sans-serif">
        {title}
      </text>
      <text x={0} y={0} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4c5866" fontFamily="system-ui, sans-serif">
        {t}
      </text>
    </g>
  );
}

function Blackout({ vbX, vbW, at }: { vbX: number; vbW: number; at: { x: number; y: number } }) {
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="blackoutGrad" gradientUnits="userSpaceOnUse" cx={at.x} cy={at.y} r={300}>
          <stop offset="0" stopColor="#ffb347" stopOpacity={0.12} />
          <stop offset="0.18" stopColor="#0a0d1e" stopOpacity={0.45} />
          <stop offset="1" stopColor="#05070f" stopOpacity={0.86} />
        </radialGradient>
      </defs>
      <rect x={vbX - 10} y={0} width={vbW + 20} height={BASE_H} fill="url(#blackoutGrad)" />
      <g transform={`translate(${at.x},${at.y})`}>
        <rect x={-4} y={-6} width={8} height={18} rx={1.5} fill="#f4efe1" />
        <ellipse cx={0} cy={12} rx={8} ry={2.4} fill="#c9a24a" />
        <g className="flame">
          <ellipse cx={0} cy={-12} rx={3.4} ry={6.4} fill="#ffb347" />
          <ellipse cx={0} cy={-11} rx={1.6} ry={3.4} fill="#fff4c9" />
        </g>
      </g>
      <text x={vbX + vbW / 2} y={70} textAnchor="middle" fontSize={16} fontWeight={900} fill="#ffd27a" fontFamily="system-ui, sans-serif" letterSpacing={1}>
        CORTE DE LUZ
      </text>
    </g>
  );
}
