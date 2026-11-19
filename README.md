# 📒 Partida Doble

**Simulador de gestión de un estudio contable argentino.** Sos titular del estudio: presentás IVA, IIBB, F.931, Monotributo, Ganancias y balances; liquidás sueldos; facturás y cobrás honorarios; pagás sueldos y alquiler; sobrevivís a la inflación, a las caídas de ARCA y a las fiscalizaciones; y hacés crecer el estudio con equipo, herramientas e IA.

- 🏢 **Oficina animada**: tu equipo trabaja, toma mate, se estresa; entran clientes; cae el inspector.
- ⏰ **Vencimientos reales** por terminación de CUIT, con corrimiento a día hábil y feriados.
- 🎮 **Modo simulador**: liquidá IVA, sueldos (CCT 130/75), recategorizaciones y conciliaciones bancarias a mano.
- 🤖 **IA como herramienta**: acelera, pero sin revisión humana se cuelan errores.
- 📈 **Crecimiento**: de la mesa del living al piso corporativo.
- 🎵 **Música y efectos**: milonga de fondo que se acelera con los vencimientos y se pone tensa con una inspección; caja registradora al cobrar, trombón triste con las multas.

## Jugar

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`. Funciona en desktop y celular.

| Atajo | Acción |
|---|---|
| Espacio | Pausa / seguir |
| 1 · 2 · 3 | Velocidad |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run build:single` | Un único `index.html` autocontenido en `dist-single/` (para compartir o publicar) |
| `npm test` | Tests del motor, minijuegos y simulación headless de 18 meses |
| `npm run typecheck` | Chequeo de tipos |

Previews de desarrollo: `preview-scene.html` (escena), `preview-mg1.html` (IVA y recategorización), `preview-mg2.html` (sueldos y conciliación).

## Documentación

- [Documento de diseño (GDD)](docs/GDD.md): visión, sistemas, normativa modelada, supuestos y roadmap.
- Parámetros económicos y normativos: [`src/engine/config.ts`](src/engine/config.ts) (un solo archivo).

> Simulación con fines educativos y de entretenimiento. Los importes son valores de juego: no constituyen asesoramiento profesional.
