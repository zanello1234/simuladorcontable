// Objetos que aparecen en la oficina al comprar herramientas (progreso visible tipo SimCity).
import { memo } from 'react';
import type { ToolId } from '../engine/types';
import { Shadow } from './Defs';
import type { LevelLayout } from './layout';

const SANS = 'system-ui, -apple-system, Segoe UI, sans-serif';

function Rack({ x, y, units, erp, small }: { x: number; y: number; units: number; erp: boolean; small?: boolean }) {
  if (small) {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x={-18} y={-32} width={36} height={32} rx={3} fill="#2b313a" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={-14} y={-28 + i * 9} width={28} height={6} rx={1} fill="#3b434e" />
            <circle className={`led-blink d${i}`} cx={9} cy={-25 + i * 9} r={1.4} fill={i === 1 ? '#ffb02e' : '#44e07a'} />
          </g>
        ))}
        {erp && <rect x={-14} y={-38} width={28} height={6} rx={1} fill="#714b67" />}
      </g>
    );
  }
  const h = 126;
  return (
    <g transform={`translate(${x},${y})`}>
      <Shadow x={0} y={0} rx={34} ry={4.5} />
      <rect x={-26} y={-h} width={52} height={h} rx={3} fill="#22272e" />
      <rect x={-26} y={-h} width={52} height={h} rx={3} fill="url(#pd-metal)" />
      <rect x={-22} y={-h + 4} width={44} height={h - 8} rx={2} fill="#2c323b" />
      <rect x={-24} y={-h} width={3} height={h} fill="#ffffff" opacity={0.08} />
      {Array.from({ length: 10 }, (_, i) => {
        const on = i < units;
        return (
          <g key={i}>
            <rect x={-20} y={-h + 7 + i * 11.6} width={40} height={9} rx={1} fill={on ? '#3a424d' : '#2a3038'} />
            {on && (
              <g>
                <circle className={`led-blink d${i % 4}`} cx={12} cy={-h + 11.5 + i * 11.6} r={1.5} fill={i % 3 === 0 ? '#ffb02e' : '#44e07a'} />
                <circle className={`led-blink d${(i + 2) % 4}`} cx={16} cy={-h + 11.5 + i * 11.6} r={1.5} fill="#3fb5ff" />
                <rect x={-16} y={-h + 10 + i * 11.6} width={18} height={2.4} fill="#56606c" />
              </g>
            )}
          </g>
        );
      })}
      {erp && (
        <g>
          <rect x={-22} y={-h - 14} width={44} height={12} rx={3} fill="#714b67" />
          <text x={0} y={-h - 5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fff" fontFamily={SANS}>
            ERP
          </text>
        </g>
      )}
    </g>
  );
}

function Ups({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <Shadow x={0} y={0} rx={20} ry={4} />
      <rect x={-13} y={-40} width={26} height={40} rx={3} fill="#1f242b" />
      <rect x={-13} y={-40} width={26} height={40} rx={3} fill="url(#pd-metal)" />
      <rect x={-8} y={-34} width={16} height={8} rx={1} fill="#9de29d" />
      <text x={0} y={-28} textAnchor="middle" fontSize={5.4} fontWeight={900} fill="#1f4d1f" fontFamily={SANS}>
        100%
      </text>
      <circle className="led-blink d1" cx={0} cy={-16} r={2.4} fill="#44e07a" />
      <text x={0} y={-5} textAnchor="middle" fontSize={5} fontWeight={800} fill="#8b95a3" fontFamily={SANS}>
        UPS
      </text>
    </g>
  );
}

function Router({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1={-10} y1={-8} x2={-14} y2={-24} stroke="#2b313a" strokeWidth={2} strokeLinecap="round" />
      <line x1={10} y1={-8} x2={14} y2={-24} stroke="#2b313a" strokeWidth={2} strokeLinecap="round" />
      <rect x={-16} y={-9} width={32} height={9} rx={2} fill="#e9edf1" stroke="#b9c1ca" strokeWidth={1} />
      {[-9, -4, 1, 6].map((cx, i) => (
        <circle key={cx} className={`led-blink d${i}`} cx={cx} cy={-4.5} r={1.2} fill="#3fb5ff" />
      ))}
      <g className="cloud-sync" transform="translate(0,-40)">
        <path d="M-14 4 Q-16 -6 -6 -6 Q-2 -14 6 -10 Q14 -12 14 -2 Q18 4 10 6 L-10 6 Q-16 6 -14 4 Z" fill="#dbeeff" stroke="#7fb6e6" strokeWidth={1.2} />
        <path className="up-arrow" d="M0 2 L0 -6 M-3 -3 L0 -6 L3 -3" stroke="#2f6fb5" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Printer({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <g className="print-paper">
        <rect x={-11} y={-14} width={22} height={18} fill="#ffffff" stroke="#c9c2b2" strokeWidth={0.6} />
        <text x={0} y={-5} textAnchor="middle" fontSize={5} fontWeight={900} fill="#2f6fb5" fontFamily={SANS}>
          FC
        </text>
        <line x1={-7} y1={-1} x2={7} y2={-1} stroke="#c9c2b2" strokeWidth={0.6} />
      </g>
      <rect x={-20} y={-22} width={40} height={22} rx={3} fill="#dfe3e8" stroke="#aeb6bf" strokeWidth={1} />
      <rect x={-14} y={-26} width={28} height={5} rx={1.5} fill="#c4cad1" />
      <rect x={-16} y={-10} width={32} height={3} rx={1} fill="#2b313a" />
      <circle className="led-blink d2" cx={14} cy={-17} r={1.6} fill="#44e07a" />
    </g>
  );
}

function Tablet({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M-4 0 L4 0 L1 -8 L-1 -8 Z" fill="#5d6772" />
      <g transform="rotate(-6)">
        <rect x={-12} y={-28} width={24} height={20} rx={2.5} fill="#1f242b" />
        <rect className="tablet-glow" x={-10} y={-26} width={20} height={16} rx={1} fill="#7fd1ff" />
        <text x={0} y={-15.5} textAnchor="middle" fontSize={5} fontWeight={900} fill="#0d4c8b" fontFamily={SANS}>
          PORTAL
        </text>
      </g>
    </g>
  );
}

function Stamp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-14} y={-3} width={24} height={3} fill="#ffffff" stroke="#c9c2b2" strokeWidth={0.5} />
      <rect x={-13} y={-6} width={24} height={3} fill="#f8f6ef" stroke="#c9c2b2" strokeWidth={0.5} />
      <g className="stamp">
        <rect x={-4} y={-22} width={8} height={10} rx={2} fill="#7a4a2b" />
        <rect x={-7} y={-13} width={14} height={4} rx={1} fill="#2b313a" />
      </g>
      <text className="stamp-mark" x={-1} y={-1} textAnchor="middle" fontSize={3.4} fontWeight={900} fill="#c8414f" fontFamily={SANS}>
        PAGADO
      </text>
    </g>
  );
}

function TvBoard({ x, y }: { x: number; y: number }) {
  const bars = [0.6, 0.9, 0.4, 0.75, 0.3, 0.55];
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={2} width={100} height={60} rx={4} fill="#000" opacity={0.15} />
      <rect x={0} y={0} width={100} height={60} rx={4} fill="#151a21" />
      <rect x={4} y={4} width={92} height={52} rx={2} fill="#1d2b3a" />
      <text x={8} y={14} fontSize={6.4} fontWeight={900} fill="#e8b93a" fontFamily={SANS} letterSpacing={0.6}>
        VENCIMIENTOS
      </text>
      {bars.map((b, i) => (
        <rect
          key={i}
          className={`tv-bar d${i % 4}`}
          x={10 + i * 14}
          y={52 - 30 * b}
          width={9}
          height={30 * b}
          fill={i === 1 ? '#e23d4b' : i === 3 ? '#f0a92a' : '#35b08f'}
          style={{ transformOrigin: `${14.5 + i * 14}px 52px` }}
        />
      ))}
      <rect x={46} y={60} width={8} height={6} fill="#151a21" />
    </g>
  );
}

function CrmBoard({ x, y, standing }: { x: number; y: number; standing?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {standing && (
        <g>
          <line x1={10} y1={66} x2={4} y2={100} stroke="#8d969f" strokeWidth={2.4} />
          <line x1={78} y1={66} x2={84} y2={100} stroke="#8d969f" strokeWidth={2.4} />
        </g>
      )}
      <rect x={2} y={2} width={96} height={68} rx={3} fill="#000" opacity={0.12} />
      <rect x={0} y={0} width={96} height={68} rx={3} fill="#fbfcfd" stroke="#aeb6bf" strokeWidth={2} />
      <text x={6} y={11} fontSize={6.4} fontWeight={900} fill="#2f6fb5" fontFamily={SANS}>
        EMBUDO CLIENTES
      </text>
      <path d="M14 18 L66 18 L56 32 L24 32 Z" fill="#cfe2f6" stroke="#2f6fb5" strokeWidth={1} />
      <path d="M24 34 L56 34 L48 46 L32 46 Z" fill="#bfe6d5" stroke="#1f8a70" strokeWidth={1} />
      <path d="M32 48 L48 48 L44 58 L36 58 Z" fill="#f9dfa4" stroke="#d98e04" strokeWidth={1} />
      <rect x={72} y={18} width={16} height={14} fill="#ffe36e" transform="rotate(4 80 25)" />
      <rect x={72} y={38} width={16} height={14} fill="#ffb3c7" transform="rotate(-5 80 45)" />
    </g>
  );
}

function AiBot({ x, y, n }: { x: number; y: number; n: number }) {
  const size = 1 + (n - 1) * 0.12;
  return (
    <g transform={`translate(${x},${y}) scale(${size})`}>
      <ellipse className="ai-shadow" cx={0} cy={44} rx={16} ry={3} fill="#2f6fb5" opacity={0.18} />
      <g className="ai-float">
        <circle r={30} fill="#7fd1ff" opacity={0.12} className="ai-aura" />
        <line x1={0} y1={-18} x2={0} y2={-28} stroke="#5d6772" strokeWidth={2} />
        <circle className="led-blink d0" cx={0} cy={-30} r={3} fill="#ff5f8f" />
        <rect x={-18} y={-18} width={36} height={28} rx={11} fill="#f4f7fb" stroke="#b9c4d0" strokeWidth={1.4} />
        <rect x={-13} y={-12} width={26} height={15} rx={7} fill="#1d2b3a" />
        <g className="ai-eyes">
          <ellipse cx={-5.5} cy={-4.5} rx={2.6} ry={3.2} fill="#5ff0c8" />
          <ellipse cx={5.5} cy={-4.5} rx={2.6} ry={3.2} fill="#5ff0c8" />
        </g>
        <rect x={-10} y={10} width={20} height={10} rx={5} fill="#e3e9f1" stroke="#b9c4d0" strokeWidth={1} />
        <text x={0} y={18} textAnchor="middle" fontSize={6.4} fontWeight={900} fill="#2f6fb5" fontFamily={SANS}>
          IA
        </text>
        {Array.from({ length: n }, (_, i) => (
          <g key={i} className="ai-orbit" style={{ animationDelay: `${(-i * 6) / n}s` }}>
            <circle cx={32} cy={0} r={3.4} fill={['#5ff0c8', '#ffb02e', '#ff5f8f', '#7fb6ff'][i % 4]} />
          </g>
        ))}
      </g>
    </g>
  );
}

function BotArca({ x0, x1, y }: { x0: number; x1: number; y: number }) {
  const d = Math.max(60, x1 - x0);
  return (
    <g transform={`translate(${x0},${y})`}>
      <g className="patrol" style={{ ['--d' as string]: `${d}px` }}>
        <g className="patrol-flip">
          <Shadow x={0} y={0} rx={18} ry={3.4} />
          <circle cx={-8} cy={-4} r={4} fill="#2b313a" />
          <circle cx={8} cy={-4} r={4} fill="#2b313a" />
          <rect x={-13} y={-24} width={26} height={18} rx={5} fill="#e8b93a" />
          <rect x={-9} y={-20} width={14} height={8} rx={3} fill="#1d2b3a" />
          <circle cx={-5} cy={-16} r={1.6} fill="#5ff0c8" />
          <circle cx={1} cy={-16} r={1.6} fill="#5ff0c8" />
          <rect x={6} y={-34} width={13} height={11} rx={1} fill="#0d4c8b" />
          <text x={12.5} y={-26.4} textAnchor="middle" fontSize={4.2} fontWeight={900} fill="#fff" fontFamily={SANS}>
            ARCA
          </text>
          <line x1={-4} y1={-24} x2={-4} y2={-30} stroke="#5d6772" strokeWidth={1.4} />
          <circle className="led-blink d1" cx={-4} cy={-31} r={1.8} fill="#ff5f8f" />
        </g>
      </g>
    </g>
  );
}

const AI_TOOLS: ToolId[] = ['ia_carga', 'ia_revisor', 'ia_documentacion', 'ia_conciliacion'];

/** Herramientas montadas en la pared y el rincón técnico (se dibujan detrás de los puestos). */
export const BackProps = memo(function BackProps({ tools, L }: { tools: ToolId[]; L: LevelLayout }) {
  const has = (t: ToolId) => tools.includes(t);
  const units = (has('sistema_contable') ? 4 : 0) + (has('erp_nube') ? 6 : 0);
  return (
    <g className="props-back">
      {has('tablero_vencimientos') && <TvBoard x={L.tv.x} y={L.tv.y} />}
      {has('crm') && <CrmBoard x={L.board.x} y={L.board.y} standing={L.board.standing} />}
      {units > 0 && <Rack x={L.rack.x} y={L.rack.y} units={units} erp={has('erp_nube')} small={L.rack.small} />}
      {has('backup_nube') && <Router x={L.router.x} y={L.router.y} />}
      {has('factura_auto') && <Printer x={L.printer.x} y={L.printer.y} />}
      {has('portal_clientes') && <Tablet x={L.tablet.x} y={L.tablet.y} />}
      {has('liquidador_sueldos') && <Stamp x={L.stamp.x} y={L.stamp.y} />}
      {has('ups') && <Ups x={L.ups.x} y={L.ups.y} />}
    </g>
  );
});

/** Herramientas que "viven" delante (robots). */
export const FrontProps = memo(function FrontProps({ tools, L }: { tools: ToolId[]; L: LevelLayout }) {
  const nAi = AI_TOOLS.filter((t) => tools.includes(t)).length;
  return (
    <g className="props-front">
      {tools.includes('bot_arca') && <BotArca x0={L.botRange[0]} x1={L.botRange[1]} y={L.botY} />}
      {nAi > 0 && <AiBot x={L.aiBot.x} y={L.aiBot.y} n={nAi} />}
    </g>
  );
});

export function screenForTools(tools: ToolId[]): 'erp' | 'work' | 'grid' {
  if (tools.includes('erp_nube')) return 'erp';
  if (tools.includes('sistema_contable')) return 'work';
  if (tools.includes('planilla')) return 'grid';
  return 'work';
}
