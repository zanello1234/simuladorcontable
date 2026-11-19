// Banco de casos del minijuego relámpago: clasificar comprobantes a toda velocidad.
// Reglas (Ley de IVA, simplificadas para el juego): el crédito fiscal requiere comprobante con IVA
// discriminado (Factura A) y vinculación con la actividad gravada; la Factura B/C no discrimina;
// las notas de crédito invierten el efecto; percepciones y retenciones son pagos a cuenta.
import type { Rng } from '../../engine/rng';

export type Respuesta = 'debito' | 'credito' | 'nada';
export const RESPUESTAS: { id: Respuesta; label: string; key: string }[] = [
  { id: 'debito', label: 'Débito fiscal', key: '1' },
  { id: 'credito', label: 'Crédito fiscal', key: '2' },
  { id: 'nada', label: 'No computa', key: '3' },
];

export interface Caso {
  tipo: string; // 'Factura A', etc.
  dir: 'Emitida' | 'Recibida';
  quien: string;
  concepto: string;
  respuesta: Respuesta;
  porque: string;
}

const PROV = ['Distribuidora Litoral SA', 'Logística Paraná SRL', 'Insumos del Centro SA', 'Papelera Rosario SRL', 'TecnoSoft SA', 'Transportes Oroño SA', 'Mayorista Funes SRL'];
const CLI_RI = ['Supermercados Norte SA', 'Clínica Alberdi SRL', 'Metalúrgica Sur SA', 'Hotel Pichincha SRL'];
const MONO = ['Lucía Gómez (Monotributo)', 'Diego Ríos (Monotributo)', 'Taller El Ceibo (Monotributo)', 'Camila Sosa (Monotributo)'];

const BANCO: Omit<Caso, 'quien'>[] = [
  { tipo: 'Factura A', dir: 'Emitida', concepto: 'Venta de mercadería a RI', respuesta: 'debito', porque: 'Venta gravada con IVA discriminado: genera débito fiscal.' },
  { tipo: 'Factura B', dir: 'Emitida', concepto: 'Venta a consumidor final', respuesta: 'debito', porque: 'Aunque no discrimine, la venta está gravada: el IVA contenido es débito fiscal.' },
  { tipo: 'Factura A', dir: 'Emitida', concepto: 'Servicio de mantenimiento a RI', respuesta: 'debito', porque: 'Prestación gravada: débito fiscal.' },
  { tipo: 'Nota de crédito A', dir: 'Emitida', concepto: 'Devolución de mercadería del cliente', respuesta: 'debito', porque: 'La NC emitida reduce el débito fiscal (va con signo negativo en el débito).' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Compra de mercadería de reventa', respuesta: 'credito', porque: 'Compra vinculada a la actividad, IVA discriminado: crédito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Alquiler del local comercial', respuesta: 'credito', porque: 'Gasto vinculado a operaciones gravadas con IVA discriminado: crédito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Servicio de internet de la oficina', respuesta: 'credito', porque: 'Servicio afectado a la actividad gravada: crédito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Flete de la mercadería vendida', respuesta: 'credito', porque: 'Gasto necesario para la actividad gravada: crédito fiscal.' },
  { tipo: 'Nota de crédito A', dir: 'Recibida', concepto: 'Descuento del proveedor por pronto pago', respuesta: 'credito', porque: 'La NC recibida reduce el crédito fiscal (signo negativo en el crédito).' },
  { tipo: 'Factura B', dir: 'Recibida', concepto: 'Compra de insumos de limpieza', respuesta: 'nada', porque: 'La Factura B no discrimina IVA: no se puede computar crédito fiscal.' },
  { tipo: 'Factura C', dir: 'Recibida', concepto: 'Diseño gráfico del catálogo', respuesta: 'nada', porque: 'El monotributista no genera crédito fiscal: la Factura C no tiene IVA.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Televisor para la casa del socio', respuesta: 'nada', porque: 'No está vinculado con operaciones gravadas: el crédito no es computable.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Cena familiar del dueño', respuesta: 'nada', porque: 'Gasto personal, sin vinculación con la actividad: no computa.' },
  { tipo: 'Ticket', dir: 'Recibida', concepto: 'Nafta del auto particular', respuesta: 'nada', porque: 'Sin IVA discriminado y sin vinculación con la actividad: no computa.' },
  { tipo: 'Recibo', dir: 'Recibida', concepto: 'Sueldo del empleado', respuesta: 'nada', porque: 'Los sueldos no están alcanzados por IVA: no hay crédito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Compra de un auto para el gerente', respuesta: 'credito', porque: 'Computable, pero con tope: el crédito por automóviles se limita a un valor máximo de compra.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Honorarios del contador', respuesta: 'credito', porque: 'Servicio vinculado con la actividad, IVA discriminado: crédito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Donación a una fundación', respuesta: 'nada', porque: 'Una donación no es una compra vinculada a operaciones gravadas.' },
  { tipo: 'Factura E', dir: 'Emitida', concepto: 'Exportación de servicios a Uruguay', respuesta: 'nada', porque: 'La exportación está exenta: no genera débito fiscal (sí permite recuperar crédito).' },
  { tipo: 'Factura A', dir: 'Emitida', concepto: 'Venta de un bien de uso (camioneta)', respuesta: 'debito', porque: 'La venta de bienes de uso por un RI está gravada: débito fiscal.' },
  { tipo: 'Factura B', dir: 'Emitida', concepto: 'Venta de libros', respuesta: 'nada', porque: 'Los libros están exentos de IVA: no hay débito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Seguro del local', respuesta: 'credito', porque: 'Gasto afectado a la actividad con IVA discriminado: crédito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Ropa de calle para el dueño', respuesta: 'nada', porque: 'Gasto personal: el crédito no es computable.' },
  { tipo: 'Factura M', dir: 'Recibida', concepto: 'Compra de materia prima', respuesta: 'credito', porque: 'La Factura M discrimina IVA: crédito computable, con la retención que corresponde al pagar.' },
  { tipo: 'Factura B', dir: 'Emitida', concepto: 'Alquiler de una vivienda a una familia', respuesta: 'nada', porque: 'El alquiler de vivienda está exento de IVA.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Almuerzo en restaurante con un cliente', respuesta: 'nada', porque: 'Restaurantes y hoteles: el crédito fiscal no es computable salvo para quienes los prestan.' },
  { tipo: 'Factura A', dir: 'Emitida', concepto: 'Anticipo de cliente que congela precio', respuesta: 'debito', porque: 'El anticipo que congela precio genera el hecho imponible: débito fiscal.' },
  { tipo: 'Factura A', dir: 'Recibida', concepto: 'Reparación de la máquina de la fábrica', respuesta: 'credito', porque: 'Vinculada a la actividad gravada: crédito fiscal.' },
];

export function generarPila(rng: Rng, n: number): Caso[] {
  const out: Caso[] = [];
  let pool: Omit<Caso, 'quien'>[] = [];
  for (let i = 0; i < n; i++) {
    if (!pool.length) pool = rng.shuffle([...BANCO]);
    const b = pool.pop()!;
    const quien = b.dir === 'Recibida' ? (b.tipo === 'Factura C' ? rng.pick(MONO) : rng.pick(PROV)) : b.tipo === 'Factura B' || b.tipo === 'Factura E' ? 'Consumidor final / exterior' : rng.pick(CLI_RI);
    out.push({ ...b, quien });
  }
  return out;
}
