// Capa de efectos: popups, avioncitos de papel, monedas, visitantes, confetti.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Avatar, Client, FxEvent } from '../engine/types';
import { moneyShort } from '../engine/format';
import { INSPECTOR_AVATAR, StandingPerson } from './Character';
import type { LevelLayout } from './layout';

const SANS = 'system-ui, -apple-system, Segoe UI, sans-serif';

type Pt = { x: number; y: number };

/** Keyframes de piernas: balanceo solo en los tramos en que el visitante camina. */
function swing(name: string, ranges: [number, number][], amp: number): string {
  const f: string[] = ['0%{transform:rotate(0deg)}'];
  for (const [a, b] of ranges) {
    f.push(`${a}%{transform:rotate(0deg)}`);
    let k = 0;
    for (let x = a + 3; x < b - 0.5; x += 3) f.push(`${x.toFixed(1)}%{transform:rotate(${k++ % 2 ? -amp : amp}deg)}`);
    f.push(`${b}%{transform:rotate(0deg)}`);
  }
  f.push('100%{transform:rotate(0deg)}');
  return `@keyframes ${name}{${f.join('')}}`;
}
const CLI: [number, number][] = [
  [6, 30],
  [69, 93],
];
const INS: [number, number][] = [[10, 60]];
const WALK_CSS = [
  swing('pdWalkCliL', CLI, 16),
  swing('pdWalkCliR', CLI, -16),
  swing('pdWalkInsL', INS, 16),
  swing('pdWalkInsR', INS, -16),
  '.walk-cli .leg-l{animation:pdWalkCliL 5200ms linear forwards}',
  '.walk-cli .leg-r{animation:pdWalkCliR 5200ms linear forwards}',
  '.walk-ins .leg-l{animation:pdWalkInsL 3400ms linear forwards}',
  '.walk-ins .leg-r{animation:pdWalkInsR 3400ms linear forwards}',
].join('\n');

const GENERIC: Avatar[] = [
  { piel: '#f1c9a5', pelo: '#3b2a20', peinado: 'corto', ropa: '#5a7d9a', anteojos: false, barba: true },
  { piel: '#d9a27c', pelo: '#1f1a17', peinado: 'largo', ropa: '#b5485a', anteojos: false, barba: false },
  { piel: '#c68a62', pelo: '#2a1d16', peinado: 'rulos', ropa: '#4f8a5b', anteojos: true, barba: false },
];

/** Hook: corre una animación WAAPI al montar y llama onDone al terminar. */
function useAnim(keyframes: Keyframe[], opts: KeyframeAnimationOptions, onDone?: () => void) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') {
      const t = setTimeout(() => onDone?.(), Number(opts.duration ?? 1000) + Number(opts.delay ?? 0));
      return () => clearTimeout(t);
    }
    const a = el.animate(keyframes, { fill: 'forwards', ...opts });
    a.onfinish = () => onDone?.();
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

function Outline({ children, x = 0, y = 0, size = 16, color = '#fff', stroke = '#1d2b3a', weight = 900, anchor = 'middle' }: { children: ReactNode; x?: number; y?: number; size?: number; color?: string; stroke?: string; weight?: number; anchor?: 'middle' | 'start' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill={color} stroke={stroke} strokeWidth={size / 4.5} paintOrder="stroke" strokeLinejoin="round" fontFamily={SANS}>
      {children}
    </text>
  );
}

/** Texto/ícono que sube y se desvanece. */
function FloatUp({ at, rise = 40, dur = 1600, delay = 0, children, onDone }: { at: Pt; rise?: number; dur?: number; delay?: number; children: ReactNode; onDone?: () => void }) {
  const ref = useAnim(
    [
      { transform: `translate(${at.x}px, ${at.y}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${at.x}px, ${at.y - rise * 0.25}px) scale(1.1)`, opacity: 1, offset: 0.18 },
      { transform: `translate(${at.x}px, ${at.y - rise * 0.6}px) scale(1)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${at.x}px, ${at.y - rise}px) scale(0.95)`, opacity: 0 },
    ],
    { duration: dur, delay, easing: 'ease-out' },
    onDone,
  );
  return (
    <g ref={ref} style={{ opacity: 0, transform: `translate(${at.x}px, ${at.y}px)` }}>
      {children}
    </g>
  );
}

function PaperPlane({ from, to, late, onDone }: { from: Pt; to: Pt; late: boolean; onDone: () => void }) {
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
  const ref = useAnim(
    [
      { transform: `translate(${from.x}px, ${from.y}px) rotate(-10deg) scale(0.7)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y - 20}px) rotate(-20deg) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${mid.x}px, ${mid.y}px) rotate(${to.x > from.x ? 8 : -8}deg) scale(0.9)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${to.x}px, ${to.y}px) rotate(-30deg) scale(0.4)`, opacity: 0 },
    ],
    { duration: 2000, easing: 'ease-in-out' },
    onDone,
  );
  const flip = to.x < from.x ? -1 : 1;
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      <g transform={`scale(${flip * 1.3},1.3)`}>
        <path d="M-12 0 L14 -6 L-4 4 Z" fill="#ffffff" stroke="#8fa3b5" strokeWidth={1} strokeLinejoin="round" />
        <path d="M-4 4 L14 -6 L-1 8 Z" fill="#dce6ef" stroke="#8fa3b5" strokeWidth={1} strokeLinejoin="round" />
      </g>
      {late && (
        <text x={10} y={-12} fontSize={16}>
          ⏰
        </text>
      )}
    </g>
  );
}

function Coin({ from, to, delay, onDone }: { from: Pt; to: Pt; delay: number; onDone?: () => void }) {
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 };
  const ref = useAnim(
    [
      { transform: `translate(${from.x}px, ${from.y}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y - 10}px) scale(1)`, opacity: 1, offset: 0.1 },
      { transform: `translate(${mid.x}px, ${mid.y}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(0.5)`, opacity: 0.9 },
    ],
    { duration: 1100, delay, easing: 'cubic-bezier(.4,.1,.6,1)' },
    onDone,
  );
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      <circle r={7} fill="#f2c94c" stroke="#b8860b" strokeWidth={1.6} />
      <text y={3.4} textAnchor="middle" fontSize={9} fontWeight={900} fill="#9a6d00" fontFamily={SANS}>
        $
      </text>
    </g>
  );
}

function Bill({ from, to, delay }: { from: Pt; to: Pt; delay: number }) {
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
  const ref = useAnim(
    [
      { transform: `translate(${from.x}px, ${from.y}px) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y - 10}px) rotate(-10deg)`, opacity: 1, offset: 0.1 },
      { transform: `translate(${mid.x}px, ${mid.y}px) rotate(20deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) rotate(-15deg)`, opacity: 0 },
    ],
    { duration: 1200, delay, easing: 'ease-in-out' },
  );
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      <rect x={-11} y={-6} width={22} height={12} rx={1.5} fill="#8fcf9b" stroke="#3f8f4f" strokeWidth={1} />
      <circle r={3} fill="#3f8f4f" opacity={0.6} />
    </g>
  );
}

function Visitor({ a, door, L, kind, onDoor, onDone }: { a: Avatar; door: Pt; L: LevelLayout; kind: 'cliente' | 'prospecto' | 'inspector'; onDoor: (open: boolean) => void; onDone: () => void }) {
  const s = L.visitor.s;
  const y = L.visitor.y;
  const stop = kind === 'inspector' ? L.waiting.x : L.visitor.x - 26;
  const dur = kind === 'inspector' ? 3400 : 5200;
  const frames: Keyframe[] =
    kind === 'inspector'
      ? [
          { transform: `translate(${door.x}px, ${y}px) scale(${s})`, opacity: 0 },
          { transform: `translate(${door.x + 8}px, ${y}px) scale(${s})`, opacity: 1, offset: 0.1 },
          { transform: `translate(${stop}px, ${y}px) scale(${s})`, opacity: 1, offset: 0.6 },
          { transform: `translate(${stop}px, ${y}px) scale(${s})`, opacity: 1, offset: 0.85 },
          { transform: `translate(${stop}px, ${y}px) scale(${s})`, opacity: 0 },
        ]
      : [
          { transform: `translate(${door.x}px, ${y}px) scale(${s})`, opacity: 0 },
          { transform: `translate(${door.x + 8}px, ${y}px) scale(${s})`, opacity: 1, offset: 0.06 },
          { transform: `translate(${stop}px, ${y}px) scale(${s})`, opacity: 1, offset: 0.3 },
          { transform: `translate(${stop}px, ${y}px) scale(${s})`, opacity: 1, offset: 0.68 },
          { transform: `translate(${stop}px, ${y}px) scale(${-s}, ${s})`, opacity: 1, offset: 0.69 },
          { transform: `translate(${door.x + 8}px, ${y}px) scale(${-s}, ${s})`, opacity: 1, offset: 0.93 },
          { transform: `translate(${door.x}px, ${y}px) scale(${-s}, ${s})`, opacity: 0 },
        ];
  const ref = useAnim(frames, { duration: dur, easing: 'linear' }, onDone);
  useEffect(() => {
    onDoor(true);
    const ts = [setTimeout(() => onDoor(false), 900)];
    if (kind !== 'inspector') {
      ts.push(setTimeout(() => onDoor(true), dur * 0.82));
      ts.push(setTimeout(() => onDoor(false), dur));
    }
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      <g className={kind === 'inspector' ? 'visitor-walk walk-ins' : 'visitor-walk walk-cli'}>
        <StandingPerson a={a} carry={kind === 'inspector' ? 'briefcase' : 'folder'} walking />
      </g>
      {kind === 'prospecto' && (
        <g transform="translate(0,-152)">
          <rect x={-50} y={-15} width={100} height={24} rx={12} fill="#e8b93a" stroke="#9a7417" strokeWidth={1.4} />
          <text x={0} y={2} textAnchor="middle" fontSize={13} fontWeight={900} fill="#3b2a00" fontFamily={SANS}>
            ¿Cliente nuevo?
          </text>
        </g>
      )}
    </g>
  );
}

function Confetti({ vbX, vbW, onDone }: { vbX: number; vbW: number; onDone: () => void }) {
  const colors = ['#e8b93a', '#c8414f', '#1f8a70', '#2f6fb5', '#ff8fb1', '#7fd1ff'];
  const pieces = Array.from({ length: 46 }, (_, i) => ({
    x: vbX + ((i * 97) % 100) * (vbW / 100),
    d: (i * 53) % 900,
    c: colors[i % colors.length],
    r: (i * 37) % 360,
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} {...p} />
      ))}
    </g>
  );
}

function ConfettiPiece({ x, d, c, r }: { x: number; d: number; c: string; r: number }) {
  const ref = useAnim(
    [
      { transform: `translate(${x}px, -20px) rotate(${r}deg)`, opacity: 1 },
      { transform: `translate(${x + 30}px, 220px) rotate(${r + 360}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x - 10}px, 470px) rotate(${r + 620}deg)`, opacity: 0.2 },
    ],
    { duration: 2400, delay: d, easing: 'ease-in' },
  );
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      <rect x={-4} y={-2.5} width={8} height={5} fill={c} />
    </g>
  );
}

function Sparkle({ at, onDone }: { at: Pt; onDone?: () => void }) {
  const ref = useAnim(
    [
      { transform: `translate(${at.x}px, ${at.y}px) scale(0.2) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${at.x}px, ${at.y}px) scale(1.2) rotate(45deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${at.x}px, ${at.y}px) scale(0.8) rotate(90deg)`, opacity: 0 },
    ],
    { duration: 1300, easing: 'ease-out' },
    onDone,
  );
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      {[0, 45, 90, 135].map((a) => (
        <path key={a} d="M0 -26 L4 -4 L26 0 L4 4 L0 26 L-4 4 L-26 0 L-4 -4 Z" fill="#ffe36e" opacity={a % 90 === 0 ? 0.95 : 0.6} transform={`rotate(${a}) scale(${a % 90 === 0 ? 1 : 0.6})`} />
      ))}
    </g>
  );
}

function Banner({ at, text, color, onDone }: { at: Pt; text: string; color: string; onDone: () => void }) {
  const ref = useAnim(
    [
      { transform: `translate(${at.x}px, ${at.y}px) scale(0.4)`, opacity: 0 },
      { transform: `translate(${at.x}px, ${at.y}px) scale(1.12)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${at.x}px, ${at.y}px) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${at.x}px, ${at.y}px) scale(1)`, opacity: 1, offset: 0.85 },
      { transform: `translate(${at.x}px, ${at.y - 20}px) scale(0.9)`, opacity: 0 },
    ],
    { duration: 2800, easing: 'ease-out' },
    onDone,
  );
  const w = Math.max(140, text.length * 11 + 40);
  return (
    <g ref={ref} style={{ opacity: 0 }}>
      <rect x={-w / 2} y={-22} width={w} height={40} rx={10} fill={color} stroke="#ffffff" strokeWidth={3} />
      <text x={0} y={5} textAnchor="middle" fontSize={19} fontWeight={900} fill="#ffffff" fontFamily={SANS} letterSpacing={0.8}>
        {text}
      </text>
    </g>
  );
}

// ----------------------------------------------------------------------------- capa

interface ActiveFx {
  key: number;
  fx: FxEvent;
}

export interface FxLayerProps {
  fx: FxEvent[];
  L: LevelLayout;
  workerHead: Record<string, Pt>;
  clients: Client[];
  vbX: number;
  vbW: number;
  onDoor: (open: boolean) => void;
  onShake: () => void;
}

export function FxLayer({ fx, L, workerHead, clients, vbX, vbW, onDoor, onShake }: FxLayerProps) {
  const lastSeen = useRef<number>(fx.reduce((m, f) => Math.max(m, f.id), 0));
  const [items, setItems] = useState<ActiveFx[]>([]);

  useEffect(() => {
    const fresh = fx.filter((f) => f.id > lastSeen.current);
    if (!fresh.length) return;
    lastSeen.current = fresh.reduce((m, f) => Math.max(m, f.id), lastSeen.current);
    // limitar visitantes simultáneos
    setItems((prev) => {
      const next = [...prev];
      let visitors = prev.filter((p) => isVisitor(p.fx.kind)).length;
      for (const f of fresh) {
        if (isVisitor(f.kind)) {
          if (visitors >= 2) continue;
          visitors++;
        }
        next.push({ key: f.id, fx: f });
      }
      return next.slice(-28);
    });
    if (fresh.some((f) => f.kind === 'multa')) onShake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx]);

  const remove = (key: number) => setItems((prev) => prev.filter((p) => p.key !== key));

  const door: Pt = { x: L.door.x + L.door.w / 2, y: L.door.y + L.door.h * 0.62 };
  const piggy: Pt = { x: L.piggy.x, y: L.piggy.y - 22 };
  const win = L.windows[0];
  const windowPt: Pt = { x: win.x + win.w * 0.72, y: win.y + Math.min(50, win.h * 0.35) };
  const head = (id?: string): Pt => {
    const p = (id && workerHead[id]) || workerHead.player || { x: 600, y: 300 };
    return { x: p.x, y: p.y - 26 };
  };

  return (
    <g className="fx-layer" pointerEvents="none">
      <style>{WALK_CSS}</style>
      {items.map(({ key, fx: f }) => {
        const done = () => remove(key);
        switch (f.kind) {
          case 'paso_completo':
            return (
              <FloatUp key={key} at={head(f.workerId)} rise={30} dur={1100} onDone={done}>
                <circle r={9} fill="#2a9d4b" stroke="#fff" strokeWidth={2} />
                <path d="M-4 0 L-1 3.4 L4.6 -3.4" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </FloatUp>
            );
          case 'presentada':
          case 'presentada_tarde': {
            const from = head(f.workerId);
            const late = f.kind === 'presentada_tarde';
            return (
              <g key={key}>
                <PaperPlane from={{ x: from.x, y: from.y + 30 }} to={windowPt} late={late} onDone={done} />
                <FloatUp at={{ x: windowPt.x, y: windowPt.y + 10 }} rise={26} dur={1500} delay={1500}>
                  <Outline size={13} color={late ? '#ffd2a8' : '#c9f5d6'} stroke={late ? '#8a3b00' : '#14532d'}>
                    {late ? 'ARCA · fuera de término' : 'ARCA ✓'}
                  </Outline>
                </FloatUp>
              </g>
            );
          }
          case 'error':
            return (
              <FloatUp key={key} at={head(f.workerId)} rise={26} dur={1300} onDone={done}>
                <Outline size={18} color="#ffb02e">
                  ⚠
                </Outline>
              </FloatUp>
            );
          case 'error_detectado':
            return (
              <FloatUp key={key} at={head(f.workerId)} rise={36} dur={1900} onDone={done}>
                <text x={-34} y={2} fontSize={18}>
                  🔍
                </text>
                <Outline x={8} y={0} size={12} color="#ffe36e" stroke="#5c4300">
                  {f.texto ?? '¡Error corregido!'}
                </Outline>
              </FloatUp>
            );
          case 'cobro':
            return (
              <g key={key}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Coin key={i} from={door} to={piggy} delay={i * 130} onDone={i === 4 ? done : undefined} />
                ))}
                <FloatUp at={{ x: piggy.x, y: piggy.y - 10 }} rise={42} dur={1800} delay={900}>
                  <Outline size={16} color="#b9f5c8" stroke="#14532d">
                    {`+${moneyShort(f.monto ?? 0)}`}
                  </Outline>
                </FloatUp>
              </g>
            );
          case 'pago':
            return (
              <g key={key}>
                {[0, 1, 2].map((i) => (
                  <Bill key={i} from={piggy} to={door} delay={i * 160} />
                ))}
                <FloatUp at={{ x: piggy.x, y: piggy.y - 10 }} rise={36} dur={1800} onDone={done}>
                  <Outline size={15} color="#ffc9cf" stroke="#7a1420">
                    {`−${moneyShort(Math.abs(f.monto ?? 0))}`}
                  </Outline>
                  {f.texto && (
                    <Outline y={15} size={10} color="#ffffff" stroke="#3a3a3a">
                      {f.texto}
                    </Outline>
                  )}
                </FloatUp>
              </g>
            );
          case 'multa':
            return (
              <g key={key}>
                <Banner at={{ x: vbX + vbW / 2, y: 120 }} text={`MULTA −${moneyShort(Math.abs(f.monto ?? 0))}`} color="#c8414f" onDone={done} />
                {f.texto && (
                  <FloatUp at={{ x: vbX + vbW / 2, y: 160 }} rise={10} dur={2600}>
                    <Outline size={12} color="#ffffff" stroke="#7a1420">
                      {f.texto}
                    </Outline>
                  </FloatUp>
                )}
              </g>
            );
          case 'cliente_llega':
          case 'prospecto_llega':
          case 'inspector': {
            const c = f.clientId ? clients.find((x) => x.id === f.clientId) : undefined;
            const a = f.kind === 'inspector' ? INSPECTOR_AVATAR : (c?.avatar ?? GENERIC[key % GENERIC.length]);
            return <Visitor key={key} a={a} door={{ x: door.x, y: 0 }} L={L} kind={f.kind === 'inspector' ? 'inspector' : f.kind === 'prospecto_llega' ? 'prospecto' : 'cliente'} onDoor={onDoor} onDone={done} />;
          }
          case 'arca_caida':
            return <Banner key={key} at={{ x: win.x + win.w / 2, y: win.y + Math.min(win.h * 0.62, 150) }} text="ARCA CAÍDA ✖" color="#c8414f" onDone={done} />;
          case 'contratacion':
            return (
              <g key={key}>
                <Sparkle at={head(f.workerId)} />
                <FloatUp at={head(f.workerId)} rise={40} dur={2200} onDone={done}>
                  <Outline size={13} color="#ffe36e" stroke="#5c4300">
                    {f.texto ?? '¡Bienvenido/a!'}
                  </Outline>
                </FloatUp>
              </g>
            );
          case 'renuncia':
            return (
              <FloatUp key={key} at={head(f.workerId)} rise={40} dur={2200} onDone={done}>
                <text x={0} y={0} textAnchor="middle" fontSize={22}>
                  👋
                </text>
                {f.texto && (
                  <Outline y={18} size={11} color="#ffffff" stroke="#3a3a3a">
                    {f.texto}
                  </Outline>
                )}
              </FloatUp>
            );
          case 'nivel':
            return (
              <g key={key}>
                <Confetti vbX={vbX} vbW={vbW} onDone={done} />
                <Banner at={{ x: vbX + vbW / 2, y: 110 }} text={f.texto ?? '¡Subiste de nivel!'} color="#1f8a70" onDone={() => undefined} />
              </g>
            );
          case 'herramienta': {
            const at = f.texto && /IA/i.test(f.texto) ? { x: L.aiBot.x, y: L.aiBot.y } : { x: L.rack.x, y: L.rack.y - 70 };
            return (
              <g key={key}>
                <Sparkle at={at} onDone={done} />
                {f.texto && (
                  <FloatUp at={{ x: at.x, y: at.y - 20 }} rise={30} dur={2000}>
                    <Outline size={12} color="#c9f5ff" stroke="#0d3550">
                      {f.texto}
                    </Outline>
                  </FloatUp>
                )}
              </g>
            );
          }
          case 'idea':
            return (
              <FloatUp key={key} at={head(f.workerId)} rise={34} dur={1800} onDone={done}>
                <text x={0} y={0} textAnchor="middle" fontSize={22}>
                  💡
                </text>
                {f.texto && (
                  <Outline y={16} size={11} color="#fff7c2" stroke="#5c4300">
                    {f.texto}
                  </Outline>
                )}
              </FloatUp>
            );
          default:
            return null;
        }
      })}
    </g>
  );
}

function isVisitor(k: FxEvent['kind']) {
  return k === 'cliente_llega' || k === 'prospecto_llega' || k === 'inspector';
}
