// Dibujo de personajes: cabeza reutilizable (escena y retratos) + retrato AvatarFace.
import { memo } from 'react';
import type { Avatar } from '../engine/types';
import { SkinDefs } from './Defs';
import { shade } from './util';

export type Mood = 'feliz' | 'neutral' | 'triste' | 'estres' | 'dormido' | 'sorpresa';

/** Pelo que va DETRÁS de la cabeza (largo, rulos, rodete). Coordenadas: cabeza r=16 centrada en 0,0. */
function HairBack({ a }: { a: Avatar }) {
  switch (a.peinado) {
    case 'largo':
      return <path d="M-18.5 -3 C-21 -24 21 -24 18.5 -3 L19.5 22 Q10 27 0 26 Q-10 27 -19.5 22 Z" fill={a.pelo} />;
    case 'rulos':
      return (
        <g fill={a.pelo}>
          {[
            [-18, 0],
            [18, 0],
            [-18.5, 9],
            [18.5, 9],
            [-15, 16],
            [15, 16],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5.6} />
          ))}
        </g>
      );
    case 'rodete':
      return <circle cx={0} cy={-21} r={7.5} fill={a.pelo} />;
    default:
      return null;
  }
}

function HairFront({ a }: { a: Avatar }) {
  const hi = shade(a.pelo, 0.18);
  switch (a.peinado) {
    case 'corto':
      return (
        <g>
          <path d="M-16.6 -1 C-18.4 -15 -9 -21.5 0 -21.5 C9 -21.5 18.4 -15 16.6 -1 C15.2 -8 12 -11.5 7 -12.4 C3 -9.4 -6 -9.6 -11 -11.6 C-14 -9.4 -15.6 -6 -16.6 -1 Z" fill={a.pelo} />
          <path d="M-8 -18 Q-2 -20 4 -18.6" stroke={hi} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      );
    case 'flequillo':
      return (
        <g>
          <path d="M-17.2 3 C-18.8 -15 -9 -21.8 0 -21.8 C9 -21.8 18.8 -15 17.2 3 L15.4 -5.4 Q8 -3.6 0 -4.6 Q-8 -3.6 -15.4 -5.4 Z" fill={a.pelo} />
          <path d="M-9 -17.5 Q-3 -19.6 3 -18.4" stroke={hi} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      );
    case 'largo':
      return (
        <g>
          <path d="M-17.4 6 C-19.6 -15 -8 -21.6 1 -21.6 C10 -21.6 19.6 -14 17.4 6 C16 -5 11 -12 2.5 -12.6 C-1 -8.4 -9.6 -5.4 -15 -1.4 Z" fill={a.pelo} />
          <path d="M-6 -18.6 Q1 -20.6 7 -18.4" stroke={hi} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      );
    case 'rodete':
      return (
        <g>
          <path d="M-16.2 -2.5 C-17.4 -16 -8 -20.8 0 -20.8 C8 -20.8 17.4 -16 16.2 -2.5 C13.4 -10.6 7 -13.2 0 -13.2 C-7 -13.2 -13.4 -10.6 -16.2 -2.5 Z" fill={a.pelo} />
          <path d="M-5 -25 Q0 -27 5 -25" stroke={hi} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      );
    case 'pelado':
      return (
        <g>
          <path d="M-16.6 0 Q-17.4 -8.6 -13.4 -11.4 Q-14.6 -5.4 -13.2 0.6 Z" fill={a.pelo} />
          <path d="M16.6 0 Q17.4 -8.6 13.4 -11.4 Q14.6 -5.4 13.2 0.6 Z" fill={a.pelo} />
          <ellipse cx={-5} cy={-11} rx={5} ry={2.6} fill="#ffffff" opacity={0.32} transform="rotate(-20 -5 -11)" />
        </g>
      );
    case 'rulos':
      return (
        <g fill={a.pelo}>
          <path d="M-16.4 -1 C-18 -15 -9 -21 0 -21 C9 -21 18 -15 16.4 -1 C14 -9 8 -11 0 -11 C-8 -11 -14 -9 -16.4 -1 Z" />
          {[200, 222, 245, 268, 291, 314, 337].map((deg, i) => {
            const r = (deg * Math.PI) / 180;
            return <circle key={i} cx={Math.cos(r) * 15.4} cy={Math.sin(r) * 15.4 - 1} r={5.4} />;
          })}
        </g>
      );
  }
}

/** Brillo y sombra del pelo (volumen) encima de la forma del peinado. */
function HairShine({ a }: { a: Avatar }) {
  if (a.peinado === 'pelado') return null;
  return (
    <g pointerEvents="none">
      <path d="M-16.4 -1 C-18 -15 -9 -21 0 -21 C9 -21 18 -15 16.4 -1 L12 -4 Q0 -13 -12 -4 Z" fill="url(#pd-hairShine)" />
      <path d="M-9 -16 Q-4 -19.5 2 -18.6" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.22} />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  const p = { stroke: '#7a3b2e', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const };
  switch (mood) {
    case 'feliz':
      return <path d="M-5 8.2 Q0 13.4 5 8.2" {...p} />;
    case 'triste':
      return <path d="M-4.6 11.6 Q0 7.6 4.6 11.6" {...p} />;
    case 'estres':
      return <path d="M-5 10.4 Q-2.5 8.2 0 10.4 Q2.5 12.6 5 10.4" {...p} />;
    case 'dormido':
      return <ellipse cx={0} cy={10.4} rx={1.8} ry={1.4} fill="#7a3b2e" />;
    case 'sorpresa':
      return <ellipse cx={0} cy={10.4} rx={2.4} ry={3} fill="#7a3b2e" />;
    default:
      return <path d="M-3.8 9.8 Q0 11 3.8 9.8" {...p} />;
  }
}

/** Cabeza r=16 centrada en (0,0). */
export const Head = memo(function Head({ a, mood = 'neutral', blink = true }: { a: Avatar; mood?: Mood; blink?: boolean }) {
  const skinShadow = shade(a.piel, -0.12);
  const closed = mood === 'dormido';
  const browY = mood === 'estres' || mood === 'triste' ? -5.4 : mood === 'sorpresa' ? -7.6 : -6.2;
  const browTilt = mood === 'estres' ? 1.6 : mood === 'triste' ? -1.4 : 0;
  return (
    <g className="head">
      <HairBack a={a} />
      <circle cx={-15.6} cy={2.4} r={3.6} fill={a.piel} />
      <circle cx={15.6} cy={2.4} r={3.6} fill={a.piel} />
      <circle r={16} fill={a.piel} />
      <circle r={16} fill="url(#pd-skinShade)" />
      <path d="M-14 8 Q0 22 14 8 Q10 16 0 16.4 Q-10 16 -14 8 Z" fill={skinShadow} opacity={0.35} />
      {/* sombra bajo el pelo / frente y pómulos */}
      <path d="M-13 -4 Q0 -1 13 -4 Q10 -7 0 -8 Q-10 -7 -13 -4 Z" fill={skinShadow} opacity={0.22} />
      <path d="M-15 4 Q-13 10 -9 12" stroke={skinShadow} strokeWidth={1.6} fill="none" opacity={0.3} strokeLinecap="round" />
      <path d="M15 4 Q13 10 9 12" stroke={skinShadow} strokeWidth={1.6} fill="none" opacity={0.45} strokeLinecap="round" />
      <ellipse cx={-6} cy={-3} rx={6} ry={4} fill="#ffffff" opacity={0.08} />
      {a.barba && <path d="M-15.4 2 Q-15.6 17.6 0 19.6 Q15.6 17.6 15.4 2 Q11.4 9.4 6 9.8 Q0 8.2 -6 9.8 Q-11.4 9.4 -15.4 2 Z" fill={a.pelo} />}
      <circle cx={-9.6} cy={6.4} r={2.6} fill="#ff8a80" opacity={0.28} />
      <circle cx={9.6} cy={6.4} r={2.6} fill="#ff8a80" opacity={0.28} />
      {closed ? (
        <g stroke="#2a2a33" strokeWidth={1.5} fill="none" strokeLinecap="round">
          <path d="M-8 2.2 Q-5.5 4 -3 2.2" />
          <path d="M3 2.2 Q5.5 4 8 2.2" />
        </g>
      ) : (
        <g className={blink ? 'eyes blink' : 'eyes'}>
          <ellipse cx={-5.6} cy={1.6} rx={1.9} ry={2.4} fill="#2a2a33" />
          <ellipse cx={5.6} cy={1.6} rx={1.9} ry={2.4} fill="#2a2a33" />
          <circle cx={-5} cy={0.8} r={0.6} fill="#fff" />
          <circle cx={6.2} cy={0.8} r={0.6} fill="#fff" />
        </g>
      )}
      <g stroke={shade(a.pelo, -0.1)} strokeWidth={1.5} strokeLinecap="round">
        <line x1={-8.4} y1={browY - browTilt} x2={-3.4} y2={browY + browTilt} />
        <line x1={3.4} y1={browY + browTilt} x2={8.4} y2={browY - browTilt} />
      </g>
      <Mouth mood={mood} />
      <HairFront a={a} />
      <HairShine a={a} />
      {a.anteojos && (
        <g stroke="#26262e" strokeWidth={1.4} fill="rgba(255,255,255,0.18)">
          <circle cx={-5.6} cy={1.6} r={4.6} />
          <circle cx={5.6} cy={1.6} r={4.6} />
          <path d="M-1 1 Q0 0 1 1" fill="none" />
          <line x1={-10.2} y1={0.8} x2={-15} y2={-0.4} />
          <line x1={10.2} y1={0.8} x2={15} y2={-0.4} />
        </g>
      )}
    </g>
  );
});

/** Torso/hombros genéricos (para retratos). */
function Shoulders({ a }: { a: Avatar }) {
  return (
    <g>
      <rect x={-4} y={13} width={8} height={7} fill={shade(a.piel, -0.12)} />
      <path d="M-21 34 Q-21 21 -9 19 L9 19 Q21 21 21 34 Z" fill={a.ropa} />
      <path d="M-21 34 Q-21 21 -9 19 L9 19 Q21 21 21 34 Z" fill="url(#pd-cloth)" />
      <path d="M-5 19 L0 25 L5 19 Z" fill={shade(a.ropa, 0.55)} />
      <path d="M-4 20 Q0 24 4 20" stroke="#000" strokeOpacity={0.2} strokeWidth={0.8} fill="none" />
    </g>
  );
}

/** Retrato SVG chico (cabeza + hombros). */
export const AvatarFace = memo(function AvatarFace({
  avatar,
  size = 40,
  mood = 'neutral',
  bg,
  title,
}: {
  avatar: Avatar;
  size?: number;
  mood?: Mood;
  /** color de fondo circular (opcional) */
  bg?: string;
  title?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="-24 -26 48 48" role="img" aria-label={title ?? 'avatar'} style={{ display: 'block', flex: 'none' }}>
      {title && <title>{title}</title>}
      <SkinDefs />
      {bg && <circle cx={0} cy={-2} r={24} fill={bg} />}
      <Shoulders a={avatar} />
      <g transform="translate(0,-2) scale(0.92)">
        <Head a={avatar} mood={mood} blink={false} />
      </g>
    </svg>
  );
});
