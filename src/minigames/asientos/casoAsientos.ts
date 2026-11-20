// Caso del minijuego "Asientos del mes": operaciones con comprobante y su asiento correcto.
import { makeRng, type Rng } from '../../engine/rng';
import { MESES } from '../../engine/calendar';
import { money } from '../../engine/format';
import type { Client } from '../../engine/types';
import { D, H, comparar, round, type Asiento } from './asiento';
import type { MinigameResult } from '../types';

export interface Chip {
  label: string;
  monto: number;
}

export interface Operacion {
  id: string;
  fecha: string; // 'dd/mm'
  titulo: string;
  /** comprobante o documento resumido, línea por línea */
  detalle: string[];
  chips: Chip[];
  /** cuentas probables para el buscador */
  sugeridas: string[];
  solucion: Asiento;
  /** asiento "propuesto por el sistema" con un error típico, y su explicación */
  propuesta: Asiento;
  errorTipico: string;
  /** la operación NO se registra este mes (trampa de devengamiento) */
  noRegistrar?: boolean;
  trampa?: boolean;
  explicacion: string;
}

export interface CasoAsientos {
  periodo: string;
  periodoLabel: string;
  cliente: string;
  operaciones: Operacion[];
}

type ClientLike = Pick<Client, 'nombre' | 'rubro' | 'volumen' | 'empleados' | 'kind'>;

const r0 = (n: number) => Math.round(n);
const pct = (base: number, p: number) => r0(base * p);

interface Ctx {
  rng: Rng;
  idx: number;
  base: number; // importe típico de una operación
  mes: number;
  anio: number;
  empleados: number;
  n: number;
}

const dia = (c: Ctx, min = 1, max = 28) => `${String(c.rng.int(min, max)).padStart(2, '0')}/${String(c.mes).padStart(2, '0')}`;
const prov = (c: Ctx) => c.rng.pick(['Distribuidora Litoral SA', 'Mayorista Funes SRL', 'Insumos del Centro SA', 'Papelera Rosario SRL', 'TecnoSoft SA']);
const cli = (c: Ctx) => c.rng.pick(['Supermercados Norte SA', 'Clínica Alberdi SRL', 'Metalúrgica Sur SA', 'Hotel Pichincha SRL', 'Corralón El Ceibo SRL']);

type Plantilla = (c: Ctx) => Operacion;

const PLANTILLAS: Record<string, Plantilla> = {
  ventaA: (c) => {
    const neto = r0(c.base * c.rng.range(1.2, 2.4) / 100) * 100;
    const iva = pct(neto, 0.21);
    const total = neto + iva;
    const q = cli(c);
    return {
      id: 'ventaA',
      fecha: dia(c, 1, 10),
      titulo: `Venta en cuenta corriente · Factura A a ${q}`,
      detalle: [`Factura A 0003-00004512 · ${q} (RI)`, `Neto gravado ${money(neto)} · IVA 21% ${money(iva)} · Total ${money(total)}`, 'Condición de venta: cuenta corriente 30 días'],
      chips: [{ label: 'Neto', monto: neto }, { label: 'IVA', monto: iva }, { label: 'Total', monto: total }],
      sugeridas: ['1.1.03.01', '4.1.01.01', '2.1.03.01', '1.1.01.02', '1.1.04.01'],
      solucion: { lineas: [D('1.1.03.01', total), H('4.1.01.01', neto), H('2.1.03.01', iva)] },
      propuesta: { lineas: [D('1.1.03.01', total), H('4.1.01.01', total)] },
      errorTipico: 'El sistema mandó el total a Ventas: el IVA no es ingreso, es un pasivo (IVA Débito Fiscal).',
      explicacion: 'Venta a crédito: Deudores por ventas por el total; Ventas por el neto; el IVA facturado es IVA Débito Fiscal (pasivo).',
    };
  },
  ventaB: (c) => {
    const total = r0(c.base * c.rng.range(0.6, 1.4) / 100) * 100;
    const neto = round(total / 1.21);
    const iva = round(total - neto);
    return {
      id: 'ventaB',
      fecha: dia(c, 2, 12),
      titulo: 'Venta de contado · Factura B a consumidor final',
      detalle: ['Factura B 0003-00009120 · Consumidor final', `Total ${money(total)} (IVA contenido ${money(iva)}; neto ${money(neto)})`, 'Cobrado en efectivo'],
      chips: [{ label: 'Total', monto: total }, { label: 'Neto', monto: neto }, { label: 'IVA contenido', monto: iva }],
      sugeridas: ['1.1.01.01', '4.1.01.01', '2.1.03.01', '1.1.03.01'],
      solucion: { lineas: [D('1.1.01.01', total), H('4.1.01.01', neto), H('2.1.03.01', iva)] },
      propuesta: { lineas: [D('1.1.03.01', total), H('4.1.01.01', neto), H('2.1.03.01', iva)] },
      errorTipico: 'El sistema lo registró como cuenta corriente, pero se cobró en efectivo: va a Caja, no a Deudores.',
      explicacion: 'Aunque la Factura B no discrimina IVA, la venta está gravada: Ventas por el neto y el IVA contenido va a IVA Débito Fiscal. Como es de contado, debita Caja.',
    };
  },
  cobro: (c) => {
    const total = r0(c.base * c.rng.range(1.5, 2.6) / 100) * 100;
    const retIva = pct(total / 1.21, 0.105 * 0.5);
    const retGan = pct(total / 1.21, 0.02);
    const banco = total - retIva - retGan;
    const q = cli(c);
    return {
      id: 'cobro',
      fecha: dia(c, 8, 18),
      titulo: `Cobro de ${q} por transferencia, con retenciones`,
      detalle: [`Cancela factura por ${money(total)}`, `Retención de IVA sufrida (RG 2854) ${money(retIva)}`, `Retención de Ganancias sufrida (RG 830) ${money(retGan)}`, `Acreditado en banco: ${money(banco)}`],
      chips: [{ label: 'Factura', monto: total }, { label: 'Acreditado', monto: banco }, { label: 'Ret. IVA', monto: retIva }, { label: 'Ret. Ganancias', monto: retGan }],
      sugeridas: ['1.1.01.02', '1.1.04.02', '1.1.04.03', '1.1.03.01', '4.2.03.03'],
      solucion: { lineas: [D('1.1.01.02', banco), D('1.1.04.02', retIva), D('1.1.04.03', retGan), H('1.1.03.01', total)] },
      propuesta: { lineas: [D('1.1.01.02', banco), D('4.2.03.03', retIva + retGan), H('1.1.03.01', total)] },
      errorTipico: 'El sistema mandó las retenciones a Gastos bancarios. Son pagos a cuenta de impuestos: créditos fiscales (activo), no un gasto.',
      explicacion: 'Las retenciones sufridas son impuestos pagados por adelantado: activos (otros créditos). El deudor se cancela por el total de la factura.',
    };
  },
  compra: (c) => {
    const neto = r0(c.base * c.rng.range(1, 2) / 100) * 100;
    const iva = pct(neto, 0.21);
    const perc = pct(neto, 0.035);
    const total = neto + iva + perc;
    const p = prov(c);
    return {
      id: 'compra',
      fecha: dia(c, 3, 14),
      titulo: `Compra de mercadería en cuenta corriente · Factura A de ${p}`,
      detalle: [`Factura A 0001-00022310 · ${p} (RI)`, `Neto ${money(neto)} · IVA 21% ${money(iva)} · Percepción IIBB ${money(perc)}`, `Total ${money(total)} · cuenta corriente`],
      chips: [{ label: 'Neto', monto: neto }, { label: 'IVA', monto: iva }, { label: 'Percepción', monto: perc }, { label: 'Total', monto: total }],
      sugeridas: ['1.1.05.01', '1.1.04.01', '1.1.04.04', '2.1.01.01', '4.1.02.01'],
      solucion: { lineas: [D('1.1.05.01', neto), D('1.1.04.01', iva), D('1.1.04.04', perc), H('2.1.01.01', total)] },
      propuesta: { lineas: [D('1.1.05.01', neto + perc), D('1.1.04.01', iva), H('2.1.01.01', total)] },
      errorTipico: 'El sistema cargó la percepción de IIBB al costo de la mercadería. Es un pago a cuenta del impuesto: crédito fiscal.',
      explicacion: 'La mercadería de reventa es un activo (no gasto) por el neto; el IVA es crédito fiscal y la percepción de IIBB es un crédito contra el impuesto provincial.',
    };
  },
  pagoProveedor: (c) => {
    const total = r0(c.base * c.rng.range(0.8, 1.6) / 100) * 100;
    const p = prov(c);
    return {
      id: 'pagoProveedor',
      fecha: dia(c, 10, 22),
      titulo: `Pago a ${p} con cheque`,
      detalle: [`Orden de pago · cheque Banco Nación N° 00451 por ${money(total)}`, 'Cancela facturas en cuenta corriente'],
      chips: [{ label: 'Total', monto: total }],
      sugeridas: ['2.1.01.01', '1.1.01.02', '1.1.01.01', '4.1.02.01'],
      solucion: { lineas: [D('2.1.01.01', total), H('1.1.01.02', total)] },
      propuesta: { lineas: [D('4.1.02.01', total), H('1.1.01.02', total)] },
      errorTipico: 'El sistema lo registró como costo. El gasto o el activo ya se registró con la factura: el pago solo cancela la deuda con el proveedor.',
      explicacion: 'Pagar una deuda no es un gasto: baja Proveedores (pasivo) y baja Banco (activo).',
    };
  },
  alquiler: (c) => {
    const neto = r0(c.base * c.rng.range(0.4, 0.8) / 1000) * 1000;
    const iva = pct(neto, 0.21);
    return {
      id: 'alquiler',
      fecha: dia(c, 1, 8),
      titulo: 'Alquiler del local · Factura A de la inmobiliaria',
      detalle: [`Factura A 0002-00001187 · Inmobiliaria Pichincha SRL`, `Neto ${money(neto)} · IVA 21% ${money(iva)} · Total ${money(neto + iva)}`, 'Pagado por transferencia'],
      chips: [{ label: 'Neto', monto: neto }, { label: 'IVA', monto: iva }, { label: 'Total', monto: neto + iva }],
      sugeridas: ['4.2.02.01', '1.1.04.01', '1.1.01.02', '2.1.01.01'],
      solucion: { lineas: [D('4.2.02.01', neto), D('1.1.04.01', iva), H('1.1.01.02', neto + iva)] },
      propuesta: { lineas: [D('4.2.02.01', neto + iva), H('1.1.01.02', neto + iva)] },
      errorTipico: 'El sistema cargó el total como gasto. Para un RI el IVA de la factura A no es gasto: es crédito fiscal.',
      explicacion: 'Alquileres por el neto (gasto devengado del mes), IVA Crédito Fiscal por el IVA, Banco por el total pagado.',
    };
  },
  sueldos: (c) => {
    const bruto = r0(c.base * 0.9 * Math.max(1, c.empleados) / 1000) * 1000;
    const aportes = pct(bruto, 0.17);
    const contrib = pct(bruto, 0.27);
    const neto = bruto - aportes;
    return {
      id: 'sueldos',
      fecha: `${String(new Date(Date.UTC(c.anio, c.mes, 0)).getUTCDate()).padStart(2, '0')}/${String(c.mes).padStart(2, '0')}`,
      titulo: `Devengamiento de sueldos de ${MESES[c.mes - 1]}`,
      detalle: [`Libro de sueldos · ${Math.max(1, c.empleados)} empleado/s`, `Remuneración bruta ${money(bruto)} · aportes del trabajador 17% ${money(aportes)} · neto ${money(neto)}`, `Contribuciones patronales 27% ${money(contrib)}`],
      chips: [{ label: 'Bruto', monto: bruto }, { label: 'Neto', monto: neto }, { label: 'Aportes', monto: aportes }, { label: 'Contribuciones', monto: contrib }],
      sugeridas: ['4.2.01.01', '4.2.01.02', '2.1.02.01', '2.1.02.02', '2.1.02.03'],
      solucion: { lineas: [D('4.2.01.01', bruto), D('4.2.01.02', contrib), H('2.1.02.01', neto), H('2.1.02.03', aportes), H('2.1.02.02', contrib)] },
      propuesta: { lineas: [D('4.2.01.01', neto), D('4.2.01.02', contrib), H('2.1.02.01', neto), H('2.1.02.02', contrib)] },
      errorTipico: 'El sistema tomó el neto como gasto y olvidó los aportes retenidos. El gasto es el bruto; los aportes se retienen y quedan como deuda a depositar.',
      explicacion: 'Se devenga el costo laboral completo: sueldos brutos y contribuciones patronales como gasto; como pasivos, el neto a pagar, los aportes retenidos (SUSS) y las contribuciones a pagar.',
    };
  },
  pagoSueldos: (c) => {
    const neto = r0(c.base * 0.9 * Math.max(1, c.empleados) * 0.83 / 1000) * 1000;
    return {
      id: 'pagoSueldos',
      fecha: dia(c, 3, 5),
      titulo: `Pago de los sueldos de ${MESES[(c.mes + 10) % 12]} por transferencia`,
      detalle: [`Acreditación de haberes en cuentas sueldo: ${money(neto)}`, 'Corresponde a sueldos devengados el mes anterior'],
      chips: [{ label: 'Neto', monto: neto }],
      sugeridas: ['2.1.02.01', '1.1.01.02', '4.2.01.01'],
      solucion: { lineas: [D('2.1.02.01', neto), H('1.1.01.02', neto)] },
      propuesta: { lineas: [D('4.2.01.01', neto), H('1.1.01.02', neto)] },
      errorTipico: 'El sistema volvió a cargar el gasto. Los sueldos ya se devengaron el mes pasado: ahora solo se cancela Sueldos a pagar.',
      explicacion: 'Criterio de lo devengado: el gasto se reconoce cuando se genera; el pago posterior solo cancela el pasivo.',
    };
  },
  bienUso: (c) => {
    const neto = r0(c.base * c.rng.range(1.5, 3) / 1000) * 1000;
    const iva = pct(neto, 0.21);
    return {
      id: 'bienUso',
      fecha: dia(c, 5, 20),
      titulo: 'Compra de equipos de computación · Factura A',
      detalle: [`Factura A 0004-00000871 · TecnoSoft SA`, `2 notebooks: neto ${money(neto)} · IVA ${money(iva)} · Total ${money(neto + iva)}`, 'Pago a 30 días (cuenta corriente)'],
      chips: [{ label: 'Neto', monto: neto }, { label: 'IVA', monto: iva }, { label: 'Total', monto: neto + iva }],
      sugeridas: ['1.2.01.03', '1.1.04.01', '2.1.01.01', '4.2.02.03'],
      solucion: { lineas: [D('1.2.01.03', neto), D('1.1.04.01', iva), H('2.1.01.01', neto + iva)] },
      propuesta: { lineas: [D('4.2.02.03', neto), D('1.1.04.01', iva), H('2.1.01.01', neto + iva)] },
      errorTipico: 'El sistema lo mandó a gastos. Un bien que dura más de un ejercicio se activa como bien de uso y se deprecia.',
      explicacion: 'Bien de uso: se activa por el neto (Equipos de computación), IVA crédito fiscal, y la deuda con el proveedor por el total.',
    };
  },
  cuotaPrestamo: (c) => {
    const capital = r0(c.base * c.rng.range(0.6, 1.2) / 1000) * 1000;
    const interes = r0(capital * c.rng.range(0.08, 0.18) / 100) * 100;
    return {
      id: 'cuotaPrestamo',
      fecha: dia(c, 9, 12),
      titulo: 'Débito de la cuota del préstamo bancario',
      detalle: [`Resumen bancario: débito cuota 4/12 por ${money(capital + interes)}`, `Amortización de capital ${money(capital)} · intereses ${money(interes)}`],
      chips: [{ label: 'Cuota', monto: capital + interes }, { label: 'Capital', monto: capital }, { label: 'Intereses', monto: interes }],
      sugeridas: ['2.1.04.01', '4.3.01.01', '1.1.01.02', '4.2.03.03'],
      solucion: { lineas: [D('2.1.04.01', capital), D('4.3.01.01', interes), H('1.1.01.02', capital + interes)] },
      propuesta: { lineas: [D('4.3.01.01', capital + interes), H('1.1.01.02', capital + interes)] },
      errorTipico: 'El sistema cargó toda la cuota como intereses. Solo el interés es gasto: el capital baja la deuda.',
      explicacion: 'La cuota se abre en amortización de capital (baja Préstamos bancarios) e intereses (resultado financiero).',
    };
  },
  anticipo: (c) => {
    const monto = r0(c.base * c.rng.range(0.8, 1.5) / 1000) * 1000;
    const q = cli(c);
    return {
      id: 'anticipo',
      fecha: dia(c, 15, 26),
      titulo: `Seña de ${q} por un pedido a entregar el mes que viene`,
      detalle: [`Transferencia recibida ${money(monto)}`, 'El cliente pide que "ya lo tomen como venta para cerrar el mes bien"', 'La mercadería se entrega dentro de 40 días'],
      chips: [{ label: 'Monto', monto }],
      sugeridas: ['1.1.01.02', '2.1.05.01', '4.1.01.01', '1.1.03.01'],
      solucion: { lineas: [D('1.1.01.02', monto), H('2.1.05.01', monto)] },
      propuesta: { lineas: [D('1.1.01.02', monto), H('4.1.01.01', monto)] },
      errorTipico: 'El sistema (y el cliente) lo quieren como venta. Sin entrega no hay venta: es un anticipo de cliente, un pasivo.',
      trampa: true,
      explicacion: 'El ingreso se reconoce con la entrega del bien o la prestación del servicio. Hasta entonces, la plata recibida es una obligación de entregar: Anticipos de clientes.',
    };
  },
  banco: (c) => {
    const com = r0(c.base * 0.03 / 100) * 100;
    const ivaCom = pct(com, 0.21);
    const idc = r0(c.base * 0.09 / 100) * 100;
    return {
      id: 'banco',
      fecha: `${String(new Date(Date.UTC(c.anio, c.mes, 0)).getUTCDate()).padStart(2, '0')}/${String(c.mes).padStart(2, '0')}`,
      titulo: 'Resumen bancario: comisiones e impuesto a los débitos y créditos',
      detalle: [`Comisión mantenimiento de cuenta ${money(com)} + IVA ${money(ivaCom)}`, `Impuesto Ley 25.413 (débitos y créditos) ${money(idc)}`, `Total debitado ${money(com + ivaCom + idc)}`],
      chips: [{ label: 'Comisión', monto: com }, { label: 'IVA comisión', monto: ivaCom }, { label: 'Imp. déb/créd', monto: idc }, { label: 'Total', monto: com + ivaCom + idc }],
      sugeridas: ['4.2.03.03', '1.1.04.01', '4.2.03.02', '1.1.01.02'],
      solucion: { lineas: [D('4.2.03.03', com), D('1.1.04.01', ivaCom), D('4.2.03.02', idc), H('1.1.01.02', com + ivaCom + idc)] },
      propuesta: { lineas: [D('4.2.03.03', com + ivaCom + idc), H('1.1.01.02', com + ivaCom + idc)] },
      errorTipico: 'El sistema mandó todo a Gastos bancarios. El IVA de la comisión es crédito fiscal y el impuesto al cheque es un impuesto distinto (parcialmente computable en Ganancias).',
      explicacion: 'Separar: comisión (gasto), IVA sobre la comisión (crédito fiscal) e impuesto a los débitos y créditos (gasto impositivo).',
    };
  },
  posicionIva: (c) => {
    const df = r0(c.base * c.rng.range(2, 3) / 100) * 100;
    const cf = r0(df * c.rng.range(0.55, 0.85) / 100) * 100;
    return {
      id: 'posicionIva',
      fecha: `${String(new Date(Date.UTC(c.anio, c.mes, 0)).getUTCDate()).padStart(2, '0')}/${String(c.mes).padStart(2, '0')}`,
      titulo: `Posición de IVA de ${MESES[c.mes - 1]}`,
      detalle: [`IVA Débito Fiscal del mes ${money(df)}`, `IVA Crédito Fiscal del mes ${money(cf)}`, `Saldo a pagar ${money(df - cf)} (vence el mes próximo)`],
      chips: [{ label: 'Débito', monto: df }, { label: 'Crédito', monto: cf }, { label: 'A pagar', monto: df - cf }],
      sugeridas: ['2.1.03.01', '1.1.04.01', '2.1.03.02', '1.1.01.02'],
      solucion: { lineas: [D('2.1.03.01', df), H('1.1.04.01', cf), H('2.1.03.02', df - cf)] },
      propuesta: { lineas: [D('2.1.03.01', df), H('1.1.04.01', cf), H('1.1.01.02', df - cf)] },
      errorTipico: 'El sistema dio de baja el banco como si ya se hubiera pagado. La DDJJ se presenta ahora pero el VEP se paga el mes que viene: queda IVA a pagar.',
      explicacion: 'Al cierre del mes se netean débito y crédito fiscal; la diferencia es IVA a pagar (pasivo) hasta que se abone el VEP.',
    };
  },
  sicore: (c) => {
    const monto = r0(c.base * 0.12 / 100) * 100;
    return {
      id: 'sicore',
      fecha: dia(c, 9, 11),
      titulo: 'Pago de retenciones de Ganancias practicadas (SICORE)',
      detalle: [`VEP SICORE ${money(monto)} debitado del banco`, 'Retenciones practicadas a proveedores el mes anterior'],
      chips: [{ label: 'Monto', monto }],
      sugeridas: ['2.1.03.04', '1.1.01.02', '4.4.01.01', '1.1.04.03'],
      solucion: { lineas: [D('2.1.03.04', monto), H('1.1.01.02', monto)] },
      propuesta: { lineas: [D('4.4.01.01', monto), H('1.1.01.02', monto)] },
      errorTipico: 'El sistema lo cargó como impuesto a las ganancias propio. Son retenciones que la empresa le practicó a otros: un pasivo que ahora se deposita.',
      explicacion: 'Las retenciones practicadas son de terceros: el agente de retención las debe al fisco (pasivo) y las cancela con el pago.',
    };
  },
  gastoSocio: (c) => {
    const monto = r0(c.base * c.rng.range(0.15, 0.35) / 1000) * 1000;
    return {
      id: 'gastoSocio',
      fecha: dia(c, 12, 24),
      titulo: 'Pago con la tarjeta de la empresa: vacaciones del socio',
      detalle: [`Débito automático ${money(monto)} · "Hotel Termas de Río Hondo"`, 'El socio dice que "es un viaje de negocios" pero fue con la familia'],
      chips: [{ label: 'Monto', monto }],
      sugeridas: ['1.1.03.05', '1.1.01.02', '4.2.02.03', '4.2.02.06'],
      solucion: { lineas: [D('1.1.03.05', monto), H('1.1.01.02', monto)] },
      propuesta: { lineas: [D('4.2.02.03', monto), H('1.1.01.02', monto)] },
      errorTipico: 'El sistema lo contabilizó como gasto de la empresa. Un gasto personal del socio es un retiro: va a su cuenta particular.',
      trampa: true,
      explicacion: 'Los gastos personales de los socios no son gastos de la sociedad: se imputan a la cuenta particular del socio (crédito contra él o retiro a cuenta de utilidades).',
    };
  },
  facturaFutura: (c) => {
    const neto = r0(c.base * c.rng.range(0.5, 1) / 1000) * 1000;
    const iva = pct(neto, 0.21);
    const mesSig = MESES[c.mes % 12];
    return {
      id: 'facturaFutura',
      fecha: dia(c, 27, 28),
      titulo: `Factura de seguro con cobertura desde el 1° de ${mesSig}`,
      detalle: [`Factura A · Seguros del Litoral SA · emitida el ${String(c.rng.int(27, 28)).padStart(2, '0')}/${String(c.mes).padStart(2, '0')}`, `Neto ${money(neto)} · IVA ${money(iva)}`, `Período de cobertura: todo ${mesSig}. Todavía no se pagó.`],
      chips: [{ label: 'Neto', monto: neto }, { label: 'IVA', monto: iva }, { label: 'Total', monto: neto + iva }],
      sugeridas: ['4.2.02.03', '1.1.04.06', '1.1.04.01', '2.1.01.01'],
      solucion: { lineas: [] },
      propuesta: { lineas: [D('4.2.02.03', neto), D('1.1.04.01', iva), H('2.1.01.01', neto + iva)] },
      errorTipico: 'El sistema devengó el seguro este mes. La cobertura empieza el mes que viene y no se pagó: no corresponde registrar nada todavía en este período.',
      noRegistrar: true,
      trampa: true,
      explicacion: `El gasto se devenga en el período en que se consume la cobertura (${mesSig}). Como además no se pagó, este mes no hay nada que registrar.`,
    };
  },
};

const ORDEN = ['pagoSueldos', 'alquiler', 'ventaA', 'ventaB', 'compra', 'cobro', 'cuotaPrestamo', 'sicore', 'bienUso', 'pagoProveedor', 'gastoSocio', 'anticipo', 'facturaFutura', 'sueldos', 'banco', 'posicionIva'];

export function generarCasoAsientos(seed: number, client: ClientLike, periodo: string, indice: number): CasoAsientos {
  const rng = makeRng(seed);
  const [anio, mes] = periodo.split('-').map(Number);
  const base = 420_000 * indice * Math.max(0.5, Math.min(3, (client.volumen ?? 120) / 120));
  const ctx: Ctx = { rng, idx: 0, base, mes: mes || 1, anio: anio || 2027, empleados: Math.min(6, client.empleados ?? 0), n: 0 };
  // núcleo siempre presente
  const fijas = ['ventaA', 'compra', 'cobro', 'posicionIva', 'banco'];
  const conSueldos = (client.empleados ?? 0) > 0;
  if (conSueldos) fijas.push('sueldos');
  const opcionales = ['ventaB', 'pagoProveedor', 'alquiler', 'bienUso', 'cuotaPrestamo', 'sicore'].concat(conSueldos ? ['pagoSueldos'] : []);
  const trampas = ['anticipo', 'gastoSocio', 'facturaFutura'];
  const nOpc = rng.int(2, 4);
  const elegidas = new Set<string>([...fijas, ...rng.shuffle(opcionales).slice(0, nOpc), ...rng.shuffle(trampas).slice(0, rng.int(1, 2))]);
  const ids = ORDEN.filter((k) => elegidas.has(k));
  const operaciones = ids.map((k) => PLANTILLAS[k](ctx));
  return { periodo, periodoLabel: `${MESES[(mes || 1) - 1]} ${anio}`, cliente: client.nombre, operaciones };
}

export type RespuestasAsientos = Record<string, Asiento | undefined>;

export function respuestasPerfectas(caso: CasoAsientos): RespuestasAsientos {
  return Object.fromEntries(caso.operaciones.map((o) => [o.id, { lineas: o.solucion.lineas.map((l) => ({ ...l })) }]));
}

export function evaluarAsientos(caso: CasoAsientos, resp: RespuestasAsientos): MinigameResult {
  let puntos = 0;
  let pesoTotal = 0;
  const errores: string[] = [];
  let perfectos = 0;
  for (const o of caso.operaciones) {
    const peso = o.trampa ? 2 : 1;
    pesoTotal += peso;
    const a = resp[o.id] ?? { lineas: [] };
    const cmp = comparar(a, o.solucion);
    const score = cmp.cuentas * 0.6 + cmp.importes * 0.4;
    puntos += score * peso;
    if (score >= 0.999) perfectos += 1;
    else {
      const det: string[] = [];
      if (o.noRegistrar && a.lineas.length) det.push('no correspondía registrar nada este mes');
      if (cmp.faltan.length) det.push(`faltó ${cmp.faltan.map((l) => `${l.debe ? 'debitar' : 'acreditar'} ${l.cuenta}`).join(', ')}`);
      if (cmp.sobran.length && !o.noRegistrar) det.push(`sobró ${cmp.sobran.map((l) => l.cuenta).join(', ')}`);
      if (cmp.importesMal.length) det.push(`importe incorrecto en ${cmp.importesMal.map((l) => l.cuenta).join(', ')}`);
      errores.push(`${o.titulo}: ${det.join('; ') || 'asiento incompleto'}. ${o.explicacion}`);
    }
  }
  const score = pesoTotal ? Math.round((puntos / pesoTotal) * 1000) / 1000 : 0;
  const n = caso.operaciones.length;
  const resumen = perfectos === n ? `Las ${n} operaciones quedaron registradas sin observaciones. Libro Diario impecable.` : `${perfectos} de ${n} asientos correctos. ${n - perfectos} con observaciones.`;
  return { score, resumen, errores: errores.slice(0, 8).concat(errores.length > 8 ? [`…y ${errores.length - 8} observaciones más`] : []) };
}

/** Sumas y saldos resultantes de los asientos registrados (para la vista final). */
export function sumasYSaldos(resp: RespuestasAsientos): { cuenta: string; debe: number; haber: number; saldo: number }[] {
  const m = new Map<string, { debe: number; haber: number }>();
  for (const a of Object.values(resp)) {
    for (const l of a?.lineas ?? []) {
      const e = m.get(l.cuenta) ?? { debe: 0, haber: 0 };
      e.debe += l.debe;
      e.haber += l.haber;
      m.set(l.cuenta, e);
    }
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([cuenta, e]) => ({ cuenta, debe: round(e.debe), haber: round(e.haber), saldo: round(e.debe - e.haber) }));
}
