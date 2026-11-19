// Minijuego: conciliación bancaria (extracto vs. mayor de Banco).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MinigameShell, MinigameResultView } from '../MinigameShell';
import type { MinigameMeta, MinigameProps } from '../types';
import { money2 } from '../../engine/format';
import {
  CATEGORIAS,
  CAT,
  armarConciliacion,
  asientosAjuste,
  evaluarConciliacion,
  generarCasoConciliacion,
  itemsAClasificar,
  parKey,
  type Categoria,
  type EvaluacionConciliacion,
  type Mov,
} from './caso';
import './conciliacion.css';

export const CONCILIACION_META: MinigameMeta = {
  id: 'conciliacion',
  titulo: 'Conciliación bancaria',
  descripcion: 'Cruzá el extracto con el mayor de Banco, clasificá las diferencias y llegá al saldo conciliado.',
  horas: 3,
  icon: '🏦',
};

type Fase = 'emparejar' | 'clasificar' | 'saldo' | 'resultado';

const COLORES = ['#1f8a70', '#2f6fb5', '#c86b1f', '#8a4fbf', '#c8414f', '#2a9d4b', '#b08a00', '#d0508f', '#4b7d8f', '#6b8e23', '#7a5c3e', '#3c5fa8'];
const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

export function ConciliacionMinigame({ task, client, seed, indice, onComplete, onCancel }: MinigameProps) {
  const caso = useMemo(() => generarCasoConciliacion(seed, client, task, indice), [seed, client, task, indice]);
  const [fase, setFase] = useState<Fase>('emparejar');
  const [pares, setPares] = useState<[string, string][]>([]);
  const [selB, setSelB] = useState<string | null>(null);
  const [selL, setSelL] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ txt: string; n: number } | null>(null);
  const [clasif, setClasif] = useState<Record<string, Categoria>>({});
  const [saldoId, setSaldoId] = useState<string | null>(null);
  const [res, setRes] = useState<EvaluacionConciliacion | null>(null);

  const ancla = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ancla.current?.closest('.mg-body')?.scrollTo({ top: 0 });
  }, [fase]);

  const B = useMemo(() => new Map(caso.extracto.map((x) => [x.id, x])), [caso]);
  const L = useMemo(() => new Map(caso.mayor.map((x) => [x.id, x])), [caso]);
  const parDe = (id: string) => pares.findIndex(([b, l]) => b === id || l === id);
  const items = useMemo(() => itemsAClasificar(caso, pares), [caso, pares]);
  const clasificados = items.filter((i) => clasif[i.key]).length;

  const avisar = (txt: string) => setAviso({ txt, n: (aviso?.n ?? 0) + 1 });

  const unir = (b: string, l: string) => {
    const mb = B.get(b)!;
    const ml = L.get(l)!;
    if (Math.sign(mb.importe) !== Math.sign(ml.importe)) {
      avisar('No se pueden unir: uno es un ingreso y el otro un egreso de la cuenta.');
      setSelB(null);
      setSelL(null);
      return;
    }
    setPares([...pares, [b, l]]);
    setSelB(null);
    setSelL(null);
    setAviso(null);
  };

  const tocar = (lado: 'b' | 'l', id: string) => {
    const i = parDe(id);
    if (i >= 0) {
      setPares(pares.filter((_, k) => k !== i));
      return;
    }
    if (lado === 'b') {
      if (selB === id) return setSelB(null);
      if (selL) return unir(id, selL);
      setSelB(id);
    } else {
      if (selL === id) return setSelL(null);
      if (selB) return unir(selB, id);
      setSelL(id);
    }
  };

  const terminar = () => {
    const r = evaluarConciliacion(caso, { pares, clasif, saldoId });
    setRes(r);
    setFase('resultado');
  };

  const fases: { id: Fase; label: string }[] = [
    { id: 'emparejar', label: 'Emparejar' },
    { id: 'clasificar', label: 'Clasificar' },
    { id: 'saldo', label: 'Saldo' },
  ];
  const faseIdx = fases.findIndex((f) => f.id === fase);

  let footer: ReactNode;
  if (fase === 'emparejar') {
    footer = (
      <>
        <span className="muted small cb-foot-txt">
          {pares.length} pareja{pares.length === 1 ? '' : 's'} · {caso.extracto.length - pares.length} mov. del banco y {caso.mayor.length - pares.length} de libros sin pareja
        </span>
        <button className="btn" disabled={pares.length === 0} onClick={() => setPares(pares.slice(0, -1))}>
          ↶ Deshacer
        </button>
        <button className="btn primary" onClick={() => setFase('clasificar')}>
          Listo, clasificar diferencias →
        </button>
      </>
    );
  } else if (fase === 'clasificar') {
    footer = (
      <>
        <span className="muted small cb-foot-txt">
          {clasificados}/{items.length} clasificadas
        </span>
        <button className="btn" onClick={() => setFase('emparejar')}>
          ← Volver
        </button>
        <button className="btn primary" disabled={clasificados < items.length} onClick={() => setFase('saldo')}>
          Calcular saldo →
        </button>
      </>
    );
  } else if (fase === 'saldo') {
    footer = (
      <>
        <button className="btn" onClick={() => setFase('clasificar')}>
          ← Volver
        </button>
        <button className="btn primary" disabled={!saldoId} onClick={terminar}>
          Cerrar conciliación
        </button>
      </>
    );
  } else if (res) {
    footer = (
      <button className="btn primary" onClick={() => onComplete({ score: res.score, resumen: res.resumen, errores: res.errores })}>
        Continuar
      </button>
    );
  }

  return (
    <MinigameShell
      icon="🏦"
      titulo="Conciliación bancaria"
      subtitulo={`${caso.empresa} · ${caso.banco} · ${caso.periodoLabel}`}
      instrucciones={
        fase === 'emparejar' ? (
          <>
            <b>1.</b> Tocá un movimiento del <b>extracto</b> y su par en el <b>mayor</b> para unirlos. Tocá uno ya unido para separarlo. Lo que quede suelto son las partidas de conciliación.
          </>
        ) : fase === 'clasificar' ? (
          <>
            <b>2.</b> Clasificá cada partida que no cerró: ¿es algo que falta en el banco (ajusta la conciliación) o algo que falta registrar en libros (ajuste contable)?
          </>
        ) : fase === 'saldo' ? (
          <>
            <b>3.</b> Con las partidas clasificadas, ¿cuál es el <b>saldo conciliado</b> (saldo contable ajustado)?
          </>
        ) : undefined
      }
      footer={footer}
      onCancel={onCancel}
    >
      <span ref={ancla} />
      {fase !== 'resultado' && (
        <ol className="cb-steps" aria-label="Etapas">
          {fases.map((f, i) => (
            <li key={f.id} className={i < faseIdx ? 'done' : i === faseIdx ? 'on' : ''}>
              <span>{i < faseIdx ? '✓' : i + 1}</span> {f.label}
            </li>
          ))}
        </ol>
      )}

      {fase === 'emparejar' && (
        <Emparejar
          extracto={caso.extracto}
          mayor={caso.mayor}
          pares={pares}
          selB={selB}
          selL={selL}
          onTocar={tocar}
          banco={caso.banco}
          cuenta={caso.cuenta}
          saldoInicial={caso.saldoInicial}
          saldoBanco={caso.saldoBanco}
          saldoLibros={caso.saldoLibros}
          aviso={aviso}
        />
      )}

      {fase === 'clasificar' && (
        <details className="cb-legend card">
          <summary>
            <b>Categorías</b> <span className="muted small">(tocá para ver qué significa cada una)</span>
          </summary>
          <ul>
            {CATEGORIAS.map((c) => (
              <li key={c.id}>
                <b>{c.corto}:</b> {c.label}
              </li>
            ))}
          </ul>
        </details>
      )}
      {fase === 'clasificar' && (
        <div className="cb-clasif anim-up">
          {items.length === 0 && <p className="muted">No quedaron partidas sin pareja. ¿Seguro que el extracto y los libros coinciden en todo?</p>}
          {items.map((it) => (
            <div key={it.key} className={`card cb-item ${clasif[it.key] ? 'set' : ''}`}>
              <div className="cb-item-head">
                {it.banco && it.libro ? (
                  <span className="chip warn">Pareja con diferencia</span>
                ) : it.banco ? (
                  <span className="chip info">Solo en el extracto</span>
                ) : (
                  <span className="chip accent">Solo en libros</span>
                )}
                {it.diferencia !== undefined && <span className="chip bad mono">dif. {money2(it.diferencia)}</span>}
              </div>
              {it.banco && <MovLinea m={it.banco} lado="b" />}
              {it.libro && <MovLinea m={it.libro} lado="l" />}
              <div className="cb-cats">
                {CATEGORIAS.map((c) => (
                  <button key={c.id} title={c.label} className={`cb-cat ${clasif[it.key] === c.id ? 'on' : ''}`} onClick={() => setClasif({ ...clasif, [it.key]: c.id })}>
                    {c.corto}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {fase === 'saldo' && (
        <div className="cb-saldo anim-up">
          <div className="cb-saldos">
            <div className="card">
              <div className="muted small">Saldo según extracto</div>
              <div className="cb-big mono">{money2(caso.saldoBanco)}</div>
            </div>
            <div className="card">
              <div className="muted small">Saldo según libros</div>
              <div className="cb-big mono">{money2(caso.saldoLibros)}</div>
            </div>
          </div>
          <div className="card">
            <h3>Tus partidas de conciliación</h3>
            <ul className="cb-resumen">
              {items.map((it) => (
                <li key={it.key}>
                  <span className="cb-res-c">{(it.banco ?? it.libro)!.concepto}</span>
                  <span className="chip">{clasif[it.key] ? CAT[clasif[it.key]].corto : '—'}</span>
                  <span className="mono num">{money2(it.diferencia ?? (it.banco ?? it.libro)!.importe)}</span>
                </li>
              ))}
            </ul>
          </div>
          <h3 className="cb-q">¿Cuál es el saldo conciliado?</h3>
          <div className="cb-opts">
            {caso.opcionesSaldo.map((o) => (
              <button key={o.id} className={`cb-opt mono ${saldoId === o.id ? 'on' : ''}`} onClick={() => setSaldoId(o.id)}>
                {money2(o.monto)}
              </button>
            ))}
          </div>
        </div>
      )}

      {fase === 'resultado' && res && (
        <div className="cb-final">
          <MinigameResultView score={res.score} resumen={res.resumen} errores={res.errores} onContinue={() => onComplete({ score: res.score, resumen: res.resumen, errores: res.errores })} />
          <div className="cb-partes">
            <Parte label="Emparejamiento" v={res.partes.pares} peso="40%" />
            <Parte label="Clasificación" v={res.partes.clasif} peso="40%" />
            <Parte label="Saldo" v={res.partes.saldo} peso="20%" />
          </div>
          <Solucion caso={caso} />
        </div>
      )}
    </MinigameShell>
  );
}

// ----------------------------------------------------------------------------- Subcomponentes

function MovLinea({ m, lado }: { m: Mov; lado: 'b' | 'l' }) {
  return (
    <div className="cb-movline">
      <span className="cb-fecha mono">{dm(m.fecha)}</span>
      <span className="cb-concepto">{m.concepto}</span>
      <span className={`mono cb-imp ${m.importe >= 0 ? 'pos' : 'neg'}`}>
        {lado === 'b' ? (m.importe >= 0 ? 'Cr ' : 'Db ') : m.importe >= 0 ? 'D ' : 'H '}
        {money2(Math.abs(m.importe))}
      </span>
    </div>
  );
}

interface EmparejarProps {
  extracto: Mov[];
  mayor: Mov[];
  pares: [string, string][];
  selB: string | null;
  selL: string | null;
  onTocar: (lado: 'b' | 'l', id: string) => void;
  banco: string;
  cuenta: string;
  saldoInicial: number;
  saldoBanco: number;
  saldoLibros: number;
  aviso: { txt: string; n: number } | null;
}

function Emparejar({ extracto, mayor, pares, selB, selL, onTocar, banco, cuenta, saldoInicial, saldoBanco, saldoLibros, aviso }: EmparejarProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [lineas, setLineas] = useState<{ d: string; color: string; key: string }[]>([]);

  const parIdx = (id: string) => pares.findIndex(([b, l]) => b === id || l === id);
  const B = new Map(extracto.map((x) => [x.id, x]));
  const L = new Map(mayor.map((x) => [x.id, x]));

  useLayoutEffect(() => {
    const calc = () => {
      const w = wrap.current;
      if (!w || w.clientWidth < 720) return setLineas([]);
      const wr = w.getBoundingClientRect();
      const ls = pares.flatMap(([b, l], i) => {
        const eb = refs.current.get(b);
        const el = refs.current.get(l);
        if (!eb || !el) return [];
        const rb = eb.getBoundingClientRect();
        const rl = el.getBoundingClientRect();
        const x1 = rb.right - wr.left;
        const y1 = rb.top + rb.height / 2 - wr.top;
        const x2 = rl.left - wr.left;
        const y2 = rl.top + rl.height / 2 - wr.top;
        const mx = (x1 + x2) / 2;
        return [{ key: parKey(b, l), color: COLORES[i % COLORES.length], d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` }];
      });
      setLineas(ls);
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [pares]);

  const item = (m: Mov, lado: 'b' | 'l') => {
    const i = parIdx(m.id);
    const sel = (lado === 'b' ? selB : selL) === m.id;
    const color = i >= 0 ? COLORES[i % COLORES.length] : undefined;
    let dif = false;
    if (i >= 0) {
      const [b, l] = pares[i];
      dif = Math.abs(B.get(b)!.importe - L.get(l)!.importe) > 0.005;
    }
    return (
      <li key={m.id}>
        <button
          ref={(el) => {
            if (el) refs.current.set(m.id, el);
            else refs.current.delete(m.id);
          }}
          className={`cb-mov ${sel ? 'sel' : ''} ${i >= 0 ? 'paired' : ''}`}
          style={color ? ({ '--pc': color } as CSSProperties) : undefined}
          onClick={() => onTocar(lado, m.id)}
          aria-pressed={sel || i >= 0}
        >
          <span className="cb-fecha mono">{dm(m.fecha)}</span>
          <span className="cb-concepto">{m.concepto}</span>
          <span className={`cb-cols mono ${m.importe >= 0 ? 'pos' : 'neg'}`}>
            <small>{lado === 'b' ? (m.importe >= 0 ? 'Cr' : 'Db') : m.importe >= 0 ? 'D' : 'H'}</small> {money2(Math.abs(m.importe))}
          </span>
          {i >= 0 && (
            <span className="cb-badge" title={dif ? 'Los importes no coinciden' : undefined}>
              {i + 1}
              {dif && <b>≠</b>}
            </span>
          )}
        </button>
      </li>
    );
  };

  const colB = useRef<HTMLElement>(null);
  const colL = useRef<HTMLElement>(null);
  const sel = selB ? B.get(selB) : selL ? L.get(selL) : undefined;

  return (
    <div className="cb-match" ref={wrap}>
      {sel && (
        <div className="cb-selbar anim-up" role="status">
          <span className="cb-selbar-txt">
            <b>{selB ? 'Extracto' : 'Mayor'}:</b> {sel.concepto} · <span className="mono">{money2(Math.abs(sel.importe))}</span>
          </span>
          <button className="btn sm" onClick={() => (selB ? colL : colB).current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Buscar su par {selB ? '↓' : '↑'}
          </button>
        </div>
      )}
      <svg className="cb-lines" aria-hidden>
        {lineas.map((l) => (
          <path key={l.key} d={l.d} stroke={l.color} />
        ))}
      </svg>
      <section className="cb-col" ref={colB}>
        <header className="cb-col-head">
          <div>
            <b>Extracto bancario</b>
            <div className="tiny muted">
              {banco} · {cuenta}
            </div>
          </div>
          <div className="cb-col-tit tiny">
            <span>Db débito · Cr crédito</span>
          </div>
        </header>
        <div className="cb-saldo-line tiny">
          <span>Saldo anterior</span>
          <span className="mono">{money2(saldoInicial)}</span>
        </div>
        <ul className="cb-list">{extracto.map((m) => item(m, 'b'))}</ul>
        <div className="cb-saldo-line tiny strong">
          <span>Saldo al cierre</span>
          <span className="mono">{money2(saldoBanco)}</span>
        </div>
      </section>
      <section className="cb-col" ref={colL}>
        <header className="cb-col-head">
          <div>
            <b>Mayor de Banco</b>
            <div className="tiny muted">Libro diario · cuenta Banco c/c</div>
          </div>
          <div className="cb-col-tit tiny">
            <span>D debe · H haber</span>
          </div>
        </header>
        <div className="cb-saldo-line tiny">
          <span>Saldo anterior</span>
          <span className="mono">{money2(saldoInicial)}</span>
        </div>
        <ul className="cb-list">{mayor.map((m) => item(m, 'l'))}</ul>
        <div className="cb-saldo-line tiny strong">
          <span>Saldo al cierre</span>
          <span className="mono">{money2(saldoLibros)}</span>
        </div>
      </section>
      {aviso && (
        <div key={aviso.n} className="cb-aviso anim-shake" role="status">
          {aviso.txt}
        </div>
      )}
    </div>
  );
}

function Parte({ label, v, peso }: { label: string; v: number; peso: string }) {
  const cls = v >= 0.95 ? '' : v >= 0.6 ? 'warn' : 'bad';
  return (
    <div className="cb-parte">
      <div className="row">
        <span className="small">
          <b>{label}</b> <span className="muted">({peso})</span>
        </span>
        <span className="spacer" />
        <span className="mono small">{Math.round(v * 100)}%</span>
      </div>
      <div className={`bar ${cls}`}>
        <i style={{ width: `${Math.round(v * 100)}%` }} />
      </div>
    </div>
  );
}

const LEGIBLE: Record<string, string> = {
  'COMISION MANTENIMIENTO CUENTA': 'Comisión mantenimiento de cuenta',
  'IVA 21% S/COMISION': 'IVA 21% s/ comisión',
  'IMP. LEY 25413 S/DEBITOS': 'Impuesto Ley 25.413 s/ débitos',
  'IMP. LEY 25413 S/CREDITOS': 'Impuesto Ley 25.413 s/ créditos',
};
const legible = (c: string) => LEGIBLE[c] ?? c;

function Solucion({ caso }: { caso: ReturnType<typeof generarCasoConciliacion> }) {
  const c = armarConciliacion(caso);
  const asientos = asientosAjuste(caso);
  const fila = (label: string, v: number, cls = '') => (
    <tr key={label + v} className={cls}>
      <td>{label}</td>
      <td className="num mono">{money2(cls ? v : Math.abs(v))}</td>
    </tr>
  );
  return (
    <div className="cb-sol">
      <div className="card">
        <h3>Conciliación al cierre</h3>
        <table className="cb-sol-tbl">
          <tbody>
            {fila('Saldo según extracto bancario', c.saldoBanco, 'strong')}
            {c.depositosTransito.map((m) => fila(`(+) Depósito en tránsito ${dm(m.fecha)}`, m.importe))}
            {c.chequesPendientes.map((m) => fila(`(−) ${m.concepto.replace('Pago a ', 'Cheque a ')}`, m.importe))}
            {fila('Saldo bancario ajustado', c.bancoAjustado, 'total')}
            <tr className="sep">
              <td colSpan={2} />
            </tr>
            {fila('Saldo según libros', c.saldoLibros, 'strong')}
            {c.gastos.map((m) => fila(`(−) ${legible(m.concepto)}`, m.importe))}
            {c.impuestos.map((m) => fila(`(−) ${legible(m.concepto)}`, m.importe))}
            {fila(`(${c.ajusteError >= 0 ? '+' : '−'}) Corrección error de registración`, c.ajusteError)}
            {fila('Saldo contable ajustado', c.librosAjustado, 'total')}
          </tbody>
        </table>
        <p className="small cb-check">{Math.abs(c.bancoAjustado - c.librosAjustado) < 0.01 ? '✓ Ambos saldos ajustados coinciden: la cuenta está conciliada.' : ''}</p>
      </div>
      <div className="card">
        <h3>Asientos de ajuste a registrar</h3>
        {asientos.map((a) => (
          <div key={a.titulo} className="cb-asiento">
            <div className="small">
              <b>{a.titulo}</b>
            </div>
            <table className="cb-sol-tbl">
              <tbody>
                {a.lineas.map((l) => (
                  <tr key={l.cuenta + l.debe}>
                    <td className={l.haber ? 'cb-haber' : ''}>{l.haber ? `a ${l.cuenta}` : l.cuenta}</td>
                    <td className="num mono">{l.debe ? money2(l.debe) : ''}</td>
                    <td className="num mono">{l.haber ? money2(l.haber) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
