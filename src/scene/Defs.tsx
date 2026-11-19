// Definiciones gráficas compartidas (gradientes, patrones, filtros) para el look semi-realista.
// Se declaran una sola vez por <svg>. Ids fijos: `pd-*`.
import { memo } from 'react';

/** Sombreado de piel y ropa (volumen de los personajes). Lo usan la escena y AvatarFace. */
export const SkinDefs = memo(function SkinDefs() {
  return (
    <defs>
      {/* luz desde arriba-izquierda sobre una esfera */}
      <radialGradient id="pd-skinShade" cx="0.38" cy="0.32" r="0.78">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="1" stopColor="#3a1f10" stopOpacity={0.28} />
      </radialGradient>
      <radialGradient id="pd-hairShine" cx="0.4" cy="0.2" r="0.7">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.26} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.3} />
      </radialGradient>
      {/* torso: lado izquierdo iluminado, derecho en sombra */}
      <linearGradient id="pd-cloth" x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.16} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.26} />
      </linearGradient>
    </defs>
  );
});

/** Materiales y luces de la oficina. */
export const SceneDefs = memo(function SceneDefs() {
  return (
    <defs>
      {/* sombra de contacto suave (elipse) */}
      <radialGradient id="pd-shadow">
        <stop offset="0" stopColor="#1a1208" stopOpacity={0.42} />
        <stop offset="0.55" stopColor="#1a1208" stopOpacity={0.2} />
        <stop offset="1" stopColor="#1a1208" stopOpacity={0} />
      </radialGradient>
      {/* veta de madera: franjas finas semitransparentes */}
      <pattern id="pd-wood" width="160" height="14" patternUnits="userSpaceOnUse">
        <rect width="160" height="14" fill="transparent" />
        <path d="M0 3 Q40 1 80 3 T160 3" stroke="#000" strokeOpacity={0.07} strokeWidth={1} fill="none" />
        <path d="M0 9 Q50 11 100 8 T160 9" stroke="#000" strokeOpacity={0.05} strokeWidth={0.8} fill="none" />
        <path d="M20 6 Q60 5 110 6.5" stroke="#fff" strokeOpacity={0.08} strokeWidth={0.8} fill="none" />
      </pattern>
      {/* estuco: puntitos irregulares */}
      <pattern id="pd-plaster" width="37" height="31" patternUnits="userSpaceOnUse">
        <rect width="37" height="31" fill="transparent" />
        <circle cx="4" cy="6" r="0.9" fill="#000" fillOpacity={0.028} />
        <circle cx="19" cy="3" r="0.7" fill="#fff" fillOpacity={0.07} />
        <circle cx="30" cy="12" r="1" fill="#000" fillOpacity={0.025} />
        <circle cx="11" cy="19" r="0.8" fill="#fff" fillOpacity={0.06} />
        <circle cx="25" cy="24" r="0.9" fill="#000" fillOpacity={0.028} />
        <circle cx="34" cy="28" r="0.6" fill="#fff" fillOpacity={0.06} />
        <circle cx="7" cy="27" r="0.7" fill="#000" fillOpacity={0.025} />
      </pattern>
      {/* tela (sillón): trama diagonal muy sutil */}
      <pattern id="pd-fabric" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="transparent" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeOpacity={0.08} strokeWidth={1.2} />
      </pattern>
      {/* luz de pared: más clara cerca del techo y hacia el centro */}
      <linearGradient id="pd-wallLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.14} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.02} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.12} />
      </linearGradient>
      {/* oclusión en los rincones laterales */}
      <linearGradient id="pd-aoLeft" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity={0.22} />
        <stop offset="1" stopColor="#000" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="pd-aoRight" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity={0.22} />
        <stop offset="1" stopColor="#000" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="pd-aoDown" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity={0.2} />
        <stop offset="1" stopColor="#000" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="pd-aoUp" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity={0.18} />
        <stop offset="1" stopColor="#000" stopOpacity={0} />
      </linearGradient>
      {/* piso: reflejo difuso (más claro hacia el frente, con brillo de la ventana) */}
      <linearGradient id="pd-floorSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity={0.1} />
        <stop offset="0.35" stopColor="#ffffff" stopOpacity={0.05} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0.1} />
      </linearGradient>
      {/* haz de luz de ventana */}
      <linearGradient id="pd-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3cf" stopOpacity={0.34} />
        <stop offset="1" stopColor="#fff3cf" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="pd-beamWall" x1="0" y1="0" x2="1" y2="0.2">
        <stop offset="0" stopColor="#fff6dc" stopOpacity={0} />
        <stop offset="0.5" stopColor="#fff6dc" stopOpacity={0.14} />
        <stop offset="1" stopColor="#fff6dc" stopOpacity={0} />
      </linearGradient>
      {/* reflejo de la ventana en el piso */}
      <linearGradient id="pd-floorReflect" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
      </linearGradient>
      {/* luz cálida de lámpara */}
      <radialGradient id="pd-lamp">
        <stop offset="0" stopColor="#ffe3a1" stopOpacity={0.6} />
        <stop offset="0.4" stopColor="#ffd98a" stopOpacity={0.22} />
        <stop offset="1" stopColor="#ffd98a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="pd-lampPool" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffdc9a" stopOpacity={0.26} />
        <stop offset="1" stopColor="#ffdc9a" stopOpacity={0} />
      </radialGradient>
      {/* resplandor azul del monitor */}
      <radialGradient id="pd-monGlow">
        <stop offset="0" stopColor="#9fd4ff" stopOpacity={0.34} />
        <stop offset="1" stopColor="#9fd4ff" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="pd-monGlowRed">
        <stop offset="0" stopColor="#ff6a6a" stopOpacity={0.34} />
        <stop offset="1" stopColor="#ff6a6a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="pd-monGlowGreen">
        <stop offset="0" stopColor="#8af0b0" stopOpacity={0.3} />
        <stop offset="1" stopColor="#8af0b0" stopOpacity={0} />
      </radialGradient>
      {/* vidrio: reflejo diagonal */}
      <linearGradient id="pd-glassRef" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.3} />
        <stop offset="0.35" stopColor="#ffffff" stopOpacity={0.03} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.18} />
        <stop offset="0.62" stopColor="#ffffff" stopOpacity={0.02} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0.1} />
      </linearGradient>
      {/* metal cepillado */}
      <linearGradient id="pd-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.05} />
        <stop offset="0.25" stopColor="#ffffff" stopOpacity={0.22} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.04} />
        <stop offset="0.8" stopColor="#000000" stopOpacity={0.14} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.24} />
      </linearGradient>
      {/* bisel de tapa de escritorio */}
      <linearGradient id="pd-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.3} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.06} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.14} />
      </linearGradient>
      <linearGradient id="pd-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity={0.12} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.34} />
      </linearGradient>
      {/* sol y luna */}
      <radialGradient id="pd-sunHalo">
        <stop offset="0" stopColor="#fff6c8" stopOpacity={0.95} />
        <stop offset="0.35" stopColor="#ffe9a0" stopOpacity={0.45} />
        <stop offset="1" stopColor="#ffe9a0" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="pd-moonHalo">
        <stop offset="0" stopColor="#fff8dc" stopOpacity={0.6} />
        <stop offset="1" stopColor="#fff8dc" stopOpacity={0} />
      </radialGradient>
      <linearGradient id="pd-cloud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#cfd9e3" />
      </linearGradient>
      {/* desenfoque leve del exterior (solo elementos estáticos) */}
      <filter id="pd-blur" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="0.7" />
      </filter>
      {/* vidrio de la sala: tinte + reflejo */}
      <linearGradient id="pd-glassTint" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#dff0f7" stopOpacity={0.55} />
        <stop offset="0.45" stopColor="#dff0f7" stopOpacity={0.28} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.45} />
        <stop offset="0.56" stopColor="#dff0f7" stopOpacity={0.28} />
        <stop offset="1" stopColor="#c9e0ea" stopOpacity={0.5} />
      </linearGradient>
      {/* cielo de la ventana con tono gris de lluvia */}
      <linearGradient id="pd-rainTint" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6c7684" stopOpacity={0.55} />
        <stop offset="1" stopColor="#9aa4ae" stopOpacity={0.4} />
      </linearGradient>
    </defs>
  );
});

/** Sombra de contacto suave. */
export function Shadow({ x, y, rx, ry, o = 1 }: { x: number; y: number; rx: number; ry: number; o?: number }) {
  return <ellipse cx={x + rx * 0.08} cy={y} rx={rx} ry={ry} fill="url(#pd-shadow)" opacity={o} />;
}
