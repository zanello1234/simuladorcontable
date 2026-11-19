import { describe, expect, it } from 'vitest';
import { consultasNecesarias, cuitEsValido, evaluarApocrifas, generarCasoApocrifas, respuestaConsulta, respuestasPerfectas } from './casoApocrifas';

const cliente = { nombre: 'Ferretería López SRL', rubro: 'comercio' as const, kind: 'srl' as const, volumen: 160 };
const rubros = ['comercio', 'servicios', 'gastronomia', 'construccion', 'agro', 'industria', 'salud', 'transporte'] as const;

describe('Facturas apócrifas', () => {
  it('es determinístico por seed', () => {
    expect(generarCasoApocrifas(5, cliente, '2027-03', 1)).toEqual(generarCasoApocrifas(5, cliente, '2027-03', 1));
  });

  it('verificador de CUIT: válidos pasan, inválidos no', () => {
    expect(cuitEsValido('20-12345678-6')).toBe(true);
    expect(cuitEsValido('30-71234567-8')).toBe(false);
    expect(cuitEsValido('27-00000000-0')).toBe(false);
    expect(cuitEsValido('20-12345678-5')).toBe(false);
  });

  it('respuestas perfectas dan score 1 y cada factura tiene un único diagnóstico', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const c = { ...cliente, rubro: rubros[seed % rubros.length], volumen: (seed * 53) % 500 };
      const caso = generarCasoApocrifas(seed, c, '2027-06', 1 + (seed % 7) / 10);
      expect(caso.facturas.length).toBeGreaterThanOrEqual(10);
      expect(caso.facturas.length).toBeLessThanOrEqual(14);
      const truchas = caso.facturas.filter((f) => f.apocrifa);
      expect(truchas.length).toBeGreaterThanOrEqual(3);
      expect(truchas.length).toBeLessThanOrEqual(5);
      // motivos distintos entre sí, uno por trucha, ninguno en legítimas
      expect(new Set(truchas.map((f) => f.motivo)).size).toBe(truchas.length);
      for (const f of caso.facturas) {
        if (f.apocrifa) expect(f.motivo).toBeDefined();
        else expect(f.motivo).toBeUndefined();
        // CUIT inválido solo en el motivo correspondiente
        expect(cuitEsValido(f.cuit)).toBe(f.motivo !== 'cuit_invalido');
        // CAE vencido solo en su motivo
        expect(f.caeVto < f.fecha).toBe(f.motivo === 'cae_vencido');
        // APOC / validación / baja solo en sus motivos
        expect(f.enApoc).toBe(f.motivo === 'apoc');
        expect(f.validacion !== 'Comprobante registrado').toBe(f.motivo === 'cae_inexistente');
        expect(f.constancia.estado !== 'Activo').toBe(f.motivo === 'cuit_inactivo');
        // la consulta que lo revela marca alerta; en legítimas ninguna consulta alerta
        if (f.apocrifa && f.revelaCon !== 'vista') expect(respuestaConsulta(caso, f, f.revelaCon).alerta).toBe(true);
        if (!f.apocrifa) for (const q of ['constancia', 'apoc', 'validar', 'capacidad', 'pago'] as const) expect(respuestaConsulta(caso, f, q).alerta).toBe(false);
        // duplicado está en la lista de cargados antes; los demás no
        expect(caso.cargadosAntes.includes(`${f.ptoVta}-${f.numero}`)).toBe(f.motivo === 'duplicado');
      }
      const p = respuestasPerfectas(caso);
      expect(p.consultasUsadas).toBe(consultasNecesarias(caso));
      const r = evaluarApocrifas(caso, p);
      expect(r.score).toBe(1);
      expect(r.errores).toEqual([]);
      expect(r.creditoApocrifoComputado).toBe(0);
    }
  });

  it('dejar pasar una trucha pesa más que impugnar una legítima', () => {
    const caso = generarCasoApocrifas(11, cliente, '2027-03', 1);
    const p = respuestasPerfectas(caso);
    const trucha = caso.facturas.find((f) => f.apocrifa)!;
    const legit = caso.facturas.find((f) => !f.apocrifa)!;
    const a = evaluarApocrifas(caso, { ...p, decisiones: { ...p.decisiones, [trucha.id]: { rechaza: false } } });
    const b = evaluarApocrifas(caso, { ...p, decisiones: { ...p.decisiones, [legit.id]: { rechaza: true, motivo: 'apoc' } } });
    expect(a.score).toBeLessThan(b.score);
    expect(a.errores.length).toBe(1);
    expect(b.falsosPositivos).toBe(1);
  });

  it('gastar todo el presupuesto de consultas penaliza', () => {
    const caso = generarCasoApocrifas(3, cliente, '2027-03', 1);
    const p = respuestasPerfectas(caso);
    const r = evaluarApocrifas(caso, { ...p, consultasUsadas: caso.presupuestoConsultas });
    expect(r.score).toBeLessThan(1);
    expect(r.score).toBeGreaterThanOrEqual(0.85);
  });
});
