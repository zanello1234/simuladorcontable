import { useState } from 'react';
import { useGame } from '../../store/game';
import { Modal } from '../components';

const SLIDES = [
  {
    icon: '📒',
    titulo: 'Sos titular de un estudio contable',
    texto: 'Arrancás en el living de tu casa con 6 clientes. Tu objetivo: hacer crecer el estudio sin morir en el intento (ni en una fiscalización).',
  },
  {
    icon: '⏰',
    titulo: 'El reloj corre',
    texto: 'Cada cliente tiene obligaciones con vencimiento: IVA, IIBB, sueldos, F.931, Monotributo, Ganancias, balances. Si vence sin presentar, hay multa y el cliente se enoja. Pausá con la barra espaciadora.',
  },
  {
    icon: '🔄',
    titulo: 'Cada tarea tiene pasos',
    texto: 'Recopilar papeles → carga → liquidación → revisión → presentación. Los clientes desordenados traen todo tarde: reclamales. La revisión detecta errores antes de que los encuentre ARCA.',
  },
  {
    icon: '🎮',
    titulo: 'Modo simulador',
    texto: 'Con "🎮 Hacerla yo" liquidás vos mismo: IVA, sueldos, recategorizaciones y conciliaciones de verdad. Si lo hacés bien, no hay errores y aprendés.',
  },
  {
    icon: '📈',
    titulo: 'Crecé',
    texto: 'Facturá a principio de mes, cobrá, actualizá abonos contra la inflación, contratá equipo, mudate e implementá herramientas e IA. Pero ojo: la IA acelera, el profesional valida.',
  },
];

export function IntroModal() {
  const setIntro = useGame((s) => s.setIntro);
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <Modal label="Cómo se juega">
      <div className="event anim-pop" key={i}>
        <div className="event-icon">{s.icon}</div>
        <h2>{s.titulo}</h2>
        <p className="event-text">{s.texto}</p>
        <div className="dots" aria-hidden>
          {SLIDES.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="row mt">
          <button className="btn ghost" onClick={() => setIntro(false)}>
            Saltear
          </button>
          <div className="spacer" />
          {i > 0 && (
            <button className="btn" onClick={() => setI(i - 1)}>
              Atrás
            </button>
          )}
          <button className="btn primary" onClick={() => (last ? setIntro(false) : setI(i + 1))}>
            {last ? '¡A trabajar!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
