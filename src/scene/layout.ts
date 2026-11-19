// Geometría de cada nivel de oficina (coordenadas del viewBox base 1200×460).
//
// Convenciones:
//  - Pared: y 14..300 · zócalo 300..308 · piso 308..460.
//  - Objetos apoyados contra la pared: base en y≈322.
//  - Puestos de trabajo: (x, y) = centro del borde frontal de la tapa del escritorio; s = escala.

export const BASE_W = 1200;
export const BASE_H = 460;
export const WALL_BASE = 300;
export const FLOOR_Y = 308;
export const BACK_BASE = 322;

export interface DeskSlot {
  x: number;
  y: number;
  s: number;
  row: 'front' | 'back';
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DeskStyle = 'home' | 'office' | 'corp';

export interface LevelLayout {
  deskStyle: DeskStyle;
  slots: DeskSlot[];
  door: Rect; // y+h = base de la pared
  /** x donde se detienen los visitantes; y = línea de piso por donde caminan */
  visitor: { x: number; y: number; s: number };
  /** asiento del inspector (base y) */
  waiting: { x: number; y: number; s: number };
  windows: Rect[];
  clock: { x: number; y: number; r: number };
  calendar: { x: number; y: number };
  diploma: { x: number; y: number };
  piggy: { x: number; y: number };
  phone: { x: number; y: number };
  // anclas de herramientas
  rack: { x: number; y: number; small?: boolean };
  ups: { x: number; y: number };
  router: { x: number; y: number };
  printer: { x: number; y: number };
  tablet: { x: number; y: number };
  stamp: { x: number; y: number };
  tv: { x: number; y: number };
  board: { x: number; y: number; standing?: boolean };
  aiBot: { x: number; y: number };
  botRange: [number, number];
  botY: number;
  lamps: number[];
}

const front = (xs: number[], y: number, s: number): DeskSlot[] => xs.map((x) => ({ x, y, s, row: 'front' }));
const back = (xs: number[], y: number, s: number): DeskSlot[] => xs.map((x) => ({ x, y, s, row: 'back' }));

export const LAYOUTS: LevelLayout[] = [
  // 0 · Home office — living de casa
  {
    deskStyle: 'home',
    slots: front([455, 690], 392, 1.3),
    door: { x: 40, y: 110, w: 80, h: 190 },
    visitor: { x: 300, y: 346, s: 0.86 },
    waiting: { x: 292, y: 352, s: 0.86 },
    windows: [{ x: 330, y: 64, w: 190, h: 150 }],
    clock: { x: 600, y: 84, r: 24 },
    calendar: { x: 574, y: 124 },
    diploma: { x: 680, y: 88 },
    piggy: { x: 1036, y: 166 },
    phone: { x: 560, y: 382 },
    rack: { x: 1092, y: 252, small: true },
    ups: { x: 1035, y: BACK_BASE },
    router: { x: 1170, y: 252 },
    printer: { x: 1132, y: 252 },
    tablet: { x: 1004, y: 168 },
    stamp: { x: 978, y: 168 },
    tv: { x: 790, y: 62 },
    board: { x: 175, y: 118 },
    aiBot: { x: 560, y: 248 },
    botRange: [380, 780],
    botY: 452,
    lamps: [560],
  },
  // 1 · Oficina chica
  {
    deskStyle: 'office',
    slots: front([390, 575, 760, 945], 392, 1.22),
    door: { x: 36, y: 104, w: 84, h: 196 },
    visitor: { x: 212, y: 350, s: 0.86 },
    waiting: { x: 262, y: 352, s: 0.86 },
    windows: [
      { x: 360, y: 58, w: 160, h: 150 },
      { x: 700, y: 58, w: 160, h: 150 },
    ],
    clock: { x: 610, y: 82, r: 22 },
    calendar: { x: 584, y: 118 },
    diploma: { x: 885, y: 78 },
    piggy: { x: 250, y: 274 },
    phone: { x: 172, y: 276 },
    rack: { x: 1168, y: BACK_BASE },
    ups: { x: 1040, y: BACK_BASE },
    router: { x: 1168, y: 196 },
    printer: { x: 1082, y: 262 },
    tablet: { x: 212, y: 268 },
    stamp: { x: 1122, y: 262 },
    tv: { x: 890, y: 140 },
    board: { x: 1015, y: 70 },
    aiBot: { x: 482, y: 230 },
    botRange: [320, 1000],
    botY: 452,
    lamps: [400, 655, 910],
  },
  // 2 · Oficina mediana
  {
    deskStyle: 'office',
    slots: [...front([335, 485, 635, 785], 392, 1.06), ...back([410, 560, 710, 860], 338, 0.88)],
    door: { x: 30, y: 104, w: 80, h: 196 },
    visitor: { x: 192, y: 350, s: 0.86 },
    waiting: { x: 232, y: 358, s: 0.86 },
    windows: [
      { x: 300, y: 46, w: 175, h: 128 },
      { x: 565, y: 46, w: 175, h: 128 },
    ],
    clock: { x: 520, y: 70, r: 19 },
    calendar: { x: 494, y: 100 },
    diploma: { x: 770, y: 50 },
    piggy: { x: 228, y: 274 },
    phone: { x: 150, y: 276 },
    rack: { x: 1168, y: BACK_BASE },
    ups: { x: 1040, y: BACK_BASE },
    router: { x: 1168, y: 196 },
    printer: { x: 1082, y: 262 },
    tablet: { x: 190, y: 268 },
    stamp: { x: 1122, y: 262 },
    tv: { x: 935, y: 78 },
    board: { x: 760, y: 112 },
    aiBot: { x: 620, y: 214 },
    botRange: [290, 860],
    botY: 452,
    lamps: [340, 480, 620, 760],
  },
  // 3 · Piso corporativo
  {
    deskStyle: 'corp',
    slots: [...front([310, 425, 540, 655, 770, 885, 1000], 396, 0.85), ...back([365, 480, 595, 710, 825, 940, 1055], 340, 0.72)],
    door: { x: 30, y: 110, w: 82, h: 190 },
    visitor: { x: 182, y: 352, s: 0.84 },
    waiting: { x: 252, y: 360, s: 0.8 },
    windows: [{ x: 280, y: 30, w: 800, h: 270 }],
    clock: { x: 150, y: 150, r: 17 },
    calendar: { x: 186, y: 128 },
    diploma: { x: 36, y: 22 },
    piggy: { x: 214, y: 278 },
    phone: { x: 142, y: 280 },
    rack: { x: 1168, y: BACK_BASE },
    ups: { x: 296, y: BACK_BASE },
    router: { x: 1168, y: 196 },
    printer: { x: 1082, y: 262 },
    tablet: { x: 178, y: 272 },
    stamp: { x: 1122, y: 262 },
    tv: { x: 1098, y: 122 },
    board: { x: 1098, y: 36 },
    aiBot: { x: 680, y: 210 },
    botRange: [270, 1050],
    botY: 456,
    lamps: [],
  },
];

export function layoutFor(level: number): LevelLayout {
  return LAYOUTS[Math.max(0, Math.min(LAYOUTS.length - 1, level | 0))];
}

/** Posición de la cabeza de un trabajador sentado en un puesto (para FX y burbujas). */
export function headPos(slot: DeskSlot): { x: number; y: number } {
  return { x: slot.x, y: slot.y - 66 * slot.s };
}
