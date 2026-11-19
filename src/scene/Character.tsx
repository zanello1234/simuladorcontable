// Personajes de la escena: trabajador sentado en su puesto, visitante de pie y sentado.
import { memo } from 'react';
import type { Avatar, WorkerStatus } from '../engine/types';
import { Head, type Mood } from './Avatar';
import type { DeskStyle } from './layout';
import { Shadow } from './Defs';
import { shade } from './util';

export type ScreenMode = 'off' | 'arca' | 'work' | 'grid' | 'erp' | 'mini' | 'idle' | 'sleep' | 'wait';

export interface SeatedWorkerProps {
  id: string;
  nombre: string;
  avatar: Avatar;
  status: WorkerStatus;
  estres: number;
  moral: number;
  papers: number;
  isPlayer: boolean;
  x: number;
  y: number;
  s: number;
  deskStyle: DeskStyle;
  screen: ScreenMode;
  token: boolean;
  dark: boolean;
  onClick?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

const DESK: Record<DeskStyle, { top: string; front: string; edge: string; chair: string }> = {
  home: { top: '#c9925a', front: '#a8733f', edge: '#8a5a2e', chair: '#8a5a3a' },
  office: { top: '#ece2d2', front: '#b8a589', edge: '#9c8a6e', chair: '#3d4a59' },
  corp: { top: '#f4f5f7', front: '#cfd5dd', edge: '#aab3bf', chair: '#2a2f37' },
};
const PLAYER_DESK = { top: '#a0673b', front: '#7b4a28', edge: '#5e381d', chair: '#5b3424' };

function moodFor(status: WorkerStatus, estres: number, moral: number): Mood {
  if (status === 'agotado') return 'dormido';
  if (estres > 70) return 'estres';
  if (moral < 30) return 'triste';
  if (status === 'ocioso' || status === 'descansando' || status === 'networking') return 'feliz';
  return 'neutral';
}

function Screen({ mode }: { mode: ScreenMode }) {
  // pantalla interior 35×23 en (2.5, 2.5)
  switch (mode) {
    case 'off':
      return <rect x={2.5} y={2.5} width={35} height={23} fill="#0b0e13" />;
    case 'sleep':
      return (
        <g>
          <rect x={2.5} y={2.5} width={35} height={23} fill="#111a26" />
          <circle className="scr-dot" cx={10} cy={12} r={1.6} fill="#3d6c96" />
        </g>
      );
    case 'arca':
      return (
        <g className="scr-arca">
          <rect x={2.5} y={2.5} width={35} height={23} fill="#c62f3c" />
          <text x={20} y={12} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">ARCA</text>
          <text x={20} y={21} textAnchor="middle" fontSize={6.4} fontWeight={800} fill="#ffd7da" fontFamily="system-ui, sans-serif">✖ 503</text>
        </g>
      );
    case 'mini':
      return (
        <g className="scr-mini">
          <rect x={2.5} y={2.5} width={35} height={23} fill="#e9fbe9" />
          <rect x={2.5} y={2.5} width={35} height={4} fill="#1f8a70" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}-${c}`} x={4 + c * 8.3} y={8 + r * 4.3} width={7.4} height={3.5} fill={r === 1 && c === 2 ? '#ffd54a' : '#c7ebcd'} className={r === 1 && c === 2 ? 'scr-cell' : undefined} />
            )),
          )}
        </g>
      );
    case 'grid':
      return (
        <g>
          <rect x={2.5} y={2.5} width={35} height={23} fill="#f6fbf6" />
          <rect x={2.5} y={2.5} width={35} height={3.5} fill="#2e8b57" />
          {[0, 1, 2, 3, 4].map((r) => (
            <line key={r} x1={2.5} x2={37.5} y1={9 + r * 3.6} y2={9 + r * 3.6} stroke="#cfe3cf" strokeWidth={0.6} />
          ))}
          {[0, 1, 2].map((c) => (
            <line key={c} x1={12 + c * 9} x2={12 + c * 9} y1={6} y2={25.5} stroke="#cfe3cf" strokeWidth={0.6} />
          ))}
          <rect className="scr-line l1" x={13} y={10} width={8} height={2} fill="#2e8b57" />
          <rect className="scr-line l2" x={22} y={17} width={8} height={2} fill="#2e8b57" />
        </g>
      );
    case 'erp':
      return (
        <g>
          <rect x={2.5} y={2.5} width={35} height={23} fill="#f5f3fb" />
          <rect x={2.5} y={2.5} width={35} height={3.6} fill="#714b67" />
          <rect x={2.5} y={6.1} width={7} height={19.4} fill="#e6dff0" />
          <rect className="scr-line l1" x={12} y={9} width={20} height={2} fill="#9b8ab0" />
          <rect className="scr-line l2" x={12} y={13.5} width={14} height={2} fill="#9b8ab0" />
          <rect className="scr-line l3" x={12} y={18} width={18} height={2} fill="#9b8ab0" />
          <rect x={27} y={20.6} width={8} height={3} rx={1} fill="#1f8a70" />
        </g>
      );
    case 'wait':
      return (
        <g>
          <rect x={2.5} y={2.5} width={35} height={23} fill="#f0f3f7" />
          <g className="scr-spin" style={{ transformOrigin: '20px 14px' }}>
            <circle cx={20} cy={14} r={5} fill="none" stroke="#c4ccd6" strokeWidth={1.8} />
            <path d="M20 9 A5 5 0 0 1 25 14" fill="none" stroke="#2f6fb5" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        </g>
      );
    case 'work':
      return (
        <g>
          <rect x={2.5} y={2.5} width={35} height={23} fill="#f3f6fa" />
          <rect x={2.5} y={2.5} width={35} height={3.5} fill="#2f6fb5" />
          <rect className="scr-line l1" x={5} y={9} width={26} height={1.8} fill="#9fb3c8" />
          <rect className="scr-line l2" x={5} y={13} width={20} height={1.8} fill="#9fb3c8" />
          <rect className="scr-line l3" x={5} y={17} width={24} height={1.8} fill="#9fb3c8" />
          <rect className="scr-line l4" x={5} y={21} width={14} height={1.8} fill="#9fb3c8" />
          <rect className="scr-cursor" x={20} y={20.6} width={1.2} height={2.6} fill="#2f6fb5" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={2.5} y={2.5} width={35} height={23} fill="#2b4a66" />
          <path d="M2.5 20 Q12 14 20 19 T37.5 16 L37.5 25.5 L2.5 25.5 Z" fill="#3c6a8e" />
          <circle cx={30} cy={8.5} r={2.4} fill="#f6d77a" opacity={0.85} />
        </g>
      );
  }
}

function Desk({ style, player, nombre }: { style: DeskStyle; player: boolean; nombre: string }) {
  const c = player && style !== 'home' ? PLAYER_DESK : DESK[style];
  const w = player ? 74 : 68;
  const label = player ? 'TITULAR' : nombre.split(' ')[0].toUpperCase().slice(0, 10);
  const wood = style !== 'corp';
  return (
    <g className="desk">
      <Shadow x={0} y={48} rx={w + 10} ry={7} />
      <polygon points={`${-w + 4},-12 ${w - 4},-12 ${w},0 ${-w},0`} fill={c.top} />
      {wood && <polygon points={`${-w + 4},-12 ${w - 4},-12 ${w},0 ${-w},0`} fill="url(#pd-wood)" />}
      <polygon points={`${-w + 4},-12 ${w - 4},-12 ${w},0 ${-w},0`} fill="url(#pd-top)" />
      <line x1={-w + 4} y1={-12} x2={w - 4} y2={-12} stroke={shade(c.top, 0.35)} strokeWidth={1} />
      <line x1={-w} y1={0.5} x2={w} y2={0.5} stroke="#000" strokeOpacity={0.22} strokeWidth={1} />
      {style === 'home' ? (
        <g>
          <rect x={-w} y={0} width={w * 2} height={7} rx={1.5} fill={c.front} />
          <rect x={-w} y={0} width={w * 2} height={7} rx={1.5} fill="url(#pd-wood)" />
          <rect x={-w} y={0} width={w * 2} height={7} rx={1.5} fill="url(#pd-side)" />
          <rect x={-w + 6} y={7} width={6} height={39} fill={c.edge} />
          <rect x={-w + 6} y={7} width={6} height={39} fill="url(#pd-metal)" />
          <rect x={w - 12} y={7} width={6} height={39} fill={c.edge} />
          <rect x={w - 12} y={7} width={6} height={39} fill="url(#pd-metal)" />
          <line x1={-w} y1={7} x2={w} y2={7} stroke={c.edge} strokeWidth={1.2} />
        </g>
      ) : style === 'corp' ? (
        <g>
          <rect x={-w} y={0} width={w * 2} height={5} fill={c.front} />
          <rect x={-w} y={0} width={w * 2} height={5} fill="url(#pd-side)" />
          <rect x={-w + 4} y={5} width={4} height={41} fill="#8c96a3" />
          <rect x={-w + 4} y={5} width={4} height={41} fill="url(#pd-metal)" />
          <rect x={w - 8} y={5} width={4} height={41} fill="#8c96a3" />
          <rect x={w - 8} y={5} width={4} height={41} fill="url(#pd-metal)" />
          <rect x={-w + 8} y={10} width={w * 2 - 16} height={22} fill="#dfe8f1" opacity={0.65} />
          {player && <rect x={-w + 8} y={10} width={w * 2 - 16} height={22} fill="#7b4a28" opacity={0.35} />}
        </g>
      ) : (
        <g>
          <rect x={-w} y={0} width={w * 2} height={46} rx={2} fill={c.front} />
          <rect x={-w} y={0} width={w * 2} height={46} rx={2} fill="url(#pd-wood)" />
          <rect x={-w} y={0} width={w * 2} height={46} rx={2} fill="url(#pd-side)" />
          <rect x={-w} y={0} width={w * 2} height={4} fill={shade(c.front, -0.12)} />
          <rect x={w - 34} y={8} width={28} height={16} rx={1.5} fill={shade(c.front, 0.08)} stroke={c.edge} strokeWidth={1} />
          <rect x={w - 34} y={26} width={28} height={16} rx={1.5} fill={shade(c.front, 0.08)} stroke={c.edge} strokeWidth={1} />
          <rect x={w - 23} y={15} width={6} height={2} rx={1} fill={c.edge} />
          <rect x={w - 23} y={33} width={6} height={2} rx={1} fill={c.edge} />
        </g>
      )}
      {style !== 'home' && (
        <g>
          <rect x={-30} y={style === 'corp' ? 14 : 12} width={60} height={14} rx={2} fill={player ? '#e8c35a' : shade(c.front, 0.35)} stroke={player ? '#9a7417' : c.edge} strokeWidth={0.8} />
          <text x={0} y={style === 'corp' ? 24 : 22} textAnchor="middle" fontSize={8.4} fontWeight={800} letterSpacing={0.5} fill={player ? '#4a3606' : '#3d3a33'} fontFamily="system-ui, sans-serif">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

const GLOW: Partial<Record<ScreenMode, string>> = { arca: 'url(#pd-monGlowRed)', mini: 'url(#pd-monGlowGreen)', off: 'none', sleep: 'none' };

function Monitor({ mode, token }: { mode: ScreenMode; token: boolean }) {
  const glow = GLOW[mode] ?? 'url(#pd-monGlow)';
  return (
    <g className="monitor">
      {/* reflejo de la pantalla sobre la tapa del escritorio */}
      {glow !== 'none' && <ellipse cx={-40} cy={-8} rx={30} ry={7} fill={glow} opacity={0.7} />}
      <ellipse cx={-46} cy={-10} rx={10} ry={2.6} fill="#2a313b" />
      <ellipse cx={-46} cy={-10.6} rx={9} ry={1.8} fill="#4a5361" />
      <rect x={-48} y={-26} width={4.5} height={16} fill="#3a434f" />
      <rect x={-48} y={-26} width={4.5} height={16} fill="url(#pd-metal)" />
      <g transform="translate(-68,-56) skewY(6)">
        <rect x={-0.5} y={-0.5} width={41} height={29} rx={3} fill="#0d1117" />
        <rect x={0} y={0} width={40} height={28} rx={2.5} fill="#1f2630" />
        <rect x={0} y={0} width={40} height={28} rx={2.5} fill="url(#pd-metal)" opacity={0.5} />
        <Screen mode={mode} />
        <path d="M2.5 2.5 L22 2.5 L2.5 18 Z" fill="#ffffff" opacity={0.07} />
        {mode === 'arca' && <rect className="scr-glow-red" x={-3} y={-3} width={46} height={34} rx={4} fill="none" stroke="#ff4d5e" strokeWidth={2} />}
        {mode === 'mini' && <rect className="scr-glow" x={-3} y={-3} width={46} height={34} rx={4} fill="none" stroke="#6ef0a4" strokeWidth={2} />}
      </g>
      {token && (
        <g transform="translate(-30,-34)">
          <rect x={0} y={0} width={9} height={5} rx={1.5} fill="#2b2b2b" />
          <rect x={-3} y={1.3} width={3} height={2.4} fill="#c0c6cf" />
          <circle className="led-blink" cx={6.5} cy={2.5} r={1} fill="#4cff7a" />
        </g>
      )}
    </g>
  );
}

function Papers({ n }: { n: number }) {
  if (n <= 0) return null;
  const sheets = Math.min(8, n);
  return (
    <g className="papers">
      {Array.from({ length: sheets }, (_, i) => (
        <rect key={i} x={30 + ((i * 7) % 5) - 2} y={-14.5 - i * 3} width={27} height={3.2} rx={0.6} fill={i % 3 === 2 ? '#f3ecd9' : '#ffffff'} stroke="#c9c2b2" strokeWidth={0.6} />
      ))}
      {n > 5 && (
        <g>
          <rect x={30} y={-16 - sheets * 3} width={27} height={4.2} rx={0.8} fill="#d6453d" />
          <text x={43.5} y={-12.6 - sheets * 3} textAnchor="middle" fontSize={3.6} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">
            URGENTE
          </text>
        </g>
      )}
    </g>
  );
}

const Mate = () => (
  <g>
    <g className="steam" stroke="#ffffff" strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.7}>
      <path d="M8 -40 Q6 -44 8 -48" />
      <path d="M12 -41 Q10 -45 12 -49" />
    </g>
    <line x1={11.5} y1={-35} x2={4} y2={-46} stroke="#c9ced6" strokeWidth={1.6} strokeLinecap="round" />
    <ellipse cx={10} cy={-29} rx={6.2} ry={7.2} fill="#8b5a2b" />
    <ellipse cx={10} cy={-29} rx={6.2} ry={7.2} fill="url(#pd-skinShade)" />
    <rect x={4} y={-33} width={12} height={2.6} fill="#c9a24a" />
    <ellipse cx={10} cy={-35.3} rx={4.6} ry={1.6} fill="#6b8e23" />
  </g>
);

/** Brazos según pose. sleeve = color de ropa. */
function Arms({ status, a }: { status: WorkerStatus; a: Avatar }) {
  const sleeve = a.ropa;
  const arm = { stroke: sleeve, strokeWidth: 8, strokeLinecap: 'round' as const, fill: 'none' };
  const hand = (x: number, y: number, k?: string) => (
    <g key={k} className="hand">
      <circle cx={x} cy={y} r={4.6} fill={a.piel} />
      <circle cx={x} cy={y} r={4.6} fill="url(#pd-skinShade)" />
    </g>
  );
  switch (status) {
    case 'trabajando':
    case 'minijuego':
      return (
        <g className="arms typing">
          <path d="M-18 -42 Q-26 -24 -11 -11" {...arm} />
          <path d="M18 -42 Q26 -24 11 -11" {...arm} />
          <g className="hand-l">{hand(-11, -10.5)}</g>
          <g className="hand-r">{hand(11, -10.5)}</g>
        </g>
      );
    case 'ocioso':
      return (
        <g className="arms">
          <path d="M-18 -42 Q-26 -24 -11 -11" {...arm} />
          {hand(-11, -10.5)}
          <line x1={18} y1={-44} x2={22} y2={-18} {...arm} />
          <g className="sip">
            <line x1={22} y1={-18} x2={10} y2={-24} {...arm} strokeWidth={7.5} />
            <Mate />
            {hand(10.5, -23.5)}
          </g>
        </g>
      );
    case 'esperando':
      return (
        <g className="arms">
          <path d="M-18 -42 Q-26 -22 -7 -28" {...arm} />
          <path d="M18 -42 Q26 -22 7 -28" {...arm} />
          <rect x={-6.5} y={-44} width={13} height={20} rx={2.2} fill="#1d1f24" />
          <rect x={-5} y={-42.2} width={10} height={15} rx={1} fill="#9fdcff" className="phone-glow" />
          <circle className="thumb" cx={2} cy={-34} r={1.2} fill="#ffffff" opacity={0.9} />
          {hand(-6.5, -28)}
          {hand(6.5, -28)}
        </g>
      );
    case 'networking':
      return (
        <g className="arms">
          <g className="gesture">
            <path d="M-18 -42 Q-28 -24 -14 -16" {...arm} />
            {hand(-14, -15)}
          </g>
          <path d="M18 -42 Q30 -34 19 -58" {...arm} />
          <rect x={15} y={-75} width={7.5} height={17} rx={2} fill="#1d1f24" transform="rotate(12 18 -66)" />
          {hand(19, -59)}
          <g className="talk" stroke="#ffffff" strokeWidth={1.6} fill="none" strokeLinecap="round">
            <path d="M-24 -66 Q-28 -60 -24 -54" />
            <path d="M-30 -69 Q-36 -60 -30 -51" />
          </g>
        </g>
      );
    case 'estudiando':
      return (
        <g className="arms">
          <path d="M-18 -42 Q-26 -24 -15 -27" {...arm} />
          <path d="M18 -42 Q26 -24 15 -27" {...arm} />
          <g>
            <polygon points="-17,-41 0,-37 0,-20 -17,-24" fill="#2f6fb5" />
            <polygon points="17,-41 0,-37 0,-20 17,-24" fill="#2f6fb5" />
            <polygon points="-15.5,-40 0,-36.4 0,-21.4 -15.5,-25" fill="#fbf7ee" />
            <polygon points="15.5,-40 0,-36.4 0,-21.4 15.5,-25" fill="#f3ecd9" />
            <g stroke="#c9c2b2" strokeWidth={0.7}>
              <line x1={-13} y1={-35} x2={-3} y2={-33} />
              <line x1={-13} y1={-31} x2={-3} y2={-29} />
              <line x1={3} y1={-33} x2={13} y2={-35} />
              <line x1={3} y1={-29} x2={13} y2={-31} />
            </g>
            <polygon className="page" points="15.5,-40 0,-36.4 0,-21.4 15.5,-25" fill="#fffdf7" style={{ transformOrigin: '0px -29px' }} />
          </g>
          {hand(-15, -27)}
          {hand(15, -27)}
        </g>
      );
    case 'descansando':
      return (
        <g className="arms">
          <path d="M-18 -42 Q-26 -24 -11 -11" {...arm} />
          {hand(-11, -10.5)}
          <path d="M18 -42 Q28 -24 12 -28" {...arm} />
          <g>
            <rect x={5} y={-40} width={11} height={12} rx={1.6} fill="#f4f1ea" stroke="#c9c2b2" strokeWidth={0.8} />
            <path d="M16 -37 Q20.5 -34 16 -31" fill="none" stroke="#c9c2b2" strokeWidth={1.4} />
            <rect x={5} y={-40} width={11} height={2.4} fill="#7a4a2b" />
            <g className="steam" stroke="#ffffff" strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.85}>
              <path d="M8 -44 Q6 -48 8 -52" />
              <path d="M12 -45 Q10 -49 12 -53" />
            </g>
          </g>
          {hand(10.5, -29)}
        </g>
      );
    case 'agotado':
      return (
        <g className="arms">
          <rect x={-26} y={-22} width={52} height={11} rx={5.5} fill={sleeve} />
          {hand(-22, -16, 'l')}
          {hand(22, -16, 'r')}
        </g>
      );
  }
}

/** Silla: de madera en casa; giratoria con base de 5 patas y ruedas en oficinas. */
function Chair({ color, style, player }: { color: string; style: DeskStyle; player: boolean }) {
  const w = player ? 28 : 24;
  const top = player ? -88 : -78;
  const h = player ? 82 : 70;
  if (style === 'home' && !player) {
    return (
      <g>
        <rect x={-w} y={top} width={w * 2} height={h} rx={8} fill={color} />
        <rect x={-w} y={top} width={w * 2} height={h} rx={8} fill="url(#pd-wood)" />
        <rect x={-w} y={top} width={w * 2} height={h} rx={8} fill="url(#pd-cloth)" />
        {[-12, 0, 12].map((dx) => (
          <rect key={dx} x={dx - 2} y={top + 8} width={4} height={h - 20} rx={2} fill="#000" opacity={0.12} />
        ))}
      </g>
    );
  }
  return (
    <g>
      {/* base de 5 patas y ruedas (asoma debajo del escritorio) */}
      <g transform="translate(0,44)">
        <rect x={-2.5} y={-18} width={5} height={14} fill="#3a4049" />
        <rect x={-2.5} y={-18} width={5} height={14} fill="url(#pd-metal)" />
        <path d="M-30 2 L-14 -4 L0 -4 L14 -4 L30 2" stroke="#3a4049" strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M-20 0 L0 -4 L20 0" stroke="#4a515b" strokeWidth={3} fill="none" strokeLinecap="round" />
        {[-30, -14, 14, 30].map((dx) => (
          <circle key={dx} cx={dx} cy={3} r={3} fill="#1e2228" />
        ))}
      </g>
      {/* respaldo */}
      <rect x={-w} y={top} width={w * 2} height={h} rx={12} fill={shade(color, -0.2)} />
      <rect x={-w + 3} y={top + 3} width={w * 2 - 6} height={h - 6} rx={10} fill={color} />
      <rect x={-w + 3} y={top + 3} width={w * 2 - 6} height={h - 6} rx={10} fill="url(#pd-fabric)" />
      <rect x={-w + 3} y={top + 3} width={w * 2 - 6} height={h - 6} rx={10} fill="url(#pd-cloth)" />
      <path d={`M${-w + 8} ${top + 14} Q0 ${top + 10} ${w - 8} ${top + 14}`} stroke="#fff" strokeOpacity={0.18} strokeWidth={2} fill="none" />
      {/* apoyabrazos */}
      <rect x={-w - 4} y={-26} width={7} height={5} rx={2.5} fill={shade(color, -0.3)} />
      <rect x={w - 3} y={-26} width={7} height={5} rx={2.5} fill={shade(color, -0.3)} />
    </g>
  );
}

/** Trabajador sentado en su escritorio. Origen: borde frontal de la tapa del escritorio. */
export const SeatedWorker = memo(function SeatedWorker(p: SeatedWorkerProps) {
  const { avatar: a, status } = p;
  const mood = moodFor(status, p.estres, p.moral);
  const desk = p.isPlayer && p.deskStyle !== 'home' ? PLAYER_DESK : DESK[p.deskStyle];
  const chairColor = p.isPlayer ? PLAYER_DESK.chair : desk.chair;
  const asleep = status === 'agotado';
  const headY = asleep ? -34 : status === 'esperando' || status === 'estudiando' ? -64 : -66;
  const scale = p.isPlayer ? p.s * 1.04 : p.s;
  const glowFace = p.dark || p.screen === 'off' || p.screen === 'sleep' || asleep ? null : p.screen === 'arca' ? 'red' : p.screen === 'mini' ? 'green' : 'blue';
  return (
    <g transform={`translate(${p.x},${p.y}) scale(${scale})`} className={`worker st-${status}${p.isPlayer ? ' is-player' : ''}`}>
      <Chair color={chairColor} style={p.deskStyle} player={p.isPlayer} />
      <g className={asleep ? 'body slump' : 'body'}>
        <g transform={asleep ? 'translate(0,6)' : undefined}>
          <path d="M-21 -10 L-21 -38 Q-21 -47 -11 -48 L11 -48 Q21 -47 21 -38 L21 -10 Z" fill={a.ropa} />
          <path d="M-21 -10 L-21 -38 Q-21 -47 -11 -48 L11 -48 Q21 -47 21 -38 L21 -10 Z" fill="url(#pd-cloth)" />
          {/* pliegues */}
          <path d="M-12 -24 Q-10 -18 -13 -11 M10 -26 Q13 -19 11 -11" stroke="#000" strokeOpacity={0.16} strokeWidth={1} fill="none" strokeLinecap="round" />
          <path d="M-21 -30 Q-21 -24 -17 -20 L-17 -10 L-21 -10 Z" fill={shade(a.ropa, -0.12)} />
          {p.isPlayer ? (
            <g>
              <path d="M-7 -48 L0 -36 L7 -48 Z" fill="#ffffff" />
              <path d="M-2 -46 L2 -46 L3 -30 L0 -26 L-3 -30 Z" fill="#b8323f" />
            </g>
          ) : (
            <path d="M-6 -48 L0 -41 L6 -48 Z" fill={shade(a.ropa, 0.55)} />
          )}
          {!asleep && <rect x={-4.5} y={-54} width={9} height={8} fill={shade(a.piel, -0.12)} />}
        </g>
        {/* sombra de la cabeza sobre el torso */}
        {!asleep && <ellipse cx={1} cy={headY + 19} rx={13} ry={4.5} fill="#000" opacity={0.2} />}
        <g className="headwrap" transform={`translate(${asleep ? 3 : 0},${headY})${asleep ? ' rotate(14)' : ''}`}>
          <g className={status === 'trabajando' || status === 'minijuego' ? 'bob' : status === 'networking' ? 'nod' : undefined}>
            <Head a={a} mood={mood} />
            {/* luz del monitor sobre la cara */}
            {glowFace && <path d="M-15 -6 Q-9 14 0 15 Q-4 2 -3 -12 Z" fill={glowFace === 'red' ? '#ff6a6a' : glowFace === 'green' ? '#8af0b0' : '#9fd4ff'} opacity={0.2} />}
            {status === 'esperando' && <ellipse cx={0} cy={8} rx={11} ry={7} fill="#9fdcff" opacity={0.18} />}
            {p.estres > 90 && <circle r={16} fill="#ff3b3b" opacity={0.28} />}
          </g>
        </g>
      </g>
      <Desk style={p.deskStyle} player={p.isPlayer} nombre={p.nombre} />
      <Monitor mode={p.screen} token={p.token} />
      {status !== 'trabajando' && status !== 'minijuego' && status !== 'ocioso' && status !== 'descansando' && status !== 'agotado' && (
        <g>
          <rect x={-16} y={-11} width={32} height={5} rx={1} fill="#e3e6ea" stroke="#b9bec6" strokeWidth={0.6} />
        </g>
      )}
      {(status === 'trabajando' || status === 'minijuego') && <polygon points="-16,-11 16,-11 17,-6 -17,-6" fill="#e3e6ea" stroke="#b9bec6" strokeWidth={0.6} />}
      {status !== 'ocioso' && status !== 'descansando' && (
        <g>
          <rect x={-60} y={-21} width={8} height={10} rx={1.5} fill={p.isPlayer ? '#8b5a2b' : '#e9e4da'} stroke="#b9ae98" strokeWidth={0.6} />
          {p.isPlayer && <ellipse cx={-56} cy={-21} rx={3.6} ry={1.2} fill="#6b8e23" />}
        </g>
      )}
      <Papers n={p.papers} />
      <Arms status={status} a={a} />
      {/* indicadores */}
      {asleep && (
        <g className="zzz" fontFamily="system-ui, sans-serif" fontWeight={900} fill="#5b7fb0">
          <text x={18} y={-52} fontSize={11}>Z</text>
          <text x={26} y={-64} fontSize={9}>z</text>
          <text x={32} y={-74} fontSize={7}>z</text>
        </g>
      )}
      {p.estres > 70 && !asleep && <path className="sweat" d="M15 -84 Q12 -79 15 -77 Q18 -79 15 -84 Z" fill="#7cc6ff" stroke="#3a92d6" strokeWidth={0.6} />}
      {p.estres > 90 && !asleep && (
        <g className="steam-head" fill="#ffffff" opacity={0.85}>
          <circle cx={-9} cy={-90} r={4} />
          <circle cx={9} cy={-92} r={3.4} />
        </g>
      )}
      {status === 'esperando' && (
        <g className="dots" transform="translate(22,-92)">
          <rect x={-2} y={-9} width={26} height={14} rx={7} fill="#ffffff" stroke="#c9c2b2" strokeWidth={0.8} />
          <circle className="d1" cx={5} cy={-2} r={2} fill="#7b8591" />
          <circle className="d2" cx={11} cy={-2} r={2} fill="#7b8591" />
          <circle className="d3" cx={17} cy={-2} r={2} fill="#7b8591" />
        </g>
      )}
      <rect
        className="hit"
        x={-50}
        y={-94}
        width={100}
        height={140}
        fill="transparent"
        onClick={() => p.onClick?.(p.id)}
        onPointerEnter={() => p.onHover?.(p.id)}
        onPointerLeave={() => p.onHover?.(null)}
      />
    </g>
  );
});

// ----------------------------------------------------------------------------- personas de pie

export const INSPECTOR_AVATAR: Avatar = { piel: '#e6b48e', pelo: '#5e5e66', peinado: 'corto', ropa: '#5f6874', anteojos: true, barba: false };

/** Persona de pie. Origen: entre los pies. */
export function StandingPerson({ a, carry = 'folder', walking = false }: { a: Avatar; carry?: 'folder' | 'briefcase' | 'none'; walking?: boolean }) {
  const pants = shade(a.ropa, -0.45);
  const inspector = carry === 'briefcase';
  return (
    <g className={walking ? 'person walking' : 'person'}>
      <Shadow x={0} y={1} rx={22} ry={5} />
      <g className="leg leg-l" style={{ transformOrigin: '-6px -42px' }}>
        <rect x={-10.5} y={-42} width={9} height={40} rx={3} fill={pants} />
        <ellipse cx={-6.5} cy={-1.5} rx={7} ry={3.4} fill="#2b2622" />
      </g>
      <g className="leg leg-r" style={{ transformOrigin: '6px -42px' }}>
        <rect x={1.5} y={-42} width={9} height={40} rx={3} fill={pants} />
        <ellipse cx={6.5} cy={-1.5} rx={7} ry={3.4} fill="#2b2622" />
      </g>
      <path d="M-17 -40 L-17 -70 Q-17 -79 -8 -80 L8 -80 Q17 -79 17 -70 L17 -40 Z" fill={a.ropa} />
      <path d="M-17 -40 L-17 -70 Q-17 -79 -8 -80 L8 -80 Q17 -79 17 -70 L17 -40 Z" fill="url(#pd-cloth)" />
      {inspector ? (
        <g>
          <path d="M-6 -80 L0 -66 L6 -80 Z" fill="#ffffff" />
          <path d="M-1.8 -78 L1.8 -78 L2.6 -60 L0 -56 L-2.6 -60 Z" fill="#20314d" />
          <rect x={-14} y={-66} width={10} height={13} rx={1.4} fill="#ffffff" stroke="#9aa3ad" strokeWidth={0.6} />
          <rect x={-14} y={-66} width={10} height={3.6} fill="#0d4c8b" />
          <text x={-9} y={-55.6} textAnchor="middle" fontSize={3.4} fontWeight={900} fill="#0d4c8b" fontFamily="system-ui, sans-serif">ARCA</text>
        </g>
      ) : (
        <path d="M-5 -80 L0 -74 L5 -80 Z" fill={shade(a.ropa, 0.55)} />
      )}
      <rect x={-4} y={-86} width={8} height={7} fill={shade(a.piel, -0.12)} />
      <line x1={-16} y1={-74} x2={-19} y2={-46} stroke={a.ropa} strokeWidth={7} strokeLinecap="round" />
      <circle cx={-19} cy={-44} r={4.2} fill={a.piel} />
      <line x1={16} y1={-74} x2={19} y2={-46} stroke={a.ropa} strokeWidth={7} strokeLinecap="round" />
      {carry === 'folder' && (
        <g>
          <rect x={14} y={-60} width={16} height={21} rx={1.5} fill="#e2b85a" stroke="#b68b2e" strokeWidth={0.8} />
          <rect x={14} y={-60} width={16} height={4} fill="#c99a3b" />
        </g>
      )}
      {inspector && (
        <g>
          <rect x={12} y={-42} width={24} height={17} rx={2} fill="#2c2420" />
          <path d="M19 -42 L19 -46 L29 -46 L29 -42" fill="none" stroke="#2c2420" strokeWidth={2} />
          <rect x={22} y={-36} width={4} height={2.4} fill="#c9a24a" />
        </g>
      )}
      <circle cx={19} cy={-44} r={4.2} fill={a.piel} />
      <g transform="translate(0,-102)">
        <Head a={a} mood={inspector ? 'neutral' : 'feliz'} />
      </g>
    </g>
  );
}

/** Inspector sentado en la sala de espera. Origen: base de la silla en el piso. */
export function SeatedInspector() {
  const a = INSPECTOR_AVATAR;
  const pants = shade(a.ropa, -0.45);
  return (
    <g className="inspector-seated">
      <Shadow x={0} y={1} rx={30} ry={5} />
      <rect x={-22} y={-92} width={44} height={56} rx={8} fill="#7c5a3c" />
      <rect x={-22} y={-92} width={44} height={56} rx={8} fill="url(#pd-cloth)" />
      <rect x={-24} y={-40} width={48} height={8} rx={3} fill="#8d6847" />
      <rect x={-20} y={-32} width={4} height={32} fill="#5b4029" />
      <rect x={16} y={-32} width={4} height={32} fill="#5b4029" />
      <path d="M-17 -38 L-17 -66 Q-17 -75 -8 -76 L8 -76 Q17 -75 17 -66 L17 -38 Z" fill={a.ropa} />
      <path d="M-17 -38 L-17 -66 Q-17 -75 -8 -76 L8 -76 Q17 -75 17 -66 L17 -38 Z" fill="url(#pd-cloth)" />
      <path d="M-6 -76 L0 -62 L6 -76 Z" fill="#ffffff" />
      <path d="M-1.8 -74 L1.8 -74 L2.6 -56 L0 -52 L-2.6 -56 Z" fill="#20314d" />
      <rect x={-14} y={-62} width={10} height={13} rx={1.4} fill="#ffffff" stroke="#9aa3ad" strokeWidth={0.6} />
      <rect x={-14} y={-62} width={10} height={3.6} fill="#0d4c8b" />
      <text x={-9} y={-51.6} textAnchor="middle" fontSize={3.4} fontWeight={900} fill="#0d4c8b" fontFamily="system-ui, sans-serif">ARCA</text>
      <rect x={-13} y={-38} width={10} height={12} rx={4} fill={pants} />
      <rect x={3} y={-38} width={10} height={12} rx={4} fill={pants} />
      <rect x={-12} y={-28} width={8} height={26} rx={3} fill={pants} />
      <g className="foot-tap" style={{ transformOrigin: '8px -2px' }}>
        <rect x={4} y={-28} width={8} height={26} rx={3} fill={pants} />
        <ellipse cx={9} cy={-1.5} rx={6.4} ry={3.2} fill="#2b2622" />
      </g>
      <ellipse cx={-8} cy={-1.5} rx={6.4} ry={3.2} fill="#2b2622" />
      <line x1={-16} y1={-70} x2={-12} y2={-44} stroke={a.ropa} strokeWidth={7} strokeLinecap="round" />
      <line x1={16} y1={-70} x2={12} y2={-44} stroke={a.ropa} strokeWidth={7} strokeLinecap="round" />
      <rect x={-16} y={-46} width={32} height={9} rx={2} fill="#2c2420" />
      <circle cx={-11} cy={-42} r={4} fill={a.piel} />
      <circle cx={11} cy={-42} r={4} fill={a.piel} />
      <g transform="translate(0,-96)">
        <Head a={a} mood="neutral" />
      </g>
      <g transform="translate(18,-124)">
        <rect x={-2} y={-11} width={44} height={16} rx={8} fill="#ffffff" stroke="#9aa3ad" strokeWidth={0.8} />
        <text x={20} y={0.6} textAnchor="middle" fontSize={8.4} fontWeight={900} fill="#0d4c8b" fontFamily="system-ui, sans-serif">F.8000</text>
      </g>
    </g>
  );
}
