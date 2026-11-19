import { useState } from 'react';
import * as A from '../../engine/actions';
import { probabilidadAceptacion } from '../../engine/clients';
import { KIND_LABEL, MARKETING, NIVEL_POR_KIND } from '../../engine/config';
import { deudaVencida } from '../../engine/economy';
import { money, moneyShort, pct } from '../../engine/format';
import { precio } from '../../engine/core';
import { hasTool } from '../../engine/tools';
import type { Prospect } from '../../engine/types';
import { AvatarFace } from '../../scene/Avatar';
import { useGame } from '../../store/game';
import { Bar, Cara, corto, Empty, Section } from '../components';

const RUBRO_ICON: Record<string, string> = { comercio: '🛒', servicios: '💼', gastronomia: '🍕', construccion: '🏗️', agro: '🌾', industria: '🏭', salud: '🩺', transporte: '🚚' };
const ORIGEN: Record<Prospect['origen'], string> = { referido: '⭐ Referido', web: '🌐 Web', redes: '📱 Redes', networking: '🍷 Networking', colega: '🤝 Colega', camara: '🏛️ Cámara empresaria' };

function ProspectCard({ p }: { p: Prospect }) {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const [fee, setFee] = useState(p.honorarioReferencia);
  const prob = probabilidadAceptacion(fee, p.honorarioReferencia, g.estudio.reputacion, hasTool(g.tools, 'crm'), p.origen);
  const c = p.client;
  const bloqueado = NIVEL_POR_KIND[c.kind] > g.estudio.nivel;
  const min = Math.round((p.honorarioReferencia * 0.5) / 1000) * 1000;
  const max = Math.round((p.honorarioReferencia * 1.8) / 1000) * 1000;
  const valorHora = fee / Math.max(1, p.horasEstimadas);
  return (
    <article className="card prospect anim-pop">
      <header className="row">
        <AvatarFace avatar={c.avatar} size={48} />
        <div className="col tight grow">
          <b>{corto(c.nombre)}</b>
          <span className="small muted">
            {RUBRO_ICON[c.rubro]} {c.rubro} · {KIND_LABEL[c.kind]}
          </span>
        </div>
        <span className="chip">{ORIGEN[p.origen]}</span>
      </header>
      <blockquote className="quote">“{p.mensaje}”</blockquote>
      <div className="chips">
        <span className="chip">👷 {c.empleados} empleado/s</span>
        <span className="chip">🧾 ~{c.volumen} comprob./mes</span>
        <span className="chip">{c.jurisdiccion === 'convenio' ? '🗺️ Convenio Multilateral' : '📍 IIBB local'}</span>
        <span className="chip">⏱️ ~{p.horasEstimadas} h/mes</span>
      </div>
      <p className="small pista">🔎 {p.pista}</p>
      <div className="fee">
        <div className="row">
          <span className="small">Tu propuesta mensual</span>
          <div className="spacer" />
          <b className="mono">{money(fee)}</b>
        </div>
        <input type="range" min={min} max={max} step={1000} value={fee} onChange={(e) => setFee(Number(e.target.value))} aria-label="Honorario mensual propuesto" />
        <div className="row tiny muted">
          <span>Referencia de mercado {moneyShort(p.honorarioReferencia)}</span>
          <div className="spacer" />
          <span>≈ {moneyShort(valorHora)}/hora</span>
        </div>
        <div className="row small">
          Chance de que acepte
          <div className="grow">
            <Bar value={prob * 100} tone={prob < 0.35 ? 'bad' : prob < 0.6 ? 'warn' : undefined} label="Probabilidad de aceptación" />
          </div>
          <b>{pct(prob)}</b>
        </div>
      </div>
      <footer className="row">
        <span className="tiny muted">Expira el {p.expira.split('-').reverse().join('/')}</span>
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => act((d) => A.rechazarProspecto(d, p.id))}>
          Descartar
        </button>
        <button className="btn sm primary" disabled={bloqueado} title={bloqueado ? `Requiere nivel ${NIVEL_POR_KIND[c.kind]}` : ''} onClick={() => act((d) => A.enviarPropuesta(d, p.id, fee))}>
          Enviar propuesta
        </button>
      </footer>
    </article>
  );
}

export function Clientes() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const openClient = useGame((s) => s.openClient);
  const [aumento, setAumento] = useState(10);
  const activos = g.clients.filter((c) => c.activo && !c.propio).sort((a, b) => b.honorario - a.honorario);
  const atrasoProm = activos.length ? activos.reduce((a, c) => a + (g.inflacion.indice / c.honorarioIndice - 1), 0) / activos.length : 0;
  const bajas = g.clients.filter((c) => !c.activo && !c.propio).slice(-6).reverse();

  return (
    <div className="screen clientes">
      <Section title={`🙋 Prospectos (${g.prospects.length})`}>
        {g.prospects.length ? (
          <div className="grid2">
            {g.prospects.map((p) => (
              <ProspectCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Empty icon="📣">No hay consultas nuevas. Hacé networking, invertí en marketing o tené clientes felices (refieren).</Empty>
        )}
      </Section>

      <div className="grid2">
        <Section title="📣 Marketing">
          <div className="col">
            {MARKETING.map((m, i) => (
              <label key={i} className={`opt ${g.estudio.marketing === i ? 'on' : ''}`}>
                <input type="radio" name="mkt" checked={g.estudio.marketing === i} onChange={() => act((d) => A.setMarketing(d, i))} />
                <div className="col tight grow">
                  <b>{m.nombre}</b>
                  <span className="tiny muted">{m.descripcion}</span>
                </div>
                <span className="mono small">{m.costo ? `${moneyShort(precio(g, m.costo))}/mes` : 'gratis'}</span>
              </label>
            ))}
          </div>
        </Section>
        <Section title="💲 Actualizar abonos">
          <p className="small">
            Inflación acumulada desde la última actualización (promedio): <b>{pct(atrasoProm, 1)}</b>. Si no actualizás, perdés plata todos los meses. Si te pasás, los clientes se enojan.
          </p>
          <div className="row mt">
            <input type="number" min={1} max={100} value={aumento} onChange={(e) => setAumento(Number(e.target.value))} style={{ width: 80 }} aria-label="Porcentaje de aumento" />
            <span>%</span>
            <div className="spacer" />
            <button className="btn primary sm" disabled={!activos.length || aumento <= 0} onClick={() => act((d) => A.actualizarHonorarios(d, aumento / 100))}>
              Aplicar a todos
            </button>
          </div>
          <p className="tiny muted mt">Tip: un aumento igual o menor a la inflación acumulada casi no molesta.</p>
        </Section>
      </div>

      <Section title={`🤝 Cartera (${activos.length})`}>
        {activos.length ? (
          <div className="client-list">
            {activos.map((c) => {
              const d = deudaVencida(g, c.id);
              const pend = g.tasks.filter((t) => t.clientId === c.id && t.estado === 'pendiente').length;
              const atraso = g.inflacion.indice / c.honorarioIndice - 1;
              return (
                <button key={c.id} className="client-row" onClick={() => openClient(c.id)}>
                  <AvatarFace avatar={c.avatar} size={40} />
                  <div className="col tight grow minw0">
                    <b className="ellipsis">{corto(c.nombre)}</b>
                    <span className="tiny muted ellipsis">
                      {RUBRO_ICON[c.rubro]} {KIND_LABEL[c.kind]} {c.empleados ? `· 👷 ${c.empleados}` : ''} {c.jurisdiccion === 'convenio' ? '· CM' : ''}
                    </span>
                  </div>
                  <div className="col tight right">
                    <span className="mono small">{moneyShort(c.honorario)}</span>
                    {atraso > 0.12 && <span className="tiny warn-t">atraso {pct(atraso)}</span>}
                  </div>
                  <div className="col tight sat">
                    <Cara v={c.satisfaccion} />
                    <Bar value={c.satisfaccion} tone={c.satisfaccion < 30 ? 'bad' : c.satisfaccion < 50 ? 'warn' : undefined} label="Satisfacción" />
                  </div>
                  <div className="col tight right hide-sm">
                    <span className="tiny">{pend} pendientes</span>
                    {d.facturas > 0 && <span className="tiny neg">debe {moneyShort(d.monto)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Empty icon="🫥">Sin clientes. Hay que salir a buscarlos.</Empty>
        )}
      </Section>
      {bajas.length > 0 && (
        <Section title="👋 Bajas recientes">
          <ul className="small plain">
            {bajas.map((c) => (
              <li key={c.id}>
                {corto(c.nombre)} — <span className="muted">{c.motivoBaja} ({c.bajaEl?.split('-').reverse().join('/')})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
