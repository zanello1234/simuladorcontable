import * as A from '../../engine/actions';
import { CARGAS_SOCIALES, OFICINAS, ROLES } from '../../engine/config';
import { escritorios, precio } from '../../engine/core';
import { moneyShort } from '../../engine/format';
import type { PoliticaRevision } from '../../engine/types';
import { AREAS } from '../../engine/types';
import { AvatarFace } from '../../scene/Avatar';
import { useGame } from '../../store/game';
import { Bar, Empty, Section, Segmented, Toggle } from '../components';
import { WorkerCard } from '../WorkerCard';

export function Equipo() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const libres = escritorios(g) - g.workers.length;

  return (
    <div className="screen equipo">
      <Section title="⚙️ Cómo trabaja el estudio">
        <div className="grid2">
          <div className="col">
            <b className="small">Política de revisión</b>
            <Segmented<PoliticaRevision>
              value={g.estudio.politicaRevision}
              onChange={(v) => act((d) => A.setPoliticaRevision(d, v), { silent: true })}
              options={[
                { v: 'siempre', label: 'Revisar todo' },
                { v: 'criticas', label: 'Solo críticas' },
                { v: 'nunca', label: 'Nunca' },
              ]}
            />
            <span className="tiny muted">La revisión la hace alguien con más experiencia que quien preparó (segregación de funciones). Más revisión = menos errores, más horas.</span>
          </div>
          <div className="col">
            <b className="small">Reparto del trabajo</b>
            <Toggle on={g.estudio.autoAsignar} onChange={(v) => act((d) => A.setAutoAsignar(d, v))} label="Asignación automática (por carga y habilidad)" />
            <span className="tiny muted">Si la apagás, vos decidís quién hace qué y en qué orden.</span>
          </div>
        </div>
      </Section>

      <Section title={`👥 Equipo (${g.workers.length}/${escritorios(g)} escritorios)`}>
        <div className="grid2">
          {g.workers.map((w) => (
            <WorkerCard key={w.id} w={w} full />
          ))}
        </div>
      </Section>

      <Section title="📄 Candidatos" right={<span className="tiny muted">Se renuevan cada mes</span>}>
        {libres <= 0 && <div className="alert warn small mb">No hay escritorios libres. Mudate a una oficina más grande para contratar.</div>}
        {g.candidates.length ? (
          <div className="grid2">
            {g.candidates.map((c) => (
              <article key={c.id} className="card candidate">
                <header className="row">
                  <AvatarFace avatar={c.avatar} size={48} />
                  <div className="col tight grow minw0">
                    <b className="ellipsis">{c.nombre}</b>
                    <span className="small muted">{ROLES[c.role].label}</span>
                  </div>
                </header>
                <p className="small">“{c.bio}”</p>
                <div className="skills">
                  {AREAS.map((a) => (
                    <div key={a} className="skill">
                      <span className="small">{a}</span>
                      <Bar value={c.skills[a]} />
                      <span className="tiny mono">{c.skills[a]}</span>
                    </div>
                  ))}
                </div>
                <div className="row small">
                  <span>⚡ {c.velocidad.toFixed(2)}×</span>
                  <div className="spacer" />
                  <span title="Sueldo bruto + cargas sociales">
                    <b className="mono">{moneyShort(c.sueldo)}</b> <span className="tiny muted">(costo {moneyShort(c.sueldo * (1 + CARGAS_SOCIALES))})</span>
                  </span>
                </div>
                <button className="btn primary sm block" disabled={libres <= 0} onClick={() => act((d) => A.contratar(d, c.id))}>
                  Contratar
                </button>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon="📭">Ya contrataste a todos los candidatos de este mes.</Empty>
        )}
      </Section>

      <Section title="🏢 Oficina">
        <div className="grid2">
          {OFICINAS.map((o, i) => {
            const actual = g.estudio.oficina === i;
            const bloqueada = o.nivelRequerido > g.estudio.nivel;
            return (
              <article key={i} className={`card office ${actual ? 'current' : ''}`}>
                <b>
                  {['🛋️', '🏠', '🏢', '🌆'][i]} {o.nombre}
                </b>
                <p className="small muted">{o.descripcion}</p>
                <div className="chips">
                  <span className="chip">🪑 {o.escritorios} escritorios</span>
                  <span className="chip">🔑 {o.alquiler ? `${moneyShort(precio(g, o.alquiler))}/mes` : 'sin alquiler'}</span>
                  {o.mudanza > 0 && <span className="chip">🚚 mudanza {moneyShort(precio(g, o.mudanza))}</span>}
                </div>
                {actual ? (
                  <span className="chip ok">Estás acá</span>
                ) : (
                  <button className="btn sm" disabled={bloqueada} title={bloqueada ? `Requiere nivel ${o.nivelRequerido}` : ''} onClick={() => act((d) => A.mudarOficina(d, i))}>
                    {bloqueada ? `🔒 Nivel ${o.nivelRequerido}` : 'Mudarse'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
