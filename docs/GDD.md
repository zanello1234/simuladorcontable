# Partida Doble — Documento de diseño (GDD)

> Simulador de gestión de un estudio contable argentino. "Un simulador de vuelo para contadores, con alma de SimCity."
> Versión del documento: 0.1 · Estado: MVP jugable.

---

## 1. Visión

El jugador es **titular de un estudio contable** en Argentina. Arranca en el living de su casa con una cartera chica y tiene que hacerlo crecer: presentar impuestos en término, liquidar sueldos, facturar y cobrar honorarios, pagar sueldos y gastos, sobrevivir a la inflación, a las caídas de ARCA y a las fiscalizaciones, e incorporar equipo, herramientas e inteligencia artificial.

**Pilares de diseño**

| Pilar | Qué significa en el juego |
|---|---|
| Realismo argentino | Vencimientos por terminación de CUIT, corrimiento a día hábil, feriados, DFE, F.931, IIBB local / Convenio, Monotributo, LCT, CCT 130/75, paritarias, inflación, SAC. |
| Gestión con tensión | El reloj corre. Las decisiones (a quién asignar, qué revisar, cuánto cobrar) tienen consecuencias diferidas. |
| Simulador "de verdad" | Las liquidaciones clave se pueden **hacer a mano** (minijuegos). Si se hacen bien, no hay errores. |
| IA como herramienta, no magia | La IA acelera, pero sin revisión humana se cuelan errores. *No es magia, es ingeniería.* |
| Crecimiento visible | La oficina animada cambia: más escritorios, servidores, robots de IA, mudanzas. |

---

## 2. Loop de juego

```
          ┌──────────── mes ─────────────┐
 Captar ─► Facturar ─► Trabajar ─► Presentar ─► Cobrar ─► Pagar ─► Crecer
   ▲          │           │            │           │         │        │
   │          │     (recopilar, carga, │      (morosos)  (sueldos,   (equipo,
   │          │      liquidación,      │                 alquiler,   oficina,
   │          │      revisión)         │                 software)   herramientas)
   └──────── reputación ◄── satisfacción ◄── a tiempo / sin errores ◄┘
```

- **Tiempo**: 1 tick = 1 hora de juego (9 a 18 h, almuerzo a las 13, horas extra hasta las 20). Velocidades ×1/×2/×3 y pausa (barra espaciadora). Los fines de semana y feriados se saltean.
- **Mes**: el 1er día hábil se generan las obligaciones del período anterior; el día 22 las novedades de sueldos. Hay que emitir las facturas de abonos (o automatizarlo).
- **Día**: llega documentación de clientes, cobranzas, gastos con fecha, eventos aleatorios, prospectos.

---

## 3. Sistemas

### 3.1 Clientes
Tipos: Monotributista, RI persona humana, SRL, SAS, SA (SA desde nivel 3). Atributos: rubro, jurisdicción (local / Convenio Multilateral), empleados, volumen de comprobantes, **orden documental** (cuándo trae los papeles), **puntualidad de pago**, satisfacción, riesgo fiscal y **errores latentes** (no visibles).

- Prospectos llegan por networking, marketing, referidos (clientes con satisfacción > 78), colegas o cámaras empresarias. El jugador propone un abono: la probabilidad de aceptación depende de la relación con el honorario de referencia, la reputación y el CRM.
- Satisfacción baja → el cliente se va. Aumentos por encima de la inflación acumulada → enojo.

### 3.2 Obligaciones (modeladas)

| Obligación | Período | Genera | Vence (regla de juego) | Minijuego |
|---|---|---|---|---|
| DDJJ IVA | mensual | 1er día hábil M+1 | día 18–22 de M+1 según terminación de CUIT | Liquidación de IVA |
| Ingresos Brutos | mensual | 1er día hábil M+1 | local 13–17 / CM 15–17 | — |
| Liquidación de sueldos | mensual | día 22 de M | 3er día hábil de M+1 (pago al 4º, LCT) | Recibo CCT 130/75 |
| F.931 (SUSS) | mensual | 1er día hábil M+1 | día 9–11 de M+1 | — |
| VEP Monotributo | mensual | 1er día hábil | día 20 | — |
| Recategorización | semestral | febrero / agosto | día 20 | Recategorización |
| Ganancias + Bienes Personales PH | anual | abril | junio, según terminación | — |
| Estados contables | anual | mes siguiente al cierre | 4 meses desde el cierre | Conciliación bancaria |
| Ganancias Sociedades | anual | 2 meses post cierre | 5º mes, según terminación | — |
| Requerimiento ARCA, rectificativas, consultas | eventual | eventos | 8–12 días hábiles | — |

Si el vencimiento cae inhábil, se corre al próximo día hábil. Los días exactos son **[A CONFIRMAR]** contra el calendario oficial de cada año: el juego usa una tabla aproximada en `src/engine/obligations.ts`.

### 3.3 Tareas y pasos
Cada obligación es una tarea con pasos: **recopilar documentación → carga → liquidación → revisión → presentación**. Las horas escalan con volumen y empleados.

- El paso *recopilar* se bloquea hasta que el cliente manda los papeles. Se puede **reclamar** (WhatsApp).
- La *presentación* se bloquea si **ARCA está caída** (más probable en días de vencimiento; puede salir prórroga).
- **Errores**: cada paso puede introducir un error según habilidad, estrés y herramientas. Son invisibles. La **revisión** (por alguien con más criterio que quien preparó: segregación de funciones) los detecta con cierta probabilidad. Los errores que quedan pasan al cliente como *errores latentes* y aparecen después: intimaciones, rectificativas, o ajustes en una **fiscalización**.
- Política de revisión: revisar todo / solo críticas / nunca.

### 3.4 Equipo
Roles: cadete, administrativo/a, liquidador/a, junior, semi senior, senior. Habilidades por área (impuestos, sueldos, contabilidad), velocidad, moral, estrés, sueldo. Bonus por rol (el cadete vuela recopilando, el administrativo cargando, el senior revisando).

- Asignación automática por carga y habilidad, o manual con orden de cola.
- Horas extra con recargo del 50% (LCT). Estrés alto → errores y lentitud; estrés 100 → agotado.
- Paritarias trimestrales, pedidos de aumento, renuncias, SAC en junio y diciembre, indemnización al despedir (art. 245 simplificado, período de prueba).
- Oficinas: home office (2), oficina chica (4), mediana (8, nivel 2), piso corporativo (14, nivel 3).

### 3.5 Herramientas e IA

| Herramienta | Efecto principal |
|---|---|
| Sistema contable / ERP en la nube | Menos horas de carga y liquidación (no se acumulan entre sí) |
| Liquidador de sueldos | −50% horas y −30% errores en sueldos |
| Bot descargador de ARCA (RPA) | −55% carga en IVA, IIBB, recategorizaciones |
| IA de clasificación de comprobantes | −65% carga, **+50% errores** si no se revisa |
| IA revisora de DDJJ | Revisión más rápida y +50% detección |
| Agente IA de reclamo de documentación | Reclama papeles solo |
| IA de conciliación bancaria | Menos horas en contabilidad |
| Facturación automática, tablero de vencimientos, portal de clientes, CRM, firma digital, backup, UPS | Automatizaciones y protección ante eventos |

### 3.6 Economía
Caja, cuentas por cobrar, abonos indexables, gastos fijos (alquiler, servicios, insumos, software, marketing, Caja de Seguridad Social profesional, matrícula), sueldos + cargas sociales, impuestos propios (Monotributo → pase a RI al superar el tope), multas, préstamo bancario. Inflación mensual aleatoria según dificultad. Quiebra si la caja está en rojo más de 45 días hábiles.

Todos los importes son **valores de juego** en `src/engine/config.ts` (un único archivo), expresados en pesos de enero del año inicial e indexados por la inflación simulada. Los marcados **[A CONFIRMAR]** conviene contrastarlos con la normativa vigente (multas Ley 11.683 art. 38, tabla de Monotributo, aportes de la Caja profesional).

### 3.7 Eventos
Fiscalización de ARCA (con requerimiento a contestar y posible ajuste), ARCA caída, corte de luz, multas (quién las paga), errores descubiertos (rectificativa), consultas fuera del abono (scope creep: cobrar o no), "dibujame los números" (dilema ético con riesgo de perder la matrícula), ransomware (backup), nueva RG de ARCA (cobrar aparte o absorber), capacitación del CPCE, paritarias, pedidos de aumento, renuncias, clientes morosos, regalos de clientes, la Selección juega a las 16, compra de cartera de un colega que se jubila, caja en rojo (préstamo), pase a Responsable Inscripto.

### 3.8 Progresión

| Nivel | Nombre | Requisito | Desbloquea |
|---|---|---|---|
| 1 | Estudio unipersonal | — | Herramientas básicas |
| 2 | Estudio en crecimiento | 7 clientes y reputación 35 | Oficina mediana, Convenio Multilateral, ERP, IA revisora, portal, CRM |
| 3 | Estudio consolidado | 14 clientes y reputación 50 | Piso corporativo, sociedades anónimas |
| 4 | Estudio de referencia | 25 clientes y reputación 65 | Más prospectos grandes |
| 5 | Firma líder | 40 clientes y reputación 80 | — |

### 3.9 Minijuegos ("modo simulador")
1. **Liquidación de IVA**: clasificar comprobantes (débito / crédito / no computa: Factura B y C, gastos no vinculados, notas de crédito), elegir los pagos a cuenta que corresponden y determinar el saldo.
2. **Liquidación de sueldos (CCT 130/75)**: antigüedad, presentismo, horas extra, aportes (11 + 3 + 3 + sindicato) y neto.
3. **Recategorización de Monotributo**: ingresos de 12 meses, superficie, energía, alquileres; categoría = la mayor de los parámetros; exclusión.
4. **Conciliación bancaria**: emparejar extracto y mayor, clasificar partidas, saldo conciliado y asientos de ajuste.

Cada uno da feedback educativo y un puntaje que define si la tarea queda con errores.

---

## 4. Interfaz

- **Escena animada** (SVG + CSS): la oficina en corte. Personajes que tipean, toman mate, hablan por teléfono, se estresan (sudor, vapor) o se duermen sobre el escritorio; pilas de papeles según carga; reloj y ventana según la hora; calendario con vencimientos; clientes que entran con carpetas; inspector de ARCA en recepción; monitores en rojo cuando ARCA cae; objetos por cada herramienta (rack de servidores, robots de IA, impresora, TV de vencimientos); confetti al subir de nivel; monedas al cobrar.
- **Paneles**: Escritorio, Tareas (calendario + lista), Clientes (prospectos, marketing, abonos, cartera), Equipo (políticas, fichas, candidatos, oficina), Herramientas, Finanzas (gráficos, cobranzas, movimientos), Bandeja (WhatsApp, mail, Domicilio Fiscal Electrónico).
- Responsive: en celular la navegación pasa abajo y la escena se puede deslizar.

---

## 5. Arquitectura técnica

```
src/
  engine/        motor puro (TypeScript, sin React): simulación determinística con RNG en el estado
    types.ts       contrato de datos
    config.ts      parámetros económicos y normativos (un solo archivo)
    calendar.ts    días hábiles, feriados (Pascua calculada), vencimientos
    obligations.ts obligaciones, vencimientos y horas
    simulation.ts  tick horario, cierre del día, inicio de mes, asignación, errores
    events.ts      eventos con decisiones
    economy.ts     facturación, cobranzas, gastos, inflación
    actions.ts     acciones del jugador
  store/         zustand + immer
  scene/         escena animada de la oficina
  minigames/     minijuegos (lógica pura + componente)
  ui/            pantallas, modales y componentes
tests/           simulación headless de 18 meses con 3 estrategias
```

- Partida guardada automáticamente cada día de juego (si el navegador lo permite) y exportable / importable como `.json`.
- `npm run build:single` genera un único HTML autocontenido para publicar o compartir.

---

## 6. Roadmap

| Fase | Contenido |
|---|---|
| 0.1 (actual) | Motor completo, 10 obligaciones, 15 herramientas, ~20 eventos, 4 minijuegos, escena animada, guardado. |
| 0.2 | Minijuegos de Ganancias PH, F.931 y coeficientes de Convenio Multilateral. Asientos contables. Sonido. Logros. |
| 0.3 | Auditoría externa (RT 37): encargos, papeles de trabajo, informe. Clientes con sucursales. |
| 0.4 | Asistente IA real dentro del juego (API de Claude) para consultas normativas, con validación del jugador. |
| 0.5 | Modo capacitación (IADA): escenarios guiados de 90 minutos, métricas por alumno, ranking. |
| 1.0 | Campaña con historia, varias ciudades, multijugador asincrónico (comparar estudios). |

---

## 7. Supuestos y simplificaciones (explícitos)

- Los vencimientos usan tablas aproximadas por terminación de CUIT; los feriados trasladables se toman en su fecha fija.
- Las multas usan los montos de la Ley 11.683 art. 38 (según Ley 27.743) como valores de juego indexados **[A CONFIRMAR]**.
- La tabla de Monotributo es una aproximación de órdenes de magnitud **[A CONFIRMAR]**.
- Contribuciones patronales + ART modeladas como un 27% plano.
- La indemnización es una versión simplificada del art. 245 LCT (sin topes ni vacaciones proporcionales).
- No hay feria fiscal de enero ni vencimientos de regímenes de información periódicos (sí aparecen como evento).
