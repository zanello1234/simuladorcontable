import * as A from '../../engine/actions';
import { precio } from '../../engine/core';
import { moneyShort } from '../../engine/format';
import { TOOLS } from '../../engine/tools';
import type { ToolCategory, ToolDef } from '../../engine/types';
import { STEP_LABEL } from '../../engine/types';
import { useGame } from '../../store/game';
import { Section } from '../components';

const CATS: { id: ToolCategory; label: string; desc: string }[] = [
  { id: 'ia', label: '🤖 Inteligencia artificial y automatización', desc: 'Multiplican la productividad. La IA acelera, pero el profesional valida: sin revisión, los errores se cuelan.' },
  { id: 'software', label: '💾 Software de gestión', desc: 'La base para trabajar ordenado.' },
  { id: 'servicio', label: '🗂️ Servicios para clientes', desc: 'Mejoran la experiencia y la entrega de documentación.' },
  { id: 'infra', label: '🔌 Infraestructura', desc: 'Para que nada te frene.' },
];

function efectoTexto(t: ToolDef): string[] {
  const out: string[] = [];
  for (const e of t.efectos) {
    const sujeto = [e.step ? STEP_LABEL[e.step].toLowerCase() : 'todos los pasos', e.area ? `de ${e.area}` : '', e.kinds ? `(${e.kinds.join(', ')})` : ''].filter(Boolean).join(' ');
    if (e.horasMult && e.horasMult !== 1) out.push(`${sujeto}: −${Math.round((1 - e.horasMult) * 100)}% horas`);
    if (e.errorMult && e.errorMult !== 1) out.push(`${sujeto}: ${e.errorMult > 1 ? '+' : '−'}${Math.round(Math.abs(e.errorMult - 1) * 100)}% errores`);
    if (e.detectMult && e.detectMult !== 1) out.push(`revisión: +${Math.round((e.detectMult - 1) * 100)}% detección`);
  }
  const esp: Record<string, string> = {
    auto_reclamo: 'Reclama papeles solo todos los días',
    factura_auto: 'Factura los abonos el 1er día hábil',
    alertas: 'Alerta y prioriza a 3 días del vencimiento',
    backup: 'Protege contra ransomware',
    ups: 'Sigue trabajando sin luz',
    mas_prospectos: 'Más consultas y +5% de cierre',
    portal: 'Los clientes entregan antes y están más contentos',
  };
  if (t.especial) out.push(esp[t.especial]);
  return out;
}

export function Herramientas() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  return (
    <div className="screen herramientas">
      {CATS.map((cat) => (
        <Section key={cat.id} title={cat.label}>
          <p className="small muted mb">{cat.desc}</p>
          <div className="grid2">
            {TOOLS.filter((t) => t.categoria === cat.id).map((t) => {
              const tiene = g.tools.includes(t.id);
              const bloqueada = t.nivelRequerido > g.estudio.nivel;
              const costo = precio(g, t.costoInicial);
              return (
                <article key={t.id} className={`card tool ${tiene ? 'owned' : ''} ${bloqueada ? 'locked' : ''}`}>
                  <header className="row">
                    <span className="tool-icon" aria-hidden>
                      {t.icon}
                    </span>
                    <b className="grow">{t.nombre}</b>
                    {tiene && <span className="chip ok">Activa</span>}
                  </header>
                  <p className="small">{t.descripcion}</p>
                  <ul className="effects">
                    {efectoTexto(t).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {t.advertencia && <p className="tiny warn-box">⚠️ {t.advertencia}</p>}
                  <footer className="row">
                    <span className="small mono">
                      {costo ? moneyShort(costo) : '$ 0'} + {moneyShort(precio(g, t.costoMensual))}/mes
                    </span>
                    <div className="spacer" />
                    {tiene ? (
                      <button className="btn sm ghost" onClick={() => act((d) => A.cancelarHerramienta(d, t.id))}>
                        Cancelar
                      </button>
                    ) : (
                      <button className="btn sm primary" disabled={bloqueada || g.estudio.caja < costo} title={bloqueada ? `Requiere nivel ${t.nivelRequerido}` : g.estudio.caja < costo ? 'No alcanza la caja' : ''} onClick={() => act((d) => A.comprarHerramienta(d, t.id))}>
                        {bloqueada ? `🔒 Nivel ${t.nivelRequerido}` : 'Implementar'}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}
