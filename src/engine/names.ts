// Generadores de nombres, razones sociales, CUIT ficticios y avatares.
import type { Avatar, ClientKind, Peinado, Rubro } from './types';
import type { Rng } from './rng';

const NOMBRES_F = ['Lucía', 'Sofía', 'Valentina', 'Camila', 'Martina', 'Florencia', 'Agustina', 'Julieta', 'Carolina', 'Romina', 'Paula', 'Natalia', 'Gabriela', 'Silvina', 'Mariela', 'Daniela', 'Belén', 'Antonella', 'Micaela', 'Verónica', 'Laura', 'Cecilia', 'Rocío', 'Milagros'];
const NOMBRES_M = ['Martín', 'Juan Pablo', 'Federico', 'Nicolás', 'Matías', 'Santiago', 'Diego', 'Gonzalo', 'Lucas', 'Joaquín', 'Ezequiel', 'Facundo', 'Hernán', 'Leandro', 'Pablo', 'Sebastián', 'Ignacio', 'Tomás', 'Mariano', 'Germán', 'Rodrigo', 'Esteban', 'Fernando', 'Agustín'];
const APELLIDOS = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Gutiérrez', 'Pereyra', 'Rossi', 'Bianchi', 'Ferrari', 'Bruno', 'Gallo', 'Costa', 'Lombardi', 'Mancini', 'Ricci', 'Moretti', 'Paz', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Vázquez', 'Ríos', 'Luna', 'Juárez', 'Cabrera', 'Ledesma', 'Peralta', 'Quiroga', 'Ojeda'];

const RUBRO_NEGOCIOS: Record<Rubro, string[]> = {
  comercio: ['Ferretería', 'Librería', 'Almacén', 'Kiosco', 'Corralón', 'Bazar', 'Pinturería', 'Casa de Repuestos', 'Mueblería', 'Óptica', 'Vivero'],
  servicios: ['Consultora', 'Estudio de Diseño', 'Agencia', 'Inmobiliaria', 'Peluquería', 'Gimnasio', 'Lavadero', 'Taller Mecánico', 'Escuela de Idiomas', 'Desarrollos Web'],
  gastronomia: ['Parrilla', 'Pizzería', 'Cervecería', 'Panadería', 'Heladería', 'Rotisería', 'Café', 'Bodegón', 'Empanadas'],
  construccion: ['Constructora', 'Obras y Servicios', 'Instalaciones', 'Pinturas y Revestimientos', 'Movimiento de Suelos'],
  agro: ['Agropecuaria', 'Acopio', 'Semillería', 'Agroservicios', 'Establecimiento'],
  industria: ['Metalúrgica', 'Plásticos', 'Matricería', 'Textil', 'Carpintería Industrial', 'Alimentos'],
  salud: ['Consultorio', 'Centro Médico', 'Laboratorio', 'Kinesiología', 'Odontología Integral', 'Veterinaria'],
  transporte: ['Transporte', 'Logística', 'Fletes', 'Distribuidora', 'Remises'],
};
const FANTASIA = ['El Hornero', 'Los Tilos', 'La Esquina', 'Del Litoral', 'San Lorenzo', 'Río Paraná', 'El Ceibo', 'La Pampa', 'Tres Arroyos', 'Santa Rita', 'Don Bosco', 'El Molino', 'La Ribera', 'Puerto Norte', 'Fisherton', 'Alberdi', 'Oroño', 'Pichincha', 'Funes', 'Roldán', 'Las Acacias', 'El Algarrobo', 'Monte Flores', 'Saladillo', 'Arroyito', 'Echesortu', 'La Florida', 'Granadero Baigorria'];

export function nombrePersona(rng: Rng, genero?: 'f' | 'm'): { nombre: string; genero: 'f' | 'm' } {
  const g = genero ?? (rng.chance(0.5) ? 'f' : 'm');
  const n = rng.pick(g === 'f' ? NOMBRES_F : NOMBRES_M);
  return { nombre: `${n} ${rng.pick(APELLIDOS)}`, genero: g };
}

export function razonSocial(rng: Rng, kind: ClientKind, rubro: Rubro, titular?: string): string {
  const neg = rng.pick(RUBRO_NEGOCIOS[rubro]);
  if (kind === 'monotributista' || kind === 'ri_persona') {
    // persona humana: el nombre del titular (con nombre de fantasía entre paréntesis)
    const t = titular ?? nombrePersona(rng).nombre;
    return rng.chance(0.5) ? `${t} (${neg} ${rng.pick(APELLIDOS)})` : `${t} (${neg} ${rng.pick(FANTASIA)})`;
  }
  const base = rng.chance(0.5) ? `${neg} ${rng.pick(FANTASIA)}` : `${rng.pick(FANTASIA)} ${neg}`;
  const suf = kind === 'srl' ? 'S.R.L.' : kind === 'sas' ? 'S.A.S.' : 'S.A.';
  return `${base} ${suf}`;
}

/** CUIT ficticio con dígito verificador válido. */
export function cuit(rng: Rng, tipo: 'f' | 'm' | 'soc'): string {
  const pref = tipo === 'soc' ? rng.pick(['30', '33']) : tipo === 'f' ? '27' : '20';
  for (;;) {
    const cuerpo = tipo === 'soc' ? String(rng.int(50_000_000, 72_999_999)) : String(rng.int(14_000_000, 45_999_999)).padStart(8, '0');
    const digits = (pref + cuerpo).split('').map(Number);
    const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const s = digits.reduce((a, d, i) => a + d * w[i], 0);
    let v = 11 - (s % 11);
    if (v === 11) v = 0;
    if (v === 10) continue;
    return `${pref}-${cuerpo}-${v}`;
  }
}

/** Último dígito del CUIT (define vencimientos). */
export const terminacion = (c: string) => Number(c.charAt(c.length - 1));

const PIELES = ['#f6d7c3', '#eac4a5', '#d9a77f', '#c18a63', '#9c6b48', '#7a4f33', '#f3cfb1'];
const PELOS = ['#2b1d16', '#4a3020', '#6b4428', '#a0703f', '#d4a95a', '#1c1c1c', '#8a8a8a', '#b5462f', '#e3d3b0'];
const ROPAS = ['#2f6fb5', '#1f8a70', '#c8414f', '#e8b93a', '#6c4fb3', '#3b4a5c', '#d26b2c', '#2a9d8f', '#8e5a9c', '#5a7d3a', '#b33f6b', '#476a8a'];

export function avatar(rng: Rng, genero?: 'f' | 'm'): Avatar {
  const g = genero ?? (rng.chance(0.5) ? 'f' : 'm');
  const peinados: Peinado[] = g === 'f' ? ['largo', 'rodete', 'rulos', 'flequillo', 'corto'] : ['corto', 'pelado', 'rulos', 'flequillo', 'corto'];
  const viejo = rng.chance(0.2);
  return {
    piel: rng.pick(PIELES),
    pelo: viejo ? rng.pick(['#8a8a8a', '#c9c9c9', '#a5a5a5']) : rng.pick(PELOS),
    peinado: rng.pick(peinados),
    ropa: rng.pick(ROPAS),
    anteojos: rng.chance(0.3),
    barba: g === 'm' && rng.chance(0.3),
  };
}
