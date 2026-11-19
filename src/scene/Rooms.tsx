// Fondos y decoración de cada nivel de oficina.
import { memo, useId } from 'react';
import { MESES_CORTOS, day, month } from '../engine/calendar';
import { BACK_BASE, FLOOR_Y, WALL_BASE, type LevelLayout, type Rect } from './layout';
import { safeId, shade, skyColors } from './util';

const X0 = -1800;
const X1 = 3000;
const SANS = 'system-ui, -apple-system, Segoe UI, sans-serif';

interface Palette {
  wall: string;
  wall2: string;
  base: string;
  floor: string;
  floor2: string;
  slab: string;
}
const PALETTES: Palette[] = [
  { wall: '#f2dcbc', wall2: '#ead0aa', base: '#a9774a', floor: '#c4925e', floor2: '#b38152', slab: '#5b4636' },
  { wall: '#e7ecdc', wall2: '#dde4cf', base: '#7d8a72', floor: '#cdb28c', floor2: '#bfa27a', slab: '#5d6470' },
  { wall: '#ebe6dd', wall2: '#e1dbd0', base: '#6f7780', floor: '#bfc5cb', floor2: '#b1b8bf', slab: '#4c5560' },
  { wall: '#dfe3e8', wall2: '#d4d9df', base: '#3c434c', floor: '#59616b', floor2: '#4f5761', slab: '#272d35' },
];

// ----------------------------------------------------------------------------- estructura

const RX0 = 0;
const RX1 = 1200;
const RW = RX1 - RX0;

function Structure({ level, night }: { level: number; night: boolean }) {
  const p = PALETTES[level];
  const uid = safeId(useId());
  const lines: JSX.Element[] = [];
  // tablas/baldosas con perspectiva hacia un punto de fuga
  for (let x = -600; x <= 1800; x += level === 0 ? 70 : 90) {
    const x2 = 600 + (x - 600) * 1.55;
    lines.push(<line key={`v${x}`} x1={x} y1={FLOOR_Y} x2={x2} y2={460} stroke={p.floor2} strokeWidth={1.2} />);
  }
  const rows = level === 0 ? [326, 350, 380, 418] : [330, 360, 400, 448];
  return (
    <g>
      <defs>
        <clipPath id={`room${uid}`}>
          <rect x={RX0} y={0} width={RW} height={460} />
        </clipPath>
        <pattern id={`hatch${uid}`} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill="#80858c" />
          <line x1={0} y1={0} x2={0} y2={8} stroke="#6c7178" strokeWidth={3} />
        </pattern>
      </defs>
      <g clipPath={`url(#room${uid})`}>
        <rect x={RX0} y={0} width={RW} height={WALL_BASE} fill={p.wall} />
        {level === 0 && (
          <g opacity={0.5}>
            {Array.from({ length: 31 }, (_, i) => (
              <rect key={i} x={RX0 + i * 40} y={14} width={14} height={WALL_BASE - 14} fill={p.wall2} />
            ))}
          </g>
        )}
        {level === 1 && <rect x={RX0} y={190} width={RW} height={WALL_BASE - 190} fill={p.wall2} />}
        {level === 1 && <rect x={RX0} y={188} width={RW} height={4} fill={shade(p.wall2, -0.08)} />}
        {level === 2 && <rect x={RX0} y={236} width={RW} height={64} fill="#2f8f7a" opacity={0.18} />}
        <rect x={RX0} y={FLOOR_Y} width={RW} height={460 - FLOOR_Y} fill={p.floor} />
        {lines}
        {rows.map((y) => (
          <line key={y} x1={RX0} y1={y} x2={RX1} y2={y} stroke={p.floor2} strokeWidth={level === 3 ? 0.8 : 1.2} opacity={0.8} />
        ))}
        {level === 3 && <rect x={RX0} y={FLOOR_Y} width={RW} height={60} fill="#ffffff" opacity={night ? 0.03 : 0.06} />}
        <rect x={RX0} y={WALL_BASE} width={RW} height={FLOOR_Y - WALL_BASE} fill={p.base} />
        <rect x={RX0} y={FLOOR_Y} width={RW} height={6} fill="#000" opacity={0.1} />
      </g>
      {/* corte del edificio: losa y muros laterales */}
      <rect x={RX0 - 22} y={0} width={RW + 44} height={14} fill={p.slab} />
      <rect x={RX0} y={14} width={RW} height={4} fill="#000" opacity={0.12} />
      <rect x={RX0 - 22} y={0} width={22} height={460} fill={`url(#hatch${uid})`} />
      <rect x={RX1} y={0} width={22} height={460} fill={`url(#hatch${uid})`} />
      <rect x={RX0 - 2} y={0} width={2} height={460} fill="#000" opacity={0.25} />
      <rect x={RX1} y={0} width={2} height={460} fill="#000" opacity={0.25} />
    </g>
  );
}

// ----------------------------------------------------------------------------- exterior (visible en pantallas anchas)

function Skyline({ x0, x1, base, hMin, hMax, night, seed, tint }: { x0: number; x1: number; base: number; hMin: number; hMax: number; night: boolean; seed: number; tint: string }) {
  const out: JSX.Element[] = [];
  let x = x0;
  let k = seed;
  let i = 0;
  while (x < x1) {
    k = (k * 9301 + 49297) % 233280;
    const bw = 34 + (k % 40);
    const bh = hMin + ((k >> 2) % (hMax - hMin));
    out.push(
      <g key={i}>
        <rect x={x} y={base - bh} width={bw} height={bh} fill={night ? '#252a4a' : tint} />
        {Array.from({ length: Math.floor(bh / 18) }, (_, j) => (
          <g key={j}>
            {[0, 1].map((c) => (
              <rect
                key={c}
                x={x + 6 + c * (bw / 2)}
                y={base - bh + 8 + j * 18}
                width={bw / 2 - 12}
                height={7}
                fill={night ? '#ffd77a' : '#ffffff'}
                opacity={night ? ((i + j + c) % 3 === 0 ? 0.15 : 0.8) : 0.35}
              />
            ))}
          </g>
        ))}
      </g>,
    );
    x += bw + 4;
    i++;
  }
  return <g>{out}</g>;
}

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={0} rx={30} ry={5} fill="#000" opacity={0.15} />
      <rect x={-6} y={-90} width={12} height={90} rx={4} fill="#6e4a2c" />
      <g className="sway" style={{ transformOrigin: '0px -90px' }}>
        <circle cx={-26} cy={-110} r={30} fill="#3f8f4f" />
        <circle cx={22} cy={-116} r={34} fill="#4ea35e" />
        <circle cx={-2} cy={-148} r={34} fill="#58b068" />
        <circle cx={10} cy={-96} r={22} fill="#367d45" />
      </g>
    </g>
  );
}

function StreetLamp({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {on && <ellipse cx={18} cy={-150} rx={60} ry={46} fill="url(#lampGlow)" />}
      <rect x={-3} y={-170} width={6} height={170} fill="#2c3440" />
      <path d="M0 -168 Q0 -180 18 -180 L24 -180" stroke="#2c3440" strokeWidth={5} fill="none" />
      <path d="M12 -180 L36 -180 L30 -170 L18 -170 Z" fill="#2c3440" />
      <ellipse cx={24} cy={-169} rx={7} ry={2.4} fill={on ? '#fff3c4' : '#9aa3ad'} />
    </g>
  );
}

function Facade({ x, w, top, color, night, sign }: { x: number; w: number; top: number; color: string; night: boolean; sign?: string }) {
  const cols = Math.max(1, Math.floor((w - 20) / 44));
  const rows = Math.max(1, Math.floor((WALL_BASE - 90 - top) / 56));
  return (
    <g>
      <rect x={x} y={top} width={w} height={FLOOR_Y - top} fill={color} />
      <rect x={x - 4} y={top - 8} width={w + 8} height={10} fill={shade(color, -0.2)} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <g key={`${r}-${c}`}>
            <rect x={x + 14 + c * 44} y={top + 16 + r * 56} width={28} height={36} fill={night ? ((r + c) % 3 === 0 ? '#3a3f5c' : '#ffd77a') : '#a9cfe6'} stroke={shade(color, -0.25)} strokeWidth={2} />
            <rect x={x + 12 + c * 44} y={top + 52 + r * 56} width={32} height={4} fill={shade(color, 0.2)} />
          </g>
        )),
      )}
      <rect x={x + 10} y={WALL_BASE - 64} width={w - 20} height={64} fill={shade(color, -0.3)} />
      <rect x={x + 16} y={WALL_BASE - 58} width={w - 32} height={58} fill={night ? '#ffe9a8' : '#cfe3ee'} opacity={0.85} />
      {sign && (
        <g>
          <rect x={x + 8} y={WALL_BASE - 86} width={w - 16} height={20} rx={3} fill="#c8414f" />
          <text x={x + w / 2} y={WALL_BASE - 72} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={SANS}>
            {sign}
          </text>
        </g>
      )}
    </g>
  );
}

function Exterior({ level, hour }: { level: number; hour: number }) {
  const sky = skyColors(hour);
  const uid = safeId(useId());
  const high = level === 3;
  const on = hour >= 17.5;
  const L0 = X0;
  const R0 = RX1 + 22;
  return (
    <g>
      <defs>
        <linearGradient id={`ext${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="1" stopColor={sky.bottom} />
        </linearGradient>
      </defs>
      <rect x={X0} y={0} width={X1 - X0} height={460} fill={`url(#ext${uid})`} />
      {sky.night && (
        <g fill="#fff8d6">
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} className={`star s${i % 3}`} cx={(i % 2 ? R0 + 40 : L0 + 40) + ((i * 137) % 1700)} cy={20 + ((i * 53) % 160)} r={i % 3 ? 1.1 : 1.6} />
          ))}
        </g>
      )}
      {high ? (
        <g>
          <Skyline x0={X0} x1={RX0 - 22} base={460} hMin={90} hMax={260} night={sky.night} seed={11} tint="#a9bccd" />
          <Skyline x0={R0} x1={X1} base={460} hMin={90} hMax={260} night={sky.night} seed={23} tint="#a9bccd" />
        </g>
      ) : (
        <g>
          <Skyline x0={X0} x1={RX0 - 22} base={FLOOR_Y} hMin={40} hMax={130} night={sky.night} seed={5} tint="#c3d2df" />
          <Skyline x0={R0} x1={X1} base={FLOOR_Y} hMin={40} hMax={130} night={sky.night} seed={17} tint="#c3d2df" />
          <Facade x={-560} w={250} top={70} color="#b8674e" night={sky.night} sign="KIOSCO" />
          <Facade x={1500} w={260} top={50} color="#d7c49e" night={sky.night} sign="FARMACIA" />
          <Facade x={-1040} w={300} top={30} color="#8fa3b0" night={sky.night} />
          <Facade x={1880} w={300} top={90} color="#c98f65" night={sky.night} />
          {/* vereda */}
          <rect x={X0} y={FLOOR_Y} width={RX0 - 22 - X0} height={460 - FLOOR_Y} fill="#c9c2b4" />
          <rect x={R0} y={FLOOR_Y} width={X1 - R0} height={460 - FLOOR_Y} fill="#c9c2b4" />
          {Array.from({ length: 60 }, (_, i) => {
            const x = X0 + i * 80;
            if (x > RX0 - 40 && x < R0) return null;
            return <line key={i} x1={x} y1={FLOOR_Y} x2={x - 30} y2={460} stroke="#b3ab9b" strokeWidth={1.4} />;
          })}
          <rect x={X0} y={FLOOR_Y} width={RX0 - 22 - X0} height={6} fill="#a39a88" />
          <rect x={R0} y={FLOOR_Y} width={X1 - R0} height={6} fill="#a39a88" />
          <Tree x={-170} y={420} />
          <Tree x={1390} y={420} />
          <StreetLamp x={-70} y={440} on={on} />
          <StreetLamp x={1290} y={440} on={on} />
          <Tree x={-760} y={430} />
          <Tree x={2100} y={430} />
        </g>
      )}
    </g>
  );
}

// ----------------------------------------------------------------------------- ventanas

function Clouds({ w, h }: { w: number; h: number }) {
  return (
    <g fill="#ffffff" opacity={0.9}>
      <g className="cloud c1" style={{ ['--cw' as string]: `${w + 120}px` }}>
        <ellipse cx={0} cy={h * 0.28} rx={22} ry={9} />
        <ellipse cx={14} cy={h * 0.24} rx={16} ry={10} />
        <ellipse cx={-14} cy={h * 0.3} rx={12} ry={7} />
      </g>
      <g className="cloud c2" style={{ ['--cw' as string]: `${w + 120}px` }}>
        <ellipse cx={0} cy={h * 0.5} rx={18} ry={7} />
        <ellipse cx={11} cy={h * 0.46} rx={12} ry={8} />
      </g>
    </g>
  );
}

function Stars({ w, h }: { w: number; h: number }) {
  const pts = [
    [0.12, 0.15],
    [0.3, 0.32],
    [0.48, 0.1],
    [0.66, 0.26],
    [0.84, 0.14],
    [0.22, 0.5],
    [0.74, 0.45],
    [0.92, 0.36],
  ];
  return (
    <g fill="#fff8d6">
      {pts.map(([px, py], i) => (
        <circle key={i} className={`star s${i % 3}`} cx={px * w} cy={py * h} r={i % 2 ? 1.1 : 1.6} />
      ))}
    </g>
  );
}

function CityBand({ w, h, night, seed }: { w: number; h: number; night: boolean; seed: number }) {
  const bs: { x: number; bw: number; bh: number }[] = [];
  let x = -4;
  let k = seed;
  while (x < w) {
    k = (k * 9301 + 49297) % 233280;
    const bw = 18 + (k % 22);
    const bh = 26 + ((k >> 3) % 46);
    bs.push({ x, bw, bh });
    x += bw + 2;
  }
  const c = night ? '#2a2f52' : '#9fb3c6';
  return (
    <g>
      {bs.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={h - b.bh} width={b.bw} height={b.bh} fill={c} />
          {night &&
            Array.from({ length: Math.floor(b.bh / 10) }, (_, j) => (
              <rect key={j} x={b.x + 4 + ((i + j) % 2) * 7} y={h - b.bh + 5 + j * 9} width={3.4} height={3.4} fill="#ffd77a" opacity={(i + j) % 3 === 0 ? 0.25 : 0.85} />
            ))}
        </g>
      ))}
    </g>
  );
}

function WindowPane({ r, hour, curtains, city, idx }: { r: Rect; hour: number; curtains?: boolean; city?: boolean; idx: number }) {
  const uid = safeId(useId());
  const sky = skyColors(hour);
  return (
    <g transform={`translate(${r.x},${r.y})`}>
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} className="sky-stop" />
          <stop offset="1" stopColor={sky.bottom} className="sky-stop" />
        </linearGradient>
        <clipPath id={`clip${uid}`}>
          <rect x={0} y={0} width={r.w} height={r.h} />
        </clipPath>
      </defs>
      <rect x={-7} y={-7} width={r.w + 14} height={r.h + 14} rx={3} fill="#f7f3ea" />
      <g clipPath={`url(#clip${uid})`}>
        <rect x={0} y={0} width={r.w} height={r.h} fill={`url(#sky${uid})`} />
        {sky.night ? <Stars w={r.w} h={r.h} /> : <Clouds w={r.w} h={r.h} />}
        {sky.night ? (
          <g>
            <circle cx={r.w * 0.78} cy={r.h * 0.22} r={10} fill="#fff4c9" />
            <circle cx={r.w * 0.78 + 4} cy={r.h * 0.22 - 3} r={9} fill={sky.top} />
          </g>
        ) : (
          <circle cx={r.w * 0.8} cy={r.h * (0.18 + Math.max(0, hour - 13) * 0.09)} r={11} fill={hour >= 17 ? '#ffb46b' : '#fff1a8'} opacity={0.95} />
        )}
        {city && <CityBand w={r.w} h={r.h} night={sky.night} seed={idx * 101 + 7} />}
        <rect x={0} y={0} width={r.w} height={r.h} fill="url(#glass)" opacity={0.6} />
      </g>
      <g fill="none" stroke="#f7f3ea" strokeWidth={5}>
        <line x1={r.w / 2} y1={0} x2={r.w / 2} y2={r.h} />
        <line x1={0} y1={r.h * 0.42} x2={r.w} y2={r.h * 0.42} />
      </g>
      <rect x={-7} y={-7} width={r.w + 14} height={r.h + 14} rx={3} fill="none" stroke={shade('#f7f3ea', -0.18)} strokeWidth={1.5} />
      <rect x={-12} y={r.h + 5} width={r.w + 24} height={7} rx={2} fill="#efe8d8" stroke="#cfc4ad" strokeWidth={1} />
      {curtains && (
        <g>
          <rect x={-22} y={-14} width={r.w + 44} height={5} rx={2} fill="#7a5233" />
          <path d={`M-20 -10 L14 -10 Q8 ${r.h * 0.5} 20 ${r.h + 6} L-20 ${r.h + 6} Z`} fill="#c0504d" />
          <path d={`M${r.w + 20} -10 L${r.w - 14} -10 Q${r.w - 8} ${r.h * 0.5} ${r.w - 20} ${r.h + 6} L${r.w + 20} ${r.h + 6} Z`} fill="#c0504d" />
          <path d={`M-12 -10 Q-6 ${r.h * 0.5} -12 ${r.h + 6}`} stroke="#a43f3d" strokeWidth={2} fill="none" />
          <path d={`M${r.w + 12} -10 Q${r.w + 6} ${r.h * 0.5} ${r.w + 12} ${r.h + 6}`} stroke="#a43f3d" strokeWidth={2} fill="none" />
        </g>
      )}
    </g>
  );
}

/** Ventanal corporativo con skyline y río. */
function Panorama({ r, hour }: { r: Rect; hour: number }) {
  const uid = safeId(useId());
  const sky = skyColors(hour);
  const n = sky.night;
  const riverY = r.h - 46;
  const towers = [
    [20, 120, 50],
    [78, 160, 38],
    [122, 96, 44],
    [176, 186, 34],
    [220, 132, 52],
    [282, 70, 40],
    [330, 150, 46],
    [386, 110, 36],
    [430, 200, 42],
    [480, 128, 50],
    [540, 88, 38],
    [586, 168, 46],
    [640, 118, 40],
    [690, 142, 52],
    [752, 96, 40],
  ];
  return (
    <g transform={`translate(${r.x},${r.y})`}>
      <defs>
        <linearGradient id={`psky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="1" stopColor={sky.bottom} />
        </linearGradient>
        <clipPath id={`pclip${uid}`}>
          <rect x={0} y={0} width={r.w} height={r.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#pclip${uid})`}>
        <rect x={0} y={0} width={r.w} height={r.h} fill={`url(#psky${uid})`} />
        {n ? <Stars w={r.w} h={r.h * 0.5} /> : <Clouds w={r.w} h={r.h * 0.6} />}
        {n ? <circle cx={r.w * 0.86} cy={46} r={14} fill="#fff4c9" /> : <circle cx={r.w * 0.86} cy={40 + Math.max(0, hour - 13) * 22} r={16} fill={hour >= 17 ? '#ffb46b' : '#fff1a8'} />}
        {/* skyline lejano */}
        {towers.map(([x, h, w], i) => (
          <g key={i}>
            <rect x={x} y={riverY - h} width={w} height={h} fill={n ? '#262b4d' : i % 2 ? '#a9bccd' : '#9cb0c3'} />
            {Array.from({ length: Math.floor(h / 16) }, (_, j) =>
              [0, 1, 2].map((c) => (
                <rect
                  key={`${j}-${c}`}
                  x={x + 5 + c * ((w - 10) / 3)}
                  y={riverY - h + 8 + j * 16}
                  width={(w - 16) / 3}
                  height={6}
                  fill={n ? '#ffd77a' : '#d6e4ef'}
                  opacity={n ? ((i + j + c) % 4 === 0 ? 0.2 : 0.85) : 0.55}
                />
              )),
            )}
          </g>
        ))}
        {/* río y puente */}
        <rect x={0} y={riverY} width={r.w} height={r.h - riverY} fill={n ? '#1b2346' : '#6aa0c2'} />
        <g stroke={n ? '#3a4470' : '#a8c9dd'} strokeWidth={2} opacity={0.7}>
          <line x1={40} y1={riverY + 14} x2={140} y2={riverY + 14} />
          <line x1={300} y1={riverY + 26} x2={420} y2={riverY + 26} />
          <line x1={560} y1={riverY + 18} x2={700} y2={riverY + 18} />
        </g>
        <g stroke={n ? '#8890b8' : '#eef2f5'} strokeWidth={1.4} fill="none">
          <line x1={500} y1={riverY - 8} x2={800} y2={riverY - 8} strokeWidth={4} />
          <line x1={600} y1={riverY - 8} x2={600} y2={riverY - 74} strokeWidth={4} />
          <line x1={720} y1={riverY - 8} x2={720} y2={riverY - 74} strokeWidth={4} />
          {[-60, -44, -28, -12, 12, 28, 44, 60].map((d) => (
            <line key={d} x1={600} y1={riverY - 70} x2={600 + d} y2={riverY - 8} />
          ))}
          {[-60, -44, -28, -12, 12, 28, 44, 60].map((d) => (
            <line key={`b${d}`} x1={720} y1={riverY - 70} x2={720 + d} y2={riverY - 8} />
          ))}
        </g>
        <g className="boat">
          <path d={`M0 ${riverY + 30} L26 ${riverY + 30} L22 ${riverY + 36} L4 ${riverY + 36} Z`} fill={n ? '#c7cbe0' : '#ffffff'} />
          <rect x={9} y={riverY + 24} width={8} height={6} fill={n ? '#ffd77a' : '#e05d4f'} />
        </g>
        <rect x={0} y={0} width={r.w} height={r.h} fill="url(#glass)" opacity={0.5} />
      </g>
      {/* parantes */}
      {Array.from({ length: Math.floor(r.w / 100) + 1 }, (_, i) => (
        <rect key={i} x={i * 100 - 3} y={0} width={6} height={r.h} fill="#2c3440" />
      ))}
      <rect x={-4} y={-4} width={r.w + 8} height={6} fill="#2c3440" />
      <rect x={0} y={r.h * 0.62} width={r.w} height={3} fill="#2c3440" opacity={0.6} />
    </g>
  );
}

// ----------------------------------------------------------------------------- objetos de pared

export const Clock = memo(function Clock({ x, y, r, hour, tick, msPerHour, paused }: { x: number; y: number; r: number; hour: number; tick: number; msPerHour: number; paused: boolean }) {
  const hourAngle = ((hour % 12) + 0.5) * 30;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r + 3} fill="#3b3b3b" />
      <circle r={r} fill="#fffdf6" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = i % 3 === 0 ? r - 6 : r - 4;
        return <line key={i} x1={Math.sin(a) * r1} y1={-Math.cos(a) * r1} x2={Math.sin(a) * (r - 2)} y2={-Math.cos(a) * (r - 2)} stroke="#3b3b3b" strokeWidth={i % 3 === 0 ? 2 : 1} />;
      })}
      <line className="hand-hour" x1={0} y1={2} x2={0} y2={-r * 0.5} stroke="#2b2b2b" strokeWidth={3} strokeLinecap="round" style={{ transform: `rotate(${hourAngle}deg)` }} />
      <line
        key={tick}
        className={paused ? 'hand-min stop' : 'hand-min'}
        x1={0}
        y1={3}
        x2={0}
        y2={-r * 0.78}
        stroke="#c8414f"
        strokeWidth={1.8}
        strokeLinecap="round"
        style={{ animationDuration: `${msPerHour}ms` }}
      />
      <circle r={2.4} fill="#2b2b2b" />
    </g>
  );
});

export const WallCalendar = memo(function WallCalendar({ x, y, date, urgent, onClick }: { x: number; y: number; date: string; urgent: number; onClick?: () => void }) {
  return (
    <g transform={`translate(${x},${y})`} className="clickable calendar" onClick={onClick}>
      <title>{urgent > 0 ? `${urgent} vencimientos en los próximos 3 días` : 'Agenda de vencimientos'}</title>
      <line x1={26} y1={-8} x2={26} y2={2} stroke="#6b6b6b" strokeWidth={1.4} />
      <circle cx={26} cy={-8} r={2} fill="#6b6b6b" />
      <rect x={2} y={2} width={52} height={60} rx={3} fill="#000" opacity={0.12} />
      <rect x={0} y={0} width={52} height={60} rx={3} fill="#ffffff" stroke="#d2c9b6" strokeWidth={1} />
      <rect x={0} y={0} width={52} height={16} rx={3} fill="#c8414f" />
      <rect x={0} y={10} width={52} height={6} fill="#c8414f" />
      <text x={26} y={12} textAnchor="middle" fontSize={10} fontWeight={900} fill="#fff" fontFamily={SANS} letterSpacing={1}>
        {MESES_CORTOS[month(date) - 1].toUpperCase()}
      </text>
      <text x={26} y={48} textAnchor="middle" fontSize={27} fontWeight={900} fill="#23303d" fontFamily={SANS}>
        {day(date)}
      </text>
      {urgent > 0 && (
        <g className="badge-pulse" style={{ transformOrigin: '50px 2px' }}>
          <circle cx={50} cy={2} r={10} fill="#e23d4b" stroke="#fff" strokeWidth={2} />
          <text x={50} y={6} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff" fontFamily={SANS}>
            {urgent > 9 ? '9+' : urgent}
          </text>
        </g>
      )}
    </g>
  );
});

function Diploma({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={2} width={70} height={50} fill="#000" opacity={0.12} />
      <rect x={0} y={0} width={70} height={50} fill="#6e4a2c" />
      <rect x={5} y={5} width={60} height={40} fill="#fbf6e6" />
      <text x={35} y={17} textAnchor="middle" fontSize={5.4} fontFamily="Georgia, serif" fill="#5b4a2e" fontStyle="italic">
        Universidad Nacional
      </text>
      <text x={35} y={27} textAnchor="middle" fontSize={7.4} fontFamily="Georgia, serif" fontWeight={700} fill="#3b2f1c">
        Contador Público
      </text>
      <line x1={14} y1={34} x2={44} y2={34} stroke="#b9a77f" strokeWidth={0.8} />
      <circle cx={54} cy={36} r={5} fill="#c8414f" />
      <circle cx={54} cy={36} r={2.4} fill="#e8b93a" />
    </g>
  );
}

function Picture({ x, y, w = 56, h = 42 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={2} width={w} height={h} fill="#000" opacity={0.12} />
      <rect x={0} y={0} width={w} height={h} fill="#2f3b47" />
      <rect x={4} y={4} width={w - 8} height={h - 8} fill="#bfe0ef" />
      <path d={`M4 ${h - 4} L${w * 0.35} ${h * 0.45} L${w * 0.55} ${h * 0.7} L${w * 0.72} ${h * 0.5} L${w - 4} ${h - 4} Z`} fill="#5e9a6e" />
      <circle cx={w * 0.75} cy={h * 0.3} r={4} fill="#f5d36b" />
    </g>
  );
}

function Plant({ x, y, s = 1, big }: { x: number; y: number; s?: number; big?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={18} ry={4} fill="#000" opacity={0.15} />
      <g className="sway" style={{ transformOrigin: '0px -30px' }}>
        {big ? (
          <g fill="#3f8f4f">
            <path d="M0 -30 C-30 -50 -40 -80 -22 -96 C-18 -70 -8 -54 0 -30 Z" />
            <path d="M0 -30 C26 -46 42 -78 26 -100 C20 -74 8 -56 0 -30 Z" fill="#4ea35e" />
            <path d="M0 -30 C-8 -60 -2 -96 10 -110 C10 -80 6 -56 0 -30 Z" fill="#367d45" />
            <path d="M0 -30 C-34 -36 -50 -52 -50 -66 C-30 -60 -14 -46 0 -30 Z" fill="#4ea35e" />
            <path d="M0 -30 C30 -32 50 -46 52 -60 C32 -56 14 -44 0 -30 Z" fill="#367d45" />
          </g>
        ) : (
          <g fill="#4ea35e">
            <ellipse cx={-8} cy={-40} rx={7} ry={16} transform="rotate(-25 -8 -40)" />
            <ellipse cx={8} cy={-42} rx={7} ry={17} transform="rotate(22 8 -42)" fill="#3f8f4f" />
            <ellipse cx={0} cy={-50} rx={6} ry={18} fill="#58b068" />
          </g>
        )}
      </g>
      <path d="M-14 -30 L14 -30 L11 0 L-11 0 Z" fill="#c4683f" />
      <rect x={-15} y={-33} width={30} height={5} rx={1.5} fill="#d97d52" />
    </g>
  );
}

function Dispenser({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={0} rx={16} ry={3.5} fill="#000" opacity={0.15} />
      <rect x={-13} y={-64} width={26} height={64} rx={3} fill="#e9edf1" stroke="#c3cad2" strokeWidth={1} />
      <rect x={-8} y={-52} width={6} height={4} rx={1} fill="#4a90d9" />
      <rect x={2} y={-52} width={6} height={4} rx={1} fill="#d9534a" />
      <path d="M-12 -64 L-14 -100 Q-14 -108 0 -108 Q14 -108 14 -100 L12 -64 Z" fill="#8fd0f5" opacity={0.75} />
      <rect x={-14} y={-92} width={28} height={2} fill="#ffffff" opacity={0.5} />
      <circle className="bubble b1" cx={-4} cy={-70} r={1.8} fill="#ffffff" opacity={0.8} />
      <circle className="bubble b2" cx={5} cy={-72} r={1.3} fill="#ffffff" opacity={0.8} />
    </g>
  );
}

function FileCabinet({ x, y, w = 50, h = 76 }: { x: number; y: number; w?: number; h?: number }) {
  const n = Math.round(h / 26);
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={w / 2} cy={0} rx={w / 2 + 3} ry={3} fill="#000" opacity={0.13} />
      <rect x={0} y={-h} width={w} height={h} rx={2} fill="#8f9aa6" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={3} y={-h + 3 + i * (h / n)} width={w - 6} height={h / n - 5} rx={1.5} fill="#a6b0bb" />
          <rect x={w / 2 - 7} y={-h + 3 + i * (h / n) + 5} width={14} height={3} rx={1.5} fill="#5d6772" />
        </g>
      ))}
    </g>
  );
}

function Shelf({ x, y, w }: { x: number; y: number; w: number }) {
  const books = ['#c8414f', '#2f6fb5', '#e8b93a', '#1f8a70', '#7a5233', '#6b4a8a', '#d98e04'];
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={6} rx={1} fill="#8a5a2e" />
      <path d={`M10 6 L16 18 M${w - 10} 6 L${w - 16} 18`} stroke="#6e4a2c" strokeWidth={3} />
      {books.map((c, i) => (
        <rect key={i} x={6 + i * 9} y={-(22 + (i % 3) * 4)} width={8} height={22 + (i % 3) * 4} fill={c} rx={1} />
      ))}
      <rect x={70} y={-26} width={8} height={26} fill="#3d4a59" transform="rotate(14 74 0)" />
    </g>
  );
}

function Door({ r, open, kind, sign, onClick }: { r: Rect; open: boolean; kind: 'home' | 'glass' | 'elevator'; sign: string; onClick?: () => void }) {
  const { x, y, w, h } = r;
  return (
    <g className="clickable door" onClick={onClick}>
      <title>Puerta — ver bandeja y consultas</title>
      <rect x={x - 6} y={y - 6} width={w + 12} height={h + 6} fill={kind === 'elevator' ? '#8d969f' : '#e9e1cf'} />
      <rect x={x} y={y} width={w} height={h} fill="#2a2420" />
      {kind === 'elevator' ? (
        <g>
          <rect className={open ? 'el-l open' : 'el-l'} x={x} y={y} width={w / 2} height={h} fill="#b9c2cb" stroke="#8d969f" strokeWidth={1} />
          <rect className={open ? 'el-r open' : 'el-r'} x={x + w / 2} y={y} width={w / 2} height={h} fill="#b9c2cb" stroke="#8d969f" strokeWidth={1} />
          <rect x={x + w / 2 - 14} y={y - 26} width={28} height={14} rx={2} fill="#1d232a" />
          <text x={x + w / 2} y={y - 15.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#ff9a3d" fontFamily={SANS}>
            12
          </text>
          <circle cx={x + w + 14} cy={y + h * 0.5} r={5} fill="#d6dbe0" stroke="#8d969f" />
        </g>
      ) : (
        <g className={open ? 'door-leaf open' : 'door-leaf'} style={{ transformOrigin: `${x}px ${y}px` }}>
          <rect x={x} y={y} width={w} height={h} fill={kind === 'home' ? '#8a5a35' : '#c9d9e4'} stroke={kind === 'home' ? '#6e4527' : '#7f939f'} strokeWidth={2} />
          {kind === 'home' ? (
            <g>
              <rect x={x + 10} y={y + 14} width={w - 20} height={h * 0.38} rx={2} fill="none" stroke="#6e4527" strokeWidth={2} />
              <rect x={x + 10} y={y + h * 0.5} width={w - 20} height={h * 0.42} rx={2} fill="none" stroke="#6e4527" strokeWidth={2} />
              <circle cx={x + w / 2} cy={y + 30} r={2} fill="#2a2420" />
            </g>
          ) : (
            <g>
              <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} fill="#e6f1f8" opacity={0.55} />
              <path d={`M${x + 10} ${y + 40} L${x + 30} ${y + 12}`} stroke="#ffffff" strokeWidth={3} opacity={0.7} />
              <rect x={x + 6} y={y + h * 0.36} width={w - 12} height={18} fill="#1d2b3a" opacity={0.85} />
              <text x={x + w / 2} y={y + h * 0.36 + 12.5} textAnchor="middle" fontSize={8} fontWeight={800} fill="#ffffff" fontFamily={SANS}>
                {sign.length > 14 ? `${sign.slice(0, 13)}…` : sign}
              </text>
            </g>
          )}
          <circle cx={x + w - 10} cy={y + h * 0.55} r={3.6} fill="#e8b93a" />
        </g>
      )}
      <rect x={x - 10} y={y + h} width={w + 20} height={5} fill="#7b6a55" />
    </g>
  );
}

function ReceptionDesk({ x, y, w = 120, color = '#e7dccb', front = '#1d2b3a', logo }: { x: number; y: number; w?: number; color?: string; front?: string; logo?: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={0} rx={w / 2 + 6} ry={4} fill="#000" opacity={0.13} />
      {/* monitor de espaldas */}
      <rect x={-w / 2 + 14} y={-74} width={30} height={22} rx={2} fill="#2b3440" />
      <rect x={-w / 2 + 26} y={-54} width={6} height={8} fill="#3a434f" />
      <rect x={-w / 2} y={-52} width={w} height={8} rx={2} fill={color} />
      <rect x={-w / 2 + 4} y={-44} width={w - 8} height={44} fill={front} />
      <rect x={-w / 2 + 4} y={-44} width={w - 8} height={4} fill="#000" opacity={0.15} />
      {logo && (
        <text x={0} y={-17} textAnchor="middle" fontSize={9} fontWeight={900} fill="#e8b93a" fontFamily={SANS} letterSpacing={1}>
          {logo}
        </text>
      )}
    </g>
  );
}

export function Piggy({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} className="piggy">
      <ellipse cx={0} cy={0} rx={13} ry={2.4} fill="#000" opacity={0.15} />
      <rect x={-8} y={-5} width={4} height={5} rx={1} fill="#e88aa6" />
      <rect x={4} y={-5} width={4} height={5} rx={1} fill="#e88aa6" />
      <ellipse cx={0} cy={-11} rx={13} ry={10} fill="#f4a3bc" />
      <ellipse cx={12} cy={-12} rx={4} ry={3.6} fill="#ee8fac" />
      <circle cx={11} cy={-12.6} r={0.8} fill="#b3506d" />
      <circle cx={13.4} cy={-12.6} r={0.8} fill="#b3506d" />
      <circle cx={6} cy={-15} r={1.2} fill="#2a2a33" />
      <path d="M2 -20 L5 -25 L7 -19 Z" fill="#ee8fac" />
      <rect x={-5} y={-21.5} width={8} height={1.8} rx={0.9} fill="#b3506d" />
      <path d="M-13 -12 q-4 -2 -3 -5" stroke="#ee8fac" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </g>
  );
}

function DeskPhone({ x, y, ringing }: { x: number; y: number; ringing: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <g className={ringing ? 'ring' : undefined}>
        <rect x={-11} y={-7} width={22} height={9} rx={2} fill="#2c3440" />
        <rect x={-12} y={-13} width={24} height={6} rx={3} fill="#3b4552" />
        <rect x={-5} y={-5} width={10} height={4} fill="#7fb6d6" />
      </g>
      {ringing && (
        <g className="ring-waves" stroke="#e23d4b" strokeWidth={1.8} fill="none" strokeLinecap="round">
          <path d="M-17 -16 Q-21 -10 -17 -4" />
          <path d="M17 -16 Q21 -10 17 -4" />
          <path d="M-22 -19 Q-28 -10 -22 -1" />
          <path d="M22 -19 Q28 -10 22 -1" />
        </g>
      )}
    </g>
  );
}

function PendantLamp({ x, on }: { x: number; on: boolean }) {
  return (
    <g transform={`translate(${x},14)`}>
      <line x1={0} y1={0} x2={0} y2={30} stroke="#3b3b3b" strokeWidth={1.4} />
      {on && <ellipse cx={0} cy={60} rx={70} ry={50} fill="url(#lampGlow)" />}
      <path d="M-14 44 L-6 30 L6 30 L14 44 Z" fill={on ? '#ffd27a' : '#3d4a59'} />
      <ellipse cx={0} cy={44} rx={14} ry={3} fill={on ? '#fff3c4' : '#2b3440'} />
    </g>
  );
}

function SofaCat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={2} rx={118} ry={6} fill="#000" opacity={0.14} />
      <rect x={-110} y={-70} width={220} height={50} rx={16} fill="#4f6d7a" />
      <rect x={-118} y={-46} width={30} height={46} rx={10} fill="#46626e" />
      <rect x={88} y={-46} width={30} height={46} rx={10} fill="#46626e" />
      <rect x={-90} y={-36} width={180} height={30} rx={8} fill="#5b7d8b" />
      <line x1={0} y1={-36} x2={0} y2={-8} stroke="#46626e" strokeWidth={2} />
      <rect x={-100} y={-6} width={8} height={6} fill="#3b2b20" />
      <rect x={92} y={-6} width={8} height={6} fill="#3b2b20" />
      <rect x={-80} y={-62} width={34} height={28} rx={8} fill="#e8b93a" transform="rotate(-8 -63 -48)" />
      {/* gato durmiendo */}
      <g transform="translate(40,-36)">
        <g className="cat-breathe" style={{ transformOrigin: '0px 0px' }}>
          <ellipse cx={0} cy={-8} rx={22} ry={11} fill="#3a3a40" />
          <ellipse cx={-16} cy={-12} rx={10} ry={8.5} fill="#3a3a40" />
          <path d="M-24 -18 L-22 -27 L-17 -19 Z" fill="#3a3a40" />
          <path d="M-14 -19 L-10 -27 L-8 -17 Z" fill="#3a3a40" />
          <path d="M-21 -11 Q-19 -9.6 -17 -11" stroke="#d7d7de" strokeWidth={1} fill="none" />
          <path d="M-14 -11 Q-12 -9.6 -10 -11" stroke="#d7d7de" strokeWidth={1} fill="none" />
        </g>
        <path className="cat-tail" d="M20 -4 Q34 -2 30 -16" stroke="#3a3a40" strokeWidth={5} fill="none" strokeLinecap="round" style={{ transformOrigin: '20px -4px' }} />
        <text className="zzz-cat" x={-26} y={-30} fontSize={9} fontWeight={900} fill="#7b8591" fontFamily={SANS}>
          z
        </text>
      </g>
    </g>
  );
}

function FloorLamp({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {on && <ellipse cx={0} cy={-120} rx={60} ry={50} fill="url(#lampGlow)" />}
      <ellipse cx={0} cy={0} rx={14} ry={3} fill="#2b2b2b" />
      <rect x={-1.5} y={-130} width={3} height={130} fill="#3b3b3b" />
      <path d="M-18 -128 L-10 -152 L10 -152 L18 -128 Z" fill={on ? '#ffe2a0' : '#e9dcc0'} />
    </g>
  );
}

function MeetingRoom({ x0, x1, night }: { x0: number; x1: number; night: boolean }) {
  const w = x1 - x0;
  return (
    <g>
      <rect x={x0} y={20} width={w} height={BACK_BASE - 20} fill="#dbe8ee" opacity={0.55} />
      {/* mesa y sillas */}
      <g transform={`translate(${x0 + w / 2},${BACK_BASE - 6})`}>
        {[-54, -18, 18, 54].map((dx) => (
          <rect key={dx} x={dx - 11} y={-60} width={22} height={34} rx={6} fill="#3d4a59" />
        ))}
        <rect x={-76} y={-30} width={152} height={8} rx={3} fill="#7b5a3c" />
        <rect x={-6} y={-22} width={12} height={22} fill="#5e4430" />
        <rect x={-30} y={-38} width={14} height={8} rx={1} fill="#ffffff" />
        <rect x={20} y={-36} width={10} height={6} rx={1} fill="#e8b93a" />
      </g>
      <rect x={x0} y={20} width={w} height={BACK_BASE - 20} fill="url(#glass)" opacity={night ? 0.25 : 0.45} />
      <g fill="#7f939f">
        <rect x={x0 - 3} y={20} width={5} height={BACK_BASE - 20} />
        <rect x={x1 - 2} y={20} width={5} height={BACK_BASE - 20} />
        <rect x={x0} y={20} width={w} height={5} />
        <rect x={x0} y={150} width={w} height={2} opacity={0.6} />
      </g>
      <text x={x0 + 10} y={44} fontSize={9} fontWeight={800} fill="#3c4c5f" fontFamily={SANS} opacity={0.8}>
        SALA DE REUNIONES
      </text>
    </g>
  );
}

function TechCabinet() {
  return (
    <g transform={`translate(1060,${BACK_BASE})`}>
      <ellipse cx={40} cy={0} rx={44} ry={3.5} fill="#000" opacity={0.13} />
      <rect x={0} y={-60} width={80} height={60} rx={2} fill="#b8bfc7" />
      <rect x={0} y={-60} width={80} height={5} fill="#d4dae0" />
      <rect x={4} y={-50} width={35} height={46} rx={1.5} fill="#a6aeb7" />
      <rect x={41} y={-50} width={35} height={46} rx={1.5} fill="#a6aeb7" />
      <rect x={32} y={-30} width={3} height={10} rx={1} fill="#5d6772" />
      <rect x={45} y={-30} width={3} height={10} rx={1} fill="#5d6772" />
    </g>
  );
}

function WallSign({ x, y, w, h, bg, text }: { x: number; y: number; w: number; h: number; bg: string; text: string }) {
  const t = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  // ancho aproximado de una letra mayúscula en negrita ≈ 0.68·fontSize
  const fs = Math.max(6.5, Math.min(12, (w - 14) / (t.length * 0.7)));
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={3} width={w} height={h} rx={4} fill="#000" opacity={0.15} />
      <rect x={0} y={0} width={w} height={h} rx={4} fill={bg} />
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={3} fill="none" stroke="#e8b93a" strokeWidth={0.8} opacity={0.5} />
      <text x={w / 2} y={h / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={900} fill="#e8b93a" fontFamily={SANS} letterSpacing={0.4}>
        {t}
      </text>
    </g>
  );
}

// ----------------------------------------------------------------------------- escenario completo

export interface BackdropProps {
  level: number;
  L: LevelLayout;
  hour: number;
  tick: number;
  msPerHour: number;
  paused: boolean;
  date: string;
  urgent: number;
  doorOpen: boolean;
  estudio: string;
  arcaCaida: boolean;
  onDoorClick?: () => void;
  onCalendarClick?: () => void;
}

export function Backdrop(p: BackdropProps) {
  const { level, L, hour } = p;
  const sky = skyColors(hour);
  const lightsOn = hour >= 17.5;
  const logo = p.estudio.toUpperCase();
  return (
    <g className="backdrop">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity={0.04} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0.16} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity={0.55} />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <Exterior level={level} hour={hour} />
      <Structure level={level} night={sky.night} />

      {/* ventanas */}
      {level === 3 ? (
        <Panorama r={L.windows[0]} hour={hour} />
      ) : (
        L.windows.map((w, i) => <WindowPane key={i} r={w} hour={hour} curtains={level === 0} city={level >= 1} idx={i} />)
      )}
      {/* haces de sol sobre el piso */}
      {!sky.dusk && level < 3 &&
        L.windows.map((w, i) => (
          <polygon
            key={`beam${i}`}
            points={`${w.x},${FLOOR_Y} ${w.x + w.w},${FLOOR_Y} ${w.x + w.w + 90},460 ${w.x + 70},460`}
            fill="#fff6d8"
            opacity={0.13}
          />
        ))}

      {/* decoración por nivel */}
      {level === 0 && (
        <g>
          <Plant x={205} y={BACK_BASE} s={1} big />
          <g transform="translate(140,110)">
            <rect x={-2} y={0} width={4} height={190} fill="#6e4a2c" />
            <circle cx={-8} cy={6} r={4} fill="#6e4a2c" />
            <circle cx={8} cy={6} r={4} fill="#6e4a2c" />
            <path d="M-12 8 Q-18 40 -10 60 L-2 60 L-2 10 Z" fill="#c0504d" />
          </g>
          <Shelf x={900} y={170} w={150} />
          <Picture x={176} y={118} w={50} h={38} />
          <SofaCat x={910} y={BACK_BASE + 2} />
          <ellipse cx={910} cy={350} rx={150} ry={16} fill="#b5485a" opacity={0.55} />
          <ellipse cx={910} cy={350} rx={130} ry={11} fill="none" stroke="#f2dcbc" strokeWidth={2} strokeDasharray="6 5" opacity={0.6} />
          <FloorLamp x={784} y={BACK_BASE} on={lightsOn} />
          <g transform={`translate(1060,${BACK_BASE})`}>
            <ellipse cx={60} cy={0} rx={66} ry={4} fill="#000" opacity={0.14} />
            <rect x={0} y={-70} width={130} height={66} rx={3} fill="#9c6b40" />
            <rect x={6} y={-62} width={56} height={52} rx={2} fill="#b07b4b" />
            <rect x={68} y={-62} width={56} height={52} rx={2} fill="#b07b4b" />
            <circle cx={56} cy={-36} r={2.4} fill="#6e4527" />
            <circle cx={74} cy={-36} r={2.4} fill="#6e4527" />
            <rect x={6} y={-4} width={6} height={4} fill="#5e3f22" />
            <rect x={118} y={-4} width={6} height={4} fill="#5e3f22" />
          </g>
        </g>
      )}
      {level === 1 && (
        <g>
          <Plant x={545} y={BACK_BASE} s={0.9} />
          <Dispenser x={655} y={BACK_BASE} />
          <FileCabinet x={300} y={BACK_BASE} w={40} h={80} />
          <TechCabinet />
          <Plant x={1196} y={BACK_BASE + 4} s={0.9} big />
        </g>
      )}
      {level === 2 && (
        <g>
          <WallSign x={130} y={58} w={120} h={36} bg="#1d2b3a" text={logo} />
          <MeetingRoom x0={875} x1={1045} night={sky.night} />
          <Dispenser x={286} y={BACK_BASE} />
          <TechCabinet />
          <Plant x={1196} y={BACK_BASE + 4} s={0.9} big />
          <FileCabinet x={746} y={BACK_BASE} w={44} h={60} />
        </g>
      )}
      {level === 3 && (
        <g>
          <WallSign x={128} y={56} w={120} h={40} bg="#11161c" text={logo} />
          <TechCabinet />
          <Plant x={262} y={BACK_BASE + 2} s={0.85} big />
          <Plant x={1198} y={BACK_BASE + 4} s={0.9} big />
          {/* paneles de luz */}
          {[340, 520, 700, 880].map((x) => (
            <g key={x}>
              <rect x={x - 50} y={14} width={100} height={5} fill={lightsOn ? '#fff4cf' : '#cfd6de'} />
              {lightsOn && <ellipse cx={x} cy={60} rx={90} ry={50} fill="url(#lampGlow)" />}
            </g>
          ))}
        </g>
      )}

      {/* recepción */}
      {level >= 1 && (
        <ReceptionDesk
          x={L.visitor.x + 3}
          y={BACK_BASE + 4}
          w={level === 1 ? 124 : 116}
          color={level === 3 ? '#f4f5f7' : '#e7dccb'}
          front={level === 3 ? '#2a2f37' : level === 2 ? '#2f4a5f' : '#7b5a3c'}
          logo={level >= 2 ? 'RECEPCIÓN' : undefined}
        />
      )}

      {/* objetos de pared comunes */}
      {level !== 3 && <Diploma x={L.diploma.x} y={L.diploma.y} />}
      {level === 3 && <Diploma x={L.diploma.x} y={L.diploma.y} />}
      <Clock x={L.clock.x} y={L.clock.y} r={L.clock.r} hour={hour} tick={p.tick} msPerHour={p.msPerHour} paused={p.paused} />
      <WallCalendar x={L.calendar.x} y={L.calendar.y} date={p.date} urgent={p.urgent} onClick={p.onCalendarClick} />
      <Door r={L.door} open={p.doorOpen} kind={level === 0 ? 'home' : level === 3 ? 'elevator' : 'glass'} sign={p.estudio} onClick={p.onDoorClick} />
      <Piggy x={L.piggy.x} y={L.piggy.y} />
      <DeskPhone x={L.phone.x} y={L.phone.y} ringing={p.arcaCaida} />

      {L.lamps.map((x) => (
        <PendantLamp key={x} x={x} on={lightsOn} />
      ))}
    </g>
  );
}

/** Capa de luz ambiente (atardecer/noche). Se dibuja por encima de todo menos FX. */
export function AmbientLight({ hour, vbX, vbW }: { hour: number; vbX: number; vbW: number }) {
  if (hour < 17) return null;
  const o = hour >= 19 ? 0.2 : hour >= 18 ? 0.12 : 0.06;
  const c = hour >= 19 ? '#141a45' : '#7a3a5a';
  return <rect x={vbX - 10} y={0} width={vbW + 20} height={460} fill={c} opacity={o} pointerEvents="none" />;
}
