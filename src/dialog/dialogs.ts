// Motor de conversaciones con clientes + guiones. Puro: todo pasa por el rng y muta `s` dentro de immer.
import { MONOTRIBUTO_CATEGORIAS, MULTA_FORMAL_PH, MULTA_FORMAL_SOC } from '../engine/config';
import { ajustarReputacion, ajustarSatisfaccion, clientesActivos, fx, mov, player, precio } from '../engine/core';
import { crearTareaEspecial, darDeBaja } from '../engine/events';
import { money } from '../engine/format';
import type { Rng } from '../engine/rng';
import { hasTool } from '../engine/tools';
import type { Client, GameState, ObligationKind } from '../engine/types';
import type { DialogCtx, DialogDef, DialogNode, DialogOption, DialogState } from './types';

const corto = (n: string) => n.split(' (')[0];
const nombre = (c: Client) => corto(c.nombre).split(' ')[0];
const yo = (ctx: DialogCtx) => ctx.s.estudio.titular.split(' ').slice(-1)[0];
const esSociedad = (c: Client) => c.kind === 'srl' || c.kind === 'sas' || c.kind === 'sa';
const errorLatente = (ctx: DialogCtx, kind: ObligationKind, gravedad: 1 | 2 | 3) =>
  ctx.c.erroresLatentes.push({ taskId: 'dialogo', kind, periodo: ctx.s.date.slice(0, 7), gravedad, desde: ctx.s.date });
const riesgo = (c: Client, d: number) => (c.riesgoFiscal = Math.round(Math.min(0.95, Math.max(0.02, c.riesgoFiscal + d)) * 100) / 100);
const fin = (texto: (ctx: DialogCtx) => string, resumen: (ctx: DialogCtx) => string, quien: DialogNode['quien'] = 'narrador', mood?: DialogNode['mood']): DialogNode => ({ quien, texto, fin: true, resumen, mood });
const op = (id: string, texto: string | ((ctx: DialogCtx) => string), siguiente: DialogOption['siguiente'], extra: Partial<DialogOption> = {}): DialogOption => ({
  id,
  texto: typeof texto === 'string' ? () => texto : texto,
  siguiente,
  ...extra,
});

// ============================================================================ guiones

const iva: DialogDef = {
  id: 'iva_alto',
  titulo: '¿Por qué pago tanto de IVA?',
  icon: '🧾',
  aplica: (_s, c) => c.kind !== 'monotributista',
  peso: () => 3,
  params: (s, c, rng) => ({ saldo: precio(s, Math.round(c.honorario * rng.range(1.5, 4))) }),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'sorpresa',
      texto: (x) => `${yo(x)}, ¿${money(Number(x.p.saldo))} de IVA este mes? ¡Es una locura! Mi cuñado tiene un negocio parecido y paga la mitad. ¿No podemos meter más facturas de gastos?`,
      opciones: [
        op('explicar', 'Te explico cómo se arma el saldo: lo que cobrás menos lo que pagaste', 'b', { tono: 'empatico', hint: 'Lo bajás a tierra con números.' }),
        op('que_facturas', '¿Qué facturas tenés en mente?', 'c', { tono: 'firme' }),
        op('ceder', 'Bueno, traeme lo que tengas y vemos qué entra', 'd', { tono: 'cedes', hint: 'Plata fácil para él, riesgo para los dos.' }),
      ],
    },
    b: {
      quien: 'titular',
      texto: (x) => `Vendiste ${money(Number(x.p.saldo) * 5)} con IVA: eso es débito fiscal. Compraste con factura A por mucho menos: ese es tu crédito. La diferencia no la pagás vos, la cobraste de tus clientes y la tenés que depositar.`,
      siguiente: 'b2',
    },
    b2: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Ah... o sea que la plata nunca fue mía. Igual, ¿no hay forma de pagar menos?',
      opciones: [
        op('planificar', 'Sí: ordenar compras, inversiones y forma jurídica. Te armo una planificación fiscal', 'plan', { tono: 'comercial', hint: 'Trabajo cobrable.' }),
        op('consejo', 'Pedí siempre factura A a tus proveedores y no pagues en negro. Ahí perdés crédito', 'fin_consejo', { tono: 'empatico' }),
      ],
    },
    c: {
      quien: 'cliente',
      mood: 'feliz',
      texto: () => 'Tengo la factura del aire acondicionado de casa, la cena de aniversario, la nafta del auto de mi señora... todo A, eh. Me las hice hacer a nombre del negocio.',
      opciones: [
        op('no', 'Eso no es crédito fiscal: no tiene que ver con tu actividad. Si lo computamos y nos fiscalizan, pagás el impuesto más multa e intereses', 'c_no', { tono: 'etico' }),
        op('si', 'Dale, las cargo. Total son chicas', 'd', { tono: 'cedes' }),
      ],
    },
    c_no: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Uf, qué estricto. Pero bueno, para eso te pago, supongo.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -4);
        ajustarReputacion(x.s, 0.6);
      },
      siguiente: 'b2',
    },
    d: {
      quien: 'narrador',
      texto: () => 'Cargás los gastos personales como crédito fiscal. El saldo baja y el cliente se va chocho. Vos te quedás con una sensación rara.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 12);
        errorLatente(x, 'iva', 2);
        riesgo(x.c, 0.1);
      },
      siguiente: 'fin_d',
    },
    fin_d: fin(
      (x) => `${nombre(x.c)}: "¡Así me gusta, un contador con cintura!"`,
      () => 'Computaste gastos personales. Riesgo fiscal del cliente en alza.',
      'cliente',
      'feliz',
    ),
    plan: {
      quien: 'cliente',
      mood: 'feliz',
      texto: (x) => `Dale, si me ahorrás más de lo que me cobrás, cerrado. ¿${money(precio(x.s, 180_000))} dijiste?`,
      efecto: (x) => {
        const t = crearTareaEspecial(x.s, x.c, 'consulta', 'Planificación fiscal', { liquidacion: 4, revision: 1, presentacion: 0.5 }, 12);
        t.honorarioExtra = precio(x.s, 180_000);
        ajustarSatisfaccion(x.c, 5);
      },
      siguiente: 'fin_plan',
    },
    fin_plan: fin(() => 'Agendaste la planificación fiscal. Trabajo nuevo, facturable.', () => 'Nueva tarea cobrable: planificación fiscal.'),
    fin_consejo: fin(
      (x) => `${nombre(x.c)} anota en el celular: "pedir factura A". Algo es algo.`,
      () => 'El cliente entendió el IVA (por ahora).',
    ),
  },
};

const honorarios: DialogDef = {
  id: 'honorarios',
  titulo: 'Otro estudio me cobra la mitad',
  icon: '💲',
  aplica: () => true,
  peso: (_s, c) => (c.satisfaccion < 60 ? 3 : 1.5),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'neutral',
      texto: (x) => `Te voy a ser sincero/a: un estudio de la zona me ofrece hacer todo por ${money(Math.round((x.c.honorario * 0.5) / 1000) * 1000)}. Vos me cobrás ${money(x.c.honorario)}. ¿Qué hacemos?`,
      opciones: [
        op('bajar', 'Te lo igualo, no te quiero perder', 'bajar', { tono: 'cedes', hint: 'Honorario −20%.' }),
        op('alcance', 'Puedo bajar el precio si bajamos el alcance: los sueldos los liquidás con ellos', 'alcance', { tono: 'comercial', hint: 'Menos plata, menos horas.' }),
        op('sostener', 'Por la mitad no te van a atender el teléfono cuando llegue la inspección. Mi precio es este', 'sostener', { tono: 'firme', hint: 'Depende de tu reputación.' }),
        op('valor', 'Al revés: te muestro todo lo que hicimos este año y lo que te ahorramos. El abono debería subir', 'valor', { tono: 'comercial', hint: 'Value pricing. Funciona si está contento.', requiere: (x) => x.c.satisfaccion >= 55 }),
      ],
    },
    bajar: {
      quien: 'narrador',
      texto: () => 'Le bajás un 20%. Sonríe. Vos hacés la cuenta de cuántas horas le dedicás y la sonrisa no te sale.',
      efecto: (x) => {
        x.c.honorario = Math.round((x.c.honorario * 0.8) / 1000) * 1000;
        ajustarSatisfaccion(x.c, 15);
      },
      siguiente: 'fin_bajar',
    },
    fin_bajar: fin(() => 'Cliente retenido con descuento.', () => 'Abono −20%. Contento, pero ahora sabe que podés bajar.'),
    alcance: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Mmm... ¿y si el otro estudio me liquida mal los sueldos y después tengo un juicio? No, mejor dejá todo con vos. Pero algo bajame.',
      opciones: [
        op('diez', 'Un 10%, y que quede claro qué incluye el abono', 'fin_alcance', { tono: 'comercial', efecto: (x) => { x.c.honorario = Math.round((x.c.honorario * 0.9) / 1000) * 1000; ajustarSatisfaccion(x.c, 8); } }),
        op('nada', 'Entonces el precio es el precio. El alcance completo vale eso', 'sostener', { tono: 'firme' }),
      ],
    },
    fin_alcance: fin(() => 'Firmaron un anexo con el alcance detallado. Nunca más "¿esto también está incluido?".', () => 'Abono −10% con alcance por escrito.'),
    sostener: {
      quien: 'narrador',
      texto: (x) => (x.s.estudio.reputacion >= 50 || x.c.satisfaccion >= 70 ? 'Silencio. Te mira. Mira el celular. Vuelve a mirarte.' : 'Se queda callado/a y junta sus cosas.'),
      siguiente: (x) => (x.s.estudio.reputacion >= 50 || x.c.satisfaccion >= 70 ? 'sostener_ok' : x.rng.chance(0.5) ? 'sostener_ok' : 'sostener_mal'),
    },
    sostener_ok: {
      quien: 'cliente',
      mood: 'feliz',
      texto: () => 'Tenés razón. El año pasado cuando cayó la inspección vos estabas a las 8 de la mañana en la puerta. Seguimos igual.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 4);
        ajustarReputacion(x.s, 1);
      },
      siguiente: 'fin_sostener_ok',
    },
    fin_sostener_ok: fin(() => 'Sostuviste el precio y el cliente valoró el servicio.', () => 'Precio sostenido. Reputación +1.'),
    sostener_mal: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Entonces me voy con ellos. Gracias por todo, pasame las claves.',
      efecto: (x) => darDeBaja(x.s, x.c, 'Se fue por precio'),
      siguiente: 'fin_sostener_mal',
    },
    fin_sostener_mal: fin(() => 'Perdiste al cliente. A veces pasa: no todos valoran lo mismo.', () => 'Cliente perdido por precio.'),
    valor: {
      quien: 'titular',
      texto: (x) => `Este año presentamos todo en término, cero multas, te ordenamos los papeles y atendimos ${x.rng.int(3, 9)} consultas fuera del abono sin cobrarte. Con la inflación, el abono quedó atrasado. Lo justo es ${money(Math.round((x.c.honorario * 1.15) / 1000) * 1000)}.`,
      siguiente: (x) => (x.c.satisfaccion > 70 ? 'valor_ok' : 'valor_meh'),
    },
    valor_ok: {
      quien: 'cliente',
      mood: 'sorpresa',
      texto: () => '...La verdad, puesto así, no me había dado cuenta de todo lo que hacen. Dale, actualizalo. Pero mandame un resumen mensual así se lo muestro a mi socio.',
      efecto: (x) => {
        x.c.honorario = Math.round((x.c.honorario * 1.15) / 1000) * 1000;
        x.c.honorarioIndice = x.s.inflacion.indice;
        ajustarSatisfaccion(x.c, 3);
        ajustarReputacion(x.s, 1.5);
      },
      siguiente: 'fin_valor_ok',
    },
    fin_valor_ok: fin(() => '¡Le subiste el abono a un cliente que vino a pedirte descuento! Eso es vender valor.', () => 'Abono +15%. Value pricing.'),
    valor_meh: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¿Subirlo? ¿Me estás cargando? Vengo a pedir una rebaja y me querés cobrar más.',
      opciones: [
        op('retroceder', 'Tenés razón, me fui al pasto. Dejémoslo como está', 'fin_meh', { tono: 'empatico', efecto: (x) => ajustarSatisfaccion(x.c, -6) }),
        op('firme', 'Es lo que vale el trabajo. Si no lo ves, quizás el otro estudio sea para vos', 'sostener', { tono: 'firme' }),
      ],
    },
    fin_meh: fin(() => 'Quedó todo igual. Y un poco tenso.', () => 'Sin cambios. Satisfacción −6.'),
  },
};

const multa: DialogDef = {
  id: 'multa_discusion',
  titulo: '¡Vos tenías que avisarme!',
  icon: '💸',
  aplica: (s, c) => s.tasks.some((t) => t.clientId === c.id && t.estado === 'presentada_tarde'),
  peso: () => 3,
  params: (s, c) => ({ monto: precio(s, esSociedad(c) ? MULTA_FORMAL_SOC : MULTA_FORMAL_PH) }),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'estres',
      texto: (x) => `¡Me llegó una multa de ${money(Number(x.p.monto))} por una presentación fuera de término! ¿Para qué te pago? ¡Vos tenías que avisarme!`,
      opciones: [
        op('asumir', 'Tenés razón, fue nuestra responsabilidad. La multa la paga el estudio', 'asumir', { tono: 'empatico', hint: 'Cuesta plata, salva la relación.' }),
        op('chats', 'Mirá el WhatsApp: te pedí los papeles el 3, el 10 y el 15. Llegaron el 22', 'chats', { tono: 'firme', hint: 'Funciona si el cliente es desordenado de verdad.' }),
        op('mitad', 'Pongamos la mitad cada uno y veamos cómo evitarlo la próxima', 'mitad', { tono: 'comercial' }),
      ],
    },
    asumir: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Bueno... está bien. Te agradezco que te hagas cargo. Pero que no vuelva a pasar.',
      efecto: (x) => {
        mov(x.s, -Number(x.p.monto), 'multas', `Multa asumida en discusión · ${x.c.nombre}`);
        fx(x.s, 'multa', { monto: Number(x.p.monto) });
        ajustarSatisfaccion(x.c, 6);
      },
      siguiente: 'fin_asumir',
    },
    fin_asumir: fin(() => 'Pagaste la multa. El cliente se calmó.', (x) => `Multa de ${money(Number(x.p.monto))} a cargo del estudio.`),
    chats: {
      quien: 'narrador',
      texto: () => 'Le mostrás la pantalla del celular con los tres reclamos. Lee en silencio.',
      siguiente: (x) => (x.c.ordenDocumental < 0.4 ? 'chats_ok' : 'chats_mal'),
    },
    chats_ok: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Ehh... sí, tenés razón. Soy un desastre con los papeles. La pago yo. ¿Me ayudás a organizarme?',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -3);
        x.c.ordenDocumental = Math.min(0.95, x.c.ordenDocumental + 0.1);
        ajustarReputacion(x.s, 0.5);
      },
      siguiente: 'fin_chats_ok',
    },
    fin_chats_ok: fin(() => 'El cliente pagó la multa y prometió ordenarse. Veremos.', () => 'Multa a cargo del cliente. Orden documental +0.1.'),
    chats_mal: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¿Tres mensajes? Yo te mandé todo a tiempo, lo que pasa es que vos estás tapado de trabajo. No me vengas con pantallas.',
      efecto: (x) => ajustarSatisfaccion(x.c, -14),
      opciones: [
        op('retroceder', 'Perdón, me equivoqué de cliente. La pago yo', 'asumir', { tono: 'empatico' }),
        op('insistir', 'Los mensajes están ahí. La multa es tuya', 'fin_chats_mal', { tono: 'firme', efecto: (x) => { ajustarSatisfaccion(x.c, -10); ajustarReputacion(x.s, -1); } }),
      ],
    },
    fin_chats_mal: fin(() => 'Pagó la multa, furioso. En la Cámara va a contar su versión.', () => 'Cliente furioso. Reputación −1.'),
    mitad: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Dale, mitad y mitad. ¿Y cómo hacemos para que no pase más?',
      efecto: (x) => {
        mov(x.s, -Number(x.p.monto) / 2, 'multas', `50% multa · ${x.c.nombre}`);
        ajustarSatisfaccion(x.c, -2);
      },
      opciones: [
        op('portal', 'Subí todo al portal antes del 10 de cada mes y yo te aviso lo que falta', 'fin_mitad_portal', { tono: 'comercial', requiere: (x) => hasTool(x.s.tools, 'portal_clientes'), hint: 'Requiere portal de clientes.', efecto: (x) => (x.c.ordenDocumental = Math.min(0.95, x.c.ordenDocumental + 0.15)) }),
        op('calendario', 'Te mando un recordatorio mensual con la lista de lo que necesito', 'fin_mitad', { tono: 'empatico', efecto: (x) => (x.c.ordenDocumental = Math.min(0.95, x.c.ordenDocumental + 0.05)) }),
      ],
    },
    fin_mitad: fin(() => 'Multa compartida y un recordatorio mensual nuevo.', () => 'Multa compartida. Orden documental +0.05.'),
    fin_mitad_portal: fin(() => 'Lo diste de alta en el portal. Ahora los papeles llegan solos (casi).', () => 'Multa compartida. Orden documental +0.15.'),
  },
};

const blanqueo: DialogDef = {
  id: 'blanqueo_mitad',
  titulo: 'Blanqueame al pibe la mitad',
  icon: '👷',
  aplica: (_s, c) => c.kind !== 'monotributista' || c.empleados > 0,
  peso: () => 2,
  params: (s, _c, rng) => ({ sueldo: precio(s, rng.int(900, 1400) * 1000) }),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'neutral',
      texto: (x) => `Tomé un pibe para el depósito. Le pago ${money(Number(x.p.sueldo))}. Registrámelo por ${money(Number(x.p.sueldo) / 2)} y el resto se lo doy en mano, como hace todo el mundo.`,
      opciones: [
        op('no', 'No. Si se accidenta o te hace juicio, la diferencia la pagás multiplicada. Y la multa laboral es enorme', 'no', { tono: 'etico' }),
        op('alternativa', 'Si realmente trabaja medio día, lo registramos a tiempo parcial. Si no, hay otras opciones legales', 'alt', { tono: 'comercial' }),
        op('si', 'Está bien, lo registro por la mitad', 'si', { tono: 'cedes', hint: 'Riesgo laboral y previsional.' }),
      ],
    },
    no: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¡Pero si todos lo hacen! Me vas a fundir con las cargas sociales.',
      opciones: [
        op('explicar', 'Una indemnización con multas por registración deficiente son varios sueldos. Hacé la cuenta', 'no2', { tono: 'firme' }),
        op('ceder', 'Bueno, por este mes lo registro así y después vemos', 'si', { tono: 'cedes' }),
      ],
    },
    no2: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Qué país... Está bien, registralo completo. Pero conseguime algún beneficio.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -6);
        ajustarReputacion(x.s, 1);
      },
      siguiente: 'fin_no',
    },
    fin_no: fin(() => 'Empleado registrado como corresponde. Le buscás los beneficios para nuevos empleados.', () => 'Registración completa. Reputación +1.'),
    alt: {
      quien: 'cliente',
      mood: 'sorpresa',
      texto: () => '¿Tiempo parcial? ¿Eso existe? Contame.',
      siguiente: 'alt2',
    },
    alt2: {
      quien: 'titular',
      texto: () => 'Si trabaja hasta dos tercios de la jornada, se registra como jornada parcial con el sueldo proporcional. Y hay reducciones de contribuciones para nuevos empleados en PyMEs. Todo legal, todo defendible.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 6);
        ajustarReputacion(x.s, 0.8);
        const t = crearTareaEspecial(x.s, x.c, 'consulta', 'Alta de empleado y beneficios PyME', { carga: 1, liquidacion: 1.5, presentacion: 0.5 }, 8);
        t.honorarioExtra = precio(x.s, 60_000);
      },
      siguiente: 'fin_alt',
    },
    fin_alt: fin(() => 'Encontraste la salida legal. El cliente ahorra, el pibe queda cubierto y vos facturás el alta.', () => 'Alta a tiempo parcial. Tarea cobrable.'),
    si: {
      quien: 'narrador',
      texto: () => 'Registrás al empleado por la mitad. El cliente te palmea la espalda. Vos pensás en el día que ese pibe se tuerza un tobillo.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 10);
        riesgo(x.c, 0.2);
        errorLatente(x, 'sueldos', 3);
        errorLatente(x, 'f931', 2);
      },
      siguiente: 'fin_si',
    },
    fin_si: fin(() => 'Hecho. Que no haya accidentes.', () => 'Registración deficiente. Riesgo laboral alto.'),
  },
};

const bolsa: DialogDef = {
  id: 'bolsa_tickets',
  titulo: 'La bolsa de tickets',
  icon: '🛍️',
  aplica: (_s, c) => c.ordenDocumental < 0.55,
  peso: (_s, c) => (c.ordenDocumental < 0.3 ? 3 : 1.5),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'feliz',
      texto: () => '¡Acá te traje todo! *apoya una bolsa de supermercado llena de tickets arrugados* Son de los últimos tres meses. Vence hoy, ¿no?',
      opciones: [
        op('firme', 'Vence hoy, sí. Y esto lleva dos días de carga. Vas a pagar multa, y la próxima lo necesito antes del 10', 'firme', { tono: 'firme' }),
        op('extra', 'Dejá, me quedo hasta la noche y lo saco', 'extra', { tono: 'cedes', hint: 'Estrés para vos.' }),
        op('sistema', 'Esto no puede seguir así. Te propongo un sistema para que me mandes todo ordenado cada mes', 'sistema', { tono: 'comercial' }),
      ],
    },
    firme: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Uy... no sabía que era tanto laburo. Perdón. ¿Qué multa es?',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -5);
        x.c.ordenDocumental = Math.min(0.95, x.c.ordenDocumental + 0.08);
      },
      siguiente: 'fin_firme',
    },
    fin_firme: fin(() => 'Le marcaste los límites. Puede que la próxima traiga una carpeta en vez de una bolsa.', () => 'Límites claros. Orden documental +0.08.'),
    extra: {
      quien: 'narrador',
      texto: () => 'Son las 22:30. Tenés los dedos manchados de tinta de ticket térmico y acabás de descubrir que la bolsa tenía también un sándwich del mes pasado.',
      efecto: (x) => {
        const p = player(x.s);
        p.estres = Math.min(100, p.estres + 25);
        ajustarSatisfaccion(x.c, 8);
      },
      siguiente: 'fin_extra',
    },
    fin_extra: fin(() => 'Lo presentaste a tiempo. El cliente ni se enteró del esfuerzo.', () => 'Presentado a pulmón. Estrés +25.'),
    sistema: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => '¿Un sistema? Yo con el celular me arreglo, no me hagas instalar cosas.',
      opciones: [
        op('portal', 'Es sacarle foto al ticket y subirlo al portal. Nada más', 'fin_portal', { tono: 'comercial', requiere: (x) => hasTool(x.s.tools, 'portal_clientes'), hint: 'Requiere portal de clientes.', efecto: (x) => { x.c.ordenDocumental = Math.min(0.95, x.c.ordenDocumental + 0.15); ajustarSatisfaccion(x.c, 4); } }),
        op('carpeta', 'Una carpeta por mes. Compras, ventas, bancos. Te la armo yo la primera vez', 'fin_carpeta', { tono: 'empatico', efecto: (x) => { x.c.ordenDocumental = Math.min(0.95, x.c.ordenDocumental + 0.07); ajustarSatisfaccion(x.c, 2); } }),
      ],
    },
    fin_portal: fin(() => 'Le instalaste el portal en el celular ahí mismo. Primera foto: el sándwich.', () => 'Cliente en el portal. Orden documental +0.15.'),
    fin_carpeta: fin(() => 'Carpetas de colores, etiquetas, todo. Dura hasta que se le acaben las etiquetas.', () => 'Carpetas mensuales. Orden documental +0.07.'),
  },
};

const intimacion: DialogDef = {
  id: 'intimacion',
  titulo: 'Me llegó algo de ARCA',
  icon: '🏛️',
  aplica: (_s, c) => c.kind !== 'monotributista' || c.erroresLatentes.length > 0,
  peso: (_s, c) => (c.erroresLatentes.length ? 3 : 1.2),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¡Me llegó un mail de ARCA al domicilio fiscal electrónico! Dice "inconsistencias detectadas" y un montón de números. ¿Me van a embargar?',
      opciones: [
        op('calmar', 'Tranquilo/a. Reenviámelo, lo analizo y te digo exactamente qué es. La mayoría se contesta con un descargo', 'calmar', { tono: 'empatico' }),
        op('minimizar', 'Esos mails los mandan a todo el mundo. Ignoralo', 'minimizar', { tono: 'cedes', hint: 'Si hay errores latentes, se pone feo.' }),
      ],
    },
    calmar: {
      quien: 'narrador',
      texto: (x) => (x.c.erroresLatentes.length ? 'Lo leés con atención. Es un cruce de información: hay una diferencia real entre lo declarado y lo informado por terceros.' : 'Lo leés: es una inconsistencia menor entre el padrón y lo declarado. Se contesta con un descargo de una página.'),
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 6);
        const t = crearTareaEspecial(x.s, x.c, 'consulta', 'Descargo ante ARCA', { carga: 1, liquidacion: 2, revision: 0.5, presentacion: 0.5 }, 10);
        t.honorarioExtra = precio(x.s, 90_000);
      },
      siguiente: (x) => (x.c.erroresLatentes.length ? 'calmar_error' : 'fin_calmar'),
    },
    calmar_error: {
      quien: 'titular',
      texto: () => 'Hay una diferencia que viene de una declaración anterior. Conviene rectificar antes de que lo pidan: pagás intereses pero evitás la multa por omisión.',
      efecto: (x) => {
        const e = x.c.erroresLatentes.shift();
        if (e) crearTareaEspecial(x.s, x.c, 'rectificativa', `Rectificativa preventiva`, { carga: 1, liquidacion: 2, revision: 0.7, presentacion: 0.5 }, 10, { prioridad: true });
        ajustarReputacion(x.s, 0.5);
      },
      siguiente: 'fin_calmar',
    },
    fin_calmar: fin(() => 'El cliente respira. Vos tenés un descargo (cobrable) para preparar.', () => 'Descargo ante ARCA agendado y cobrable.'),
    minimizar: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Ah, menos mal. Qué susto me pegué.',
      siguiente: (x) => (x.c.erroresLatentes.length ? 'minimizar_mal' : 'fin_minimizar_ok'),
    },
    fin_minimizar_ok: fin(() => 'Pasaron tres semanas y no pasó nada. Zafaste. Esta vez.', () => 'Ignorado sin consecuencias (por suerte).'),
    minimizar_mal: {
      quien: 'narrador',
      texto: () => 'Tres semanas después llega el requerimiento formal: 10 días hábiles para aportar libros, extractos y papeles de trabajo. Y el cliente se acuerda de que vos dijiste "ignoralo".',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -18);
        ajustarReputacion(x.s, -1);
        crearTareaEspecial(x.s, x.c, 'requerimiento', `Requerimiento ARCA · ${nombre(x.c)}`, { recopilar: 1.5, carga: 2, liquidacion: 6, revision: 1.5, presentacion: 1 }, 10, { prioridad: true, periodo: 'fiscalizacion' });
        fx(x.s, 'inspector', { clientId: x.c.id });
      },
      siguiente: 'fin_minimizar_mal',
    },
    fin_minimizar_mal: fin(() => 'Fiscalización en marcha. Y un cliente que ya no confía igual.', () => 'Requerimiento ARCA. Satisfacción −18.'),
  },
};

const negro: DialogDef = {
  id: 'pago_negro',
  titulo: 'Sin factura te pago antes',
  icon: '💵',
  aplica: (_s, c) => c.pagador < 0.75,
  peso: () => 1.5,
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'feliz',
      texto: (x) => `Mirá, te debo ${x.rng.int(2, 3)} meses, lo sé. Pero tengo efectivo acá. Si no me hacés factura te pago todo hoy, en mano, y un 10% más por la molestia.`,
      opciones: [
        op('no', 'Te lo agradezco, pero yo facturo todo. Es lo que les exijo a ustedes', 'no', { tono: 'etico' }),
        op('si', 'Dale, pasame el efectivo', 'si', { tono: 'cedes', hint: 'Plata hoy. Y una mancha.' }),
      ],
    },
    no: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Bueno, bueno, era para ayudarte. Te transfiero la semana que viene con factura.',
      efecto: (x) => {
        ajustarReputacion(x.s, 0.8);
        for (const i of x.s.invoices) if (i.clientId === x.c.id && !i.cobradaEl && !i.incobrable) i.pagaEl = x.s.date;
      },
      siguiente: 'fin_no',
    },
    fin_no: fin(() => 'Coherencia: la misma vara para el cliente y para vos. Transfirió al final.', () => 'Cobro regularizado con factura. Reputación +0.8.'),
    si: {
      quien: 'narrador',
      texto: () => 'Contás los billetes en el baño. Entra la plata, sale la factura que nunca existió. Si alguna vez te cruzan los movimientos de este cliente, hay un agujero con tu nombre.',
      efecto: (x) => {
        let total = 0;
        for (const i of x.s.invoices) if (i.clientId === x.c.id && !i.cobradaEl && !i.incobrable) { i.incobrable = true; total += i.monto; }
        mov(x.s, total * 1.1, 'otros', `Cobro en efectivo sin factura · ${x.c.nombre}`);
        x.s.estudio.faltasEticas += 1;
        ajustarSatisfaccion(x.c, 8);
      },
      siguiente: 'fin_si',
    },
    fin_si: fin(() => 'Cobraste en negro. El estudio propio también se puede fiscalizar.', () => 'Cobro en negro. Falta ética registrada.'),
  },
};

const seVa: DialogDef = {
  id: 'se_quiere_ir',
  titulo: 'Creo que me voy a ir',
  icon: '🚪',
  aplica: (_s, c) => c.satisfaccion < 40,
  peso: () => 3,
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Quería decírtelo en persona. No estoy conforme. Siento que soy un número más y estoy pensando en cambiar de estudio.',
      opciones: [
        op('escuchar', '¿Qué fue lo que te molestó? Quiero entenderlo', 'escuchar', { tono: 'empatico' }),
        op('descuento', 'Te hago un 15% de descuento por seis meses y me ocupo personalmente', 'descuento', { tono: 'comercial' }),
        op('soltar', 'Lo entiendo. Te preparo todo para la transición, sin rencores', 'soltar', { tono: 'firme' }),
      ],
    },
    escuchar: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Nunca sé en qué están mis impuestos. Me entero de los vencimientos cuando ya pasaron. Y cuando llamo, atiende alguien distinto cada vez.',
      opciones: [
        op('plan', 'Tenés razón. Desde ahora: un referente fijo y un resumen mensual con tu situación. Dame tres meses', 'plan', { tono: 'empatico' }),
        op('excusa', 'Es que son muchos clientes y poca gente. Hacemos lo que podemos', 'fin_excusa', { tono: 'cedes', efecto: (x) => ajustarSatisfaccion(x.c, -8) }),
      ],
    },
    plan: {
      quien: 'cliente',
      mood: 'feliz',
      texto: () => 'Bueno... eso es lo que quería escuchar. Tres meses. Si funciona, me quedo.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 22);
        ajustarReputacion(x.s, 0.5);
      },
      siguiente: 'fin_plan',
    },
    fin_plan: fin(() => 'Lo retuviste escuchando. Ahora hay que cumplir.', () => 'Cliente retenido con plan de mejora. Satisfacción +22.'),
    fin_excusa: fin(() => 'Se fue sin decir nada. Probablemente no vuelva.', () => 'Excusa pobre. Satisfacción −8.'),
    descuento: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'El problema no era el precio, pero bueno... acepto. Veamos si cambia algo.',
      efecto: (x) => {
        x.c.honorario = Math.round((x.c.honorario * 0.85) / 1000) * 1000;
        ajustarSatisfaccion(x.c, 10);
      },
      siguiente: 'fin_descuento',
    },
    fin_descuento: fin(() => 'Retenido con descuento. Cobrás menos y el problema de fondo sigue.', () => 'Abono −15%. Satisfacción +10.'),
    soltar: {
      quien: 'cliente',
      mood: 'sorpresa',
      texto: () => 'Guau. Gracias por la elegancia. Si alguien me pregunta, voy a hablar bien de vos.',
      efecto: (x) => {
        ajustarReputacion(x.s, 1.5);
        darDeBaja(x.s, x.c, 'Se fue en buenos términos');
      },
      siguiente: 'fin_soltar',
    },
    fin_soltar: fin(() => 'Perdiste un cliente y ganaste un embajador.', () => 'Baja en buenos términos. Reputación +1.5.'),
  },
};

const sas: DialogDef = {
  id: 'pasar_sas',
  titulo: '¿Me conviene pasar a SAS?',
  icon: '🏢',
  aplica: (_s, c) => c.kind === 'monotributista',
  peso: () => 2,
  params: (s, c, rng) => {
    const cat = MONOTRIBUTO_CATEGORIAS.find((k) => k.cat === c.categoria) ?? MONOTRIBUTO_CATEGORIAS[3];
    const tope = MONOTRIBUTO_CATEGORIAS[MONOTRIBUTO_CATEGORIAS.length - 1].ingresos * s.inflacion.indice;
    const cerca = rng.chance(0.5);
    const fact = cerca ? Math.round(tope * rng.range(0.88, 1.05)) : Math.round(cat.ingresos * s.inflacion.indice * rng.range(0.5, 0.9));
    return { fact, tope, cerca: cerca ? 1 : 0 };
  },
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'neutral',
      texto: (x) => `Un amigo me dijo que me conviene armar una SAS y pasar a responsable inscripto, que "se deduce todo". Este año facturé ${money(Number(x.p.fact))}. ¿Qué hago?`,
      opciones: [
        op('analizar', 'Depende de tus números. Comparémoslo contra el tope del monotributo y tus costos', 'analizar', { tono: 'empatico' }),
        op('rapido_si', 'Sí, armá la SAS, se deduce todo', 'rapido', { tono: 'cedes', hint: 'Respuesta de amigo, no de contador.' }),
        op('rapido_no', 'No, quedate en el monotributo que es más barato', 'rapido', { tono: 'cedes' }),
      ],
    },
    analizar: {
      quien: 'titular',
      texto: (x) =>
        Number(x.p.cerca)
          ? `Estás a nada del tope de ${money(Number(x.p.tope))}: si seguís creciendo te excluyen igual. Conviene planificar el pase ahora, con tiempo, y elegir bien la forma jurídica.`
          : `Estás lejos del tope (${money(Number(x.p.tope))}). Como RI pagarías IVA, Ganancias, IIBB y mi abono subiría. Hoy el monotributo te conviene; lo revisamos cada semestre.`,
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 7);
        ajustarReputacion(x.s, 0.6);
        if (Number(x.p.cerca)) {
          const t = crearTareaEspecial(x.s, x.c, 'consulta', 'Análisis de pase a Responsable Inscripto', { liquidacion: 3, revision: 1, presentacion: 0.5 }, 12);
          t.honorarioExtra = precio(x.s, 120_000);
        }
      },
      siguiente: 'fin_analizar',
    },
    fin_analizar: fin(
      (x) => `${nombre(x.c)}: "Por eso te pago a vos y no le pregunto a mi amigo".`,
      (x) => (Number(x.p.cerca) ? 'Análisis de pase a RI agendado (cobrable).' : 'Respuesta técnica correcta. Satisfacción +7.'),
      'cliente',
      'feliz',
    ),
    rapido: {
      quien: 'narrador',
      texto: (x) => {
        const acerto = (x.p.cerca && x.rng.chance(0.5)) || (!x.p.cerca && x.rng.chance(0.5));
        x.p.acerto = acerto ? 1 : 0;
        return acerto ? 'Le contestaste de taquito. Por suerte, le pegaste.' : 'Le contestaste de taquito. Tres meses después descubre que le costó más caro de lo que debía.';
      },
      siguiente: (x) => (x.p.acerto ? 'fin_rapido_ok' : 'fin_rapido_mal'),
    },
    fin_rapido_ok: fin(() => 'Zafaste. Pero la próxima, mirá los números.', () => 'Respuesta apurada, sin daño.'),
    fin_rapido_mal: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¿Vos me dijiste que hiciera esto sin mirar nada? Pagué de más todo el semestre.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -15);
        ajustarReputacion(x.s, -0.8);
      },
      fin: true,
      resumen: () => 'Consejo apurado y equivocado. Satisfacción −15.',
    },
  },
};

const proveedor: DialogDef = {
  id: 'proveedor_trucho',
  titulo: 'El proveedor que hace buen precio',
  icon: '🧾',
  aplica: (_s, c) => c.kind !== 'monotributista',
  peso: () => 2.5,
  params: (s, c, rng) => ({ monto: precio(s, Math.round(c.honorario * rng.range(6, 15))), prov: rng.pick(['Comercial del Sur SA', 'Distribuidora Norte SRL', 'Logística Integral SA', 'Insumos Globales SRL']) }),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'feliz',
      texto: (x) => `Conseguí un proveedor nuevo, ${x.p.prov}, que me hace un precio buenísimo. Te traje facturas por ${money(Number(x.p.monto))}, todas A, con IVA. Cargalas que me baja un montón el saldo.`,
      opciones: [
        op('verificar', 'Antes de computar nada lo verifico: CUIT, CAE, si está en la base de facturas apócrifas y si tiene capacidad operativa', 'verificar', { tono: 'firme', hint: 'Crea una tarea de control de comprobantes.' }),
        op('rechazar', 'Precio buenísimo y facturas perfectas suele ser una usina de facturas truchas. No las computo', 'rechazar', { tono: 'etico' }),
        op('cargar', 'Si tienen CAE, se cargan. Listo', 'cargar', { tono: 'cedes', hint: 'Crédito fiscal apócrifo = ajuste, multa y hasta denuncia penal.' }),
      ],
    },
    verificar: {
      quien: 'cliente',
      mood: 'sorpresa',
      texto: () => '¿Verificar qué? Si tienen el código ese, el CAE. ¿Vos pensás que me están cagando?',
      siguiente: 'verificar2',
    },
    verificar2: {
      quien: 'titular',
      texto: () => 'El CAE puede ser real y la empresa una pantalla sin empleados ni local. Si ARCA la declara apócrifa, el crédito fiscal se cae y el gasto también. Prefiero perder una tarde que perder un cliente.',
      efecto: (x) => {
        const t = crearTareaEspecial(x.s, x.c, 'consulta', `Control de comprobantes · ${x.p.prov}`, { carga: 1, liquidacion: 2, revision: 0.5, presentacion: 0.3 }, 7, { prioridad: true });
        (t as unknown as { minigame: string }).minigame = 'apocrifas';
        ajustarSatisfaccion(x.c, 2);
        ajustarReputacion(x.s, 0.6);
      },
      siguiente: 'fin_verificar',
    },
    fin_verificar: fin(() => 'Agendaste el control de comprobantes. Podés hacerlo vos para no dejar pasar nada.', () => 'Control de comprobantes agendado.'),
    rechazar: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¿Y entonces qué hago, pago el IVA completo? ¡Me estás haciendo perder plata!',
      opciones: [
        op('explicar', 'Te estoy haciendo ahorrar la multa, el impuesto y un dolor de cabeza penal. Cambiá de proveedor', 'fin_rechazar', { tono: 'etico', efecto: (x) => { ajustarSatisfaccion(x.c, -9); ajustarReputacion(x.s, 1); } }),
        op('verificar_igual', 'Está bien, las verifico antes de decidir', 'verificar2', { tono: 'firme' }),
      ],
    },
    fin_rechazar: fin(() => 'El cliente se fue enojado. En seis meses, cuando ARCA publique la lista, te va a agradecer.', () => 'Facturas rechazadas. Reputación +1, satisfacción −9.'),
    cargar: {
      quien: 'narrador',
      texto: () => 'Las cargás. El saldo de IVA baja a la mitad. El proveedor no tiene página web, ni teléfono fijo, ni aparece en Google Maps.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, 14);
        errorLatente(x, 'iva', 3);
        errorLatente(x, 'ganancias_soc', 3);
        riesgo(x.c, 0.25);
      },
      siguiente: 'fin_cargar',
    },
    fin_cargar: fin(() => 'Crédito fiscal computado. Si la usina cae, caen todos sus clientes.', () => 'Facturas sospechosas computadas. Riesgo fiscal +0.25.'),
  },
};

const reclamoError: DialogDef = {
  id: 'reclamo_error',
  titulo: 'Se equivocaron ustedes',
  icon: '🩹',
  aplica: (s, c) => s.tasks.some((t) => t.clientId === c.id && t.kind === 'rectificativa'),
  peso: () => 3,
  params: (s, c, rng) => ({ intereses: precio(s, Math.round(c.honorario * rng.range(0.3, 1.2))) }),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'estres',
      texto: (x) => `Me dijeron que hay que rectificar una declaración porque estaba mal. ¡Mal la hicieron ustedes! Y encima tengo que pagar ${money(Number(x.p.intereses))} de intereses.`,
      opciones: [
        op('disculpas', 'Tenés razón, el error fue nuestro. Rectificamos sin cargo y los intereses los paga el estudio', 'disculpas', { tono: 'empatico' }),
        op('sistema', 'Fue un problema del sistema, no nuestro', 'sistema', { tono: 'cedes', hint: 'Nadie te va a creer.' }),
        op('compartir', 'Parte del error vino de la información que nos mandaron tarde. Propongo compartir los intereses', 'compartir', { tono: 'firme' }),
      ],
    },
    disculpas: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Bueno... agradezco que lo reconozcas. Errar es humano. Que no se repita.',
      efecto: (x) => {
        mov(x.s, -Number(x.p.intereses), 'multas', `Intereses por error propio · ${x.c.nombre}`);
        ajustarSatisfaccion(x.c, 8);
        ajustarReputacion(x.s, 0.5);
      },
      siguiente: 'fin_disculpas',
    },
    fin_disculpas: fin(() => 'Asumiste el error. Cuesta, pero construye confianza.', (x) => `Intereses de ${money(Number(x.p.intereses))} a cargo del estudio.`),
    sistema: {
      quien: 'cliente',
      mood: 'estres',
      texto: () => '¿El sistema? El sistema lo manejan ustedes. No me tomes de tonto.',
      efecto: (x) => {
        ajustarSatisfaccion(x.c, -16);
        ajustarReputacion(x.s, -1);
      },
      opciones: [
        op('retroceder', 'Perdón. Fue nuestro. Lo asumimos', 'disculpas', { tono: 'empatico' }),
        op('insistir', 'Es lo que hay. Los intereses son tuyos', 'fin_sistema', { tono: 'firme', efecto: (x) => ajustarSatisfaccion(x.c, -10) }),
      ],
    },
    fin_sistema: fin(() => 'Pagó los intereses y empezó a buscar otro estudio.', () => 'Culpaste al sistema. Satisfacción −26.'),
    compartir: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Mmm. Puede ser que me haya atrasado con los papeles. Está bien, mitad y mitad.',
      efecto: (x) => {
        mov(x.s, -Number(x.p.intereses) / 2, 'multas', `50% intereses · ${x.c.nombre}`);
        ajustarSatisfaccion(x.c, -3);
      },
      siguiente: 'fin_compartir',
    },
    fin_compartir: fin(() => 'Intereses compartidos. Nadie quedó feliz, nadie quedó furioso.', () => 'Intereses compartidos.'),
  },
};

const certificacion: DialogDef = {
  id: 'certificacion',
  titulo: 'Un favorcito para el banco',
  icon: '🏦',
  aplica: () => true,
  peso: () => 1.5,
  params: (s, c, rng) => ({ real: precio(s, Math.round(c.honorario * rng.range(20, 40))), pedido: precio(s, Math.round(c.honorario * rng.range(50, 80))) }),
  inicio: 'a',
  nodos: {
    a: {
      quien: 'cliente',
      mood: 'feliz',
      texto: (x) => `Necesito una certificación de ingresos para un crédito hipotecario. Mis ingresos reales son ${money(Number(x.p.real))}, pero el banco pide ${money(Number(x.p.pedido))}. Vos ponele ese número, total ¿quién lo controla?`,
      opciones: [
        op('no', 'La certificación la firmo yo con mi matrícula y la legaliza el Consejo. Si la inflo, la pierdo. No', 'no', { tono: 'etico' }),
        op('real', 'Te la hago con los ingresos reales. Y vemos si con otros ingresos del grupo familiar llegás', 'real', { tono: 'comercial' }),
        op('inflar', 'Bueno, es un favor. Pongo el número', 'inflar', { tono: 'cedes', hint: 'Falsedad ideológica. Chau matrícula.' }),
      ],
    },
    no: {
      quien: 'cliente',
      mood: 'triste',
      texto: () => 'Qué cuadrado que sos. ¿Y entonces cómo hago?',
      opciones: [
        op('real2', 'Te la hago real y le buscamos la vuelta legal: codeudor, más plazo, otro banco', 'real', { tono: 'empatico' }),
        op('nada', 'No sé, pero no va a ser con una certificación falsa', 'fin_no', { tono: 'firme', efecto: (x) => { ajustarSatisfaccion(x.c, -8); ajustarReputacion(x.s, 1); } }),
      ],
    },
    fin_no: fin(() => 'Se fue a buscar un contador menos cuadrado. Tu matrícula sigue entera.', () => 'Rechazaste inflar la certificación. Reputación +1.'),
    real: {
      quien: 'cliente',
      mood: 'neutral',
      texto: () => 'Bueno, hacela real. Si con la de mi señora sumamos, capaz llego.',
      efecto: (x) => {
        const t = crearTareaEspecial(x.s, x.c, 'consulta', 'Certificación de ingresos', { carga: 1, liquidacion: 1.5, revision: 0.5, presentacion: 0.5 }, 7);
        t.honorarioExtra = precio(x.s, 70_000);
        ajustarSatisfaccion(x.c, 3);
        ajustarReputacion(x.s, 0.5);
      },
      siguiente: 'fin_real',
    },
    fin_real: fin(() => 'Certificación real, legalizada y cobrada. El banco verá.', () => 'Certificación de ingresos (cobrable).'),
    inflar: {
      quien: 'narrador',
      texto: () => 'Firmás un número que no existe. El Consejo legaliza la firma, no el contenido: la responsabilidad es toda tuya. Si el crédito se cae y el banco investiga, hay un informe falso con tu matrícula.',
      efecto: (x) => {
        mov(x.s, precio(x.s, 150_000), 'otros', `"Certificación especial" · ${x.c.nombre}`);
        x.s.estudio.faltasEticas += 1;
        ajustarSatisfaccion(x.c, 15);
        riesgo(x.c, 0.1);
      },
      siguiente: 'fin_inflar',
    },
    fin_inflar: fin(() => 'Cobraste el favor. Que el banco no pregunte.', () => 'Certificación inflada. Falta ética registrada.'),
  },
};

export const DIALOGOS: DialogDef[] = [iva, honorarios, multa, blanqueo, bolsa, intimacion, negro, seVa, sas, proveedor, reclamoError, certificacion];
export const DIALOGO: Record<string, DialogDef> = Object.fromEntries(DIALOGOS.map((d) => [d.id, d]));

// ============================================================================ motor

/** Sortea un diálogo aplicable (ponderado) entre los clientes activos. */
export function elegirDialogo(s: GameState, rng: Rng): { def: DialogDef; c: Client; params: Record<string, number | string> } | null {
  const cs = clientesActivos(s);
  if (!cs.length) return null;
  const cands: { item: { def: DialogDef; c: Client }; w: number }[] = [];
  for (const c of cs) for (const def of DIALOGOS) if (def.aplica(s, c)) cands.push({ item: { def, c }, w: def.peso(s, c) });
  if (!cands.length) return null;
  const { def, c } = rng.weighted(cands);
  return { def, c, params: def.params ? def.params(s, c, rng) : {} };
}

export function iniciarDialogo(def: DialogDef, c: Client, params: Record<string, number | string>): DialogState {
  return { defId: def.id, clientId: c.id, nodoId: def.inicio, params: { ...params }, historial: [] };
}

function nodoDe(def: DialogDef, id: string): DialogNode {
  const n = def.nodos[id];
  if (!n) throw new Error(`Diálogo ${def.id}: nodo "${id}" inexistente`);
  return n;
}

function entrar(state: DialogState, def: DialogDef, ctx: DialogCtx, id: string): void {
  const n = nodoDe(def, id);
  state.nodoId = id;
  n.efecto?.(ctx);
  state.historial.push({ quien: n.quien, texto: n.texto(ctx), mood: n.mood });
  if (n.fin) {
    state.resumen = n.resumen?.(ctx) ?? '';
    return;
  }
  // nodos automáticos (sin opciones) encadenan hasta uno con opciones o final
  if (!n.opciones?.length && n.siguiente) entrar(state, def, ctx, typeof n.siguiente === 'function' ? n.siguiente(ctx) : n.siguiente);
}

/**
 * Avanza el diálogo. Sin `opcionId` solo entra al nodo inicial (primera llamada).
 * Muta `s` (usar dentro de immer) y devuelve un nuevo DialogState.
 */
export function avanzar(state: DialogState, s: GameState, rng: Rng, opcionId?: string): DialogState {
  const def = DIALOGO[state.defId];
  const c = s.clients.find((x) => x.id === state.clientId);
  if (!def || !c) return { ...state, resumen: state.resumen ?? '' };
  const next: DialogState = { ...state, params: { ...state.params }, historial: [...state.historial] };
  const ctx: DialogCtx = { s, c, p: next.params, rng };
  if (!opcionId) {
    if (next.historial.length === 0) entrar(next, def, ctx, def.inicio);
    return next;
  }
  const n = nodoDe(def, next.nodoId);
  const o = n.opciones?.find((x) => x.id === opcionId);
  if (!o || (o.requiere && !o.requiere(ctx))) return next;
  next.historial.push({ quien: 'titular', texto: o.texto(ctx) });
  o.efecto?.(ctx);
  entrar(next, def, ctx, typeof o.siguiente === 'function' ? o.siguiente(ctx) : o.siguiente);
  return next;
}

export const esFinal = (state: DialogState) => state.resumen !== undefined;
export function opcionesDe(state: DialogState, s: GameState, rng: Rng): { o: DialogOption; habilitada: boolean; texto: string }[] {
  const def = DIALOGO[state.defId];
  const c = s.clients.find((x) => x.id === state.clientId);
  if (!def || !c || esFinal(state)) return [];
  const ctx: DialogCtx = { s, c, p: state.params, rng };
  return (def.nodos[state.nodoId]?.opciones ?? []).map((o) => ({ o, habilitada: o.requiere ? o.requiere(ctx) : true, texto: o.texto(ctx) }));
}
