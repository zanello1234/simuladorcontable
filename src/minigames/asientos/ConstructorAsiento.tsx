// Constructor de asiento: líneas Debe / Haber con buscador de cuentas y chips de importes.
import { useEffect, useRef, useState } from 'react';
import { money2 } from '../../engine/format';
import { buscarCuentas, cuenta, type Cuenta } from './planCuentas';
import { balancea, diferencia, round, totalDebe, totalHaber, type Asiento, type Linea } from './asiento';
import type { Chip } from './casoAsientos';

interface Props {
  value: Asiento;
  onChange: (a: Asiento) => void;
  chips: Chip[];
  sugeridas: string[];
  readOnly?: boolean;
}

export function ConstructorAsiento({ value, onChange, chips, sugeridas, readOnly }: Props) {
  const upd = (i: number, patch: Partial<Linea>) => onChange({ lineas: value.lineas.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const add = (lado: 'D' | 'H') => onChange({ lineas: [...value.lineas, { cuenta: '', debe: lado === 'D' ? -1 : 0, haber: lado === 'H' ? -1 : 0 }] });
  const del = (i: number) => onChange({ lineas: value.lineas.filter((_, k) => k !== i) });
  const debe = value.lineas.map((l, i) => ({ l, i })).filter((x) => x.l.debe !== 0);
  const haber = value.lineas.map((l, i) => ({ l, i })).filter((x) => x.l.haber !== 0);
  const dif = diferencia({ lineas: value.lineas.map((l) => ({ ...l, debe: Math.max(0, l.debe), haber: Math.max(0, l.haber) })) });
  const ok = balancea({ lineas: value.lineas.map((l) => ({ ...l, debe: Math.max(0, l.debe), haber: Math.max(0, l.haber) })) });

  return (
    <div className={`ca ${readOnly ? 'ro' : ''}`}>
      <div className="ca-cols">
        {(['D', 'H'] as const).map((lado) => {
          const rows = lado === 'D' ? debe : haber;
          return (
            <div key={lado} className="ca-col">
              <div className="ca-col-head">
                <b>{lado === 'D' ? 'Debe' : 'Haber'}</b>
                <span className="mono">{money2(lado === 'D' ? totalDebe({ lineas: value.lineas.map((l) => ({ ...l, debe: Math.max(0, l.debe) })) }) : totalHaber({ lineas: value.lineas.map((l) => ({ ...l, haber: Math.max(0, l.haber) })) }))}</span>
              </div>
              {rows.map(({ l, i }) => (
                <LineaRow key={i} l={l} lado={lado} chips={chips} sugeridas={sugeridas} readOnly={readOnly} onCuenta={(c) => upd(i, { cuenta: c })} onMonto={(m) => upd(i, lado === 'D' ? { debe: m } : { haber: m })} onDel={() => del(i)} />
              ))}
              {!readOnly && (
                <button className="btn sm ghost ca-add" onClick={() => add(lado)}>
                  + línea al {lado === 'D' ? 'Debe' : 'Haber'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className={`ca-dif ${ok ? 'ok' : 'bad'}`} role="status">
        {ok ? '✓ El asiento balancea' : value.lineas.length ? `Diferencia Debe − Haber: ${money2(dif)}` : 'Agregá líneas al Debe y al Haber'}
      </div>
    </div>
  );
}

function LineaRow({ l, lado, chips, sugeridas, readOnly, onCuenta, onMonto, onDel }: { l: Linea; lado: 'D' | 'H'; chips: Chip[]; sugeridas: string[]; readOnly?: boolean; onCuenta: (c: string) => void; onMonto: (m: number) => void; onDel: () => void }) {
  const monto = lado === 'D' ? l.debe : l.haber;
  return (
    <div className="ca-line">
      <PickerCuenta value={l.cuenta} sugeridas={sugeridas} onChange={onCuenta} readOnly={readOnly} />
      <div className="ca-chips">
        {chips.map((c) => (
          <button key={c.label} className={`chip ${Math.abs(monto - c.monto) < 0.5 ? 'accent' : ''}`} disabled={readOnly} onClick={() => onMonto(round(c.monto))} title={money2(c.monto)}>
            {c.label} {money2(c.monto)}
          </button>
        ))}
      </div>
      {!readOnly && (
        <button className="btn sm ghost ca-del" onClick={onDel} aria-label="Quitar línea">
          ✕
        </button>
      )}
    </div>
  );
}

function PickerCuenta({ value, sugeridas, onChange, readOnly }: { value: string; sugeridas: string[]; onChange: (c: string) => void; readOnly?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const res: Cuenta[] = buscarCuentas(q, sugeridas, 7);
  const sel = value ? cuenta(value) : undefined;
  return (
    <div className="ca-picker" ref={ref}>
      <button className={`ca-sel ${sel ? '' : 'empty'}`} disabled={readOnly} onClick={() => setOpen(!open)} aria-expanded={open}>
        {sel ? (
          <>
            <span className="mono tiny">{sel.codigo}</span> {sel.nombre}
          </>
        ) : (
          'Elegí la cuenta…'
        )}
      </button>
      {open && !readOnly && (
        <div className="ca-pop">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o nombre (ej. 1.1.04 o iva)" aria-label="Buscar cuenta" />
          <ul>
            {res.map((c) => (
              <li key={c.codigo}>
                <button
                  onClick={() => {
                    onChange(c.codigo);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  <span className="mono tiny">{c.codigo}</span> {c.nombre}
                </button>
              </li>
            ))}
            {!res.length && <li className="tiny muted">Sin resultados</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Quita líneas incompletas (sin cuenta o sin importe) antes de grabar. */
export function sanear(a: Asiento): Asiento {
  return { lineas: a.lineas.filter((l) => l.cuenta && (l.debe > 0 || l.haber > 0)).map((l) => ({ cuenta: l.cuenta, debe: Math.max(0, l.debe), haber: Math.max(0, l.haber) })) };
}

/** Vista compacta de un asiento (solo lectura, formato Libro Diario). */
export function AsientoView({ a, titulo }: { a: Asiento; titulo?: string }) {
  return (
    <div className="ca-view">
      {titulo && <div className="ca-view-t">{titulo}</div>}
      {a.lineas.length === 0 && <div className="tiny muted">— sin registración —</div>}
      {a.lineas.map((l, i) => (
        <div key={i} className={`ca-view-l ${l.haber > 0 ? 'h' : ''}`}>
          <span className="mono tiny">{l.cuenta}</span>
          <span className="grow">{cuenta(l.cuenta).nombre}</span>
          <span className="mono num">{l.debe > 0 ? money2(l.debe) : ''}</span>
          <span className="mono num">{l.haber > 0 ? money2(l.haber) : ''}</span>
        </div>
      ))}
    </div>
  );
}
