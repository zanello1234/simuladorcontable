// Carga de datos reales: tabla editable por entidad, alta/edición, importar CSV pegado, exportar CSV
// y generación de vencimientos del mes.
import { useEffect, useMemo, useState } from 'react';
import { claudeDescargar } from '../../engine/cloud';
import { money } from '../../engine/format';
import { generarTareasDelMes } from '../../engine/obligations';
import { makeRng } from '../../engine/rng';
import type { Client } from '../../engine/types';
import { ConfirmButton, Empty, Section, Segmented } from '../../ui/components';
import { mapearCabeceras, parseCSV, toCSV } from '../csv';
import { ENTIDADES, ENTIDAD_LABEL, ESQUEMA, filaVacia, hoyISO, normalizar, nuevoId, type Campo, type Entidad } from '../model';
import { useReal } from '../store';

type Fila = Record<string, unknown> & { id: string };

const KIND_IMPUESTO: Record<string, string> = { iva: 'IVA', iibb: 'IIBB', sueldos: 'Sueldos', f931: 'F.931', monotributo: 'Monotributo', recategorizacion: 'Recategorización', ganancias_ph: 'Ganancias PH', bienes_personales: 'Bienes Personales', ganancias_soc: 'Ganancias Soc.', balance: 'Balance', registracion: 'Registración' };

export function Cargar({ entidadInicial, editarId, onConsumido }: { entidadInicial?: Entidad; editarId?: string; onConsumido?: () => void }) {
  const { data, canEdit, guardarFila, guardarFilas, borrarFila, error } = useReal();
  const [ent, setEnt] = useState<Entidad>(entidadInicial ?? 'equipo');
  const [edit, setEdit] = useState<Fila | null>(null);
  const [vista, setVista] = useState<'tabla' | 'csv'>('tabla');
  const [csv, setCsv] = useState('');
  const [msg, setMsg] = useState('');
  const [mesGen, setMesGen] = useState(hoyISO().slice(0, 7));
  const hoy = hoyISO();

  useEffect(() => {
    if (!entidadInicial) return;
    setEnt(entidadInicial);
    if (editarId) {
      const f = (data[entidadInicial] as unknown as Fila[]).find((x) => x.id === editarId);
      if (f) setEdit({ ...f });
    }
    onConsumido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadInicial, editarId]);

  const filas = data[ent] as unknown as Fila[];
  const campos = ESQUEMA[ent];
  const visibles = campos.filter((c) => c.key !== 'id').slice(0, 7);
  const nombreRef = (c: Campo, v: unknown): string => {
    if (c.ref === 'clientes') return data.clientes.find((x) => x.id === v)?.razonSocial ?? String(v ?? '');
    if (c.ref === 'equipo') return data.equipo.find((x) => x.id === v)?.nombre ?? String(v ?? '');
    if (c.ref === 'facturas') return data.facturas.find((x) => x.id === v)?.numero ?? String(v ?? '');
    if (c.opciones) return c.opciones.find((o) => o.v === v)?.label ?? String(v ?? '');
    if (c.tipo === 'bool') return v ? 'Sí' : 'No';
    if (c.tipo === 'numero' && /monto|honorario|costo|meta/i.test(c.key)) return money(Number(v) || 0);
    return String(v ?? '');
  };
  const opcionesRef = (c: Campo): { v: string; label: string }[] => {
    if (c.ref === 'clientes') return data.clientes.map((x) => ({ v: x.id, label: x.razonSocial }));
    if (c.ref === 'equipo') return data.equipo.map((x) => ({ v: x.id, label: x.nombre }));
    if (c.ref === 'facturas') return data.facturas.map((x) => ({ v: x.id, label: `${x.numero || x.id} · ${money(x.monto)}` }));
    return c.opciones ?? [];
  };

  const preview = useMemo(() => {
    if (!csv.trim()) return null;
    const p = parseCSV(csv);
    const map = mapearCabeceras(p.headers, campos);
    const faltan = campos.filter((c) => c.requerido && !Object.values(map).includes(c.key)).map((c) => c.label);
    const ignoradas = p.headers.filter((h) => !map[h]);
    const filasNorm = p.rows.map((r) => {
      const raw: Record<string, unknown> = {};
      for (const [h, k] of Object.entries(map)) raw[k] = r[h];
      // referencias por nombre
      for (const c of campos) {
        if (!c.ref || !raw[c.key]) continue;
        const ops = opcionesRef(c);
        const txt = String(raw[c.key]).trim().toLowerCase();
        const hit = ops.find((o) => o.v === raw[c.key]) ?? ops.find((o) => o.label.toLowerCase() === txt);
        if (hit) raw[c.key] = hit.v;
      }
      return normalizar(ent, raw, hoy) as Fila;
    });
    return { map, faltan, ignoradas, filas: filasNorm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv, ent, data]);

  const exportar = async () => {
    const texto = toCSV(filas, campos.map((c) => c.key));
    const nombre = `${ent}-${hoy}.csv`;
    const r = await claudeDescargar(nombre, texto);
    if (r === 'sin_soporte') {
      const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setMsg(r === 'no' ? 'No se exportó.' : `Exportado ${nombre}.`);
  };

  const generarMes = async () => {
    const [y, m] = mesGen.split('-').map(Number);
    const primero = `${mesGen}-01`;
    const nuevas: Fila[] = [];
    const existentes = new Set(data.vencimientos.map((v) => `${v.clienteId}|${v.impuesto}|${v.periodo}`));
    for (const c of data.clientes.filter((x) => x.estado === 'activo' && x.tipo !== 'otro')) {
      const cliente: Client = {
        id: c.id,
        nombre: c.razonSocial,
        cuit: /\d-\d{8}-\d/.test(c.cuit) ? c.cuit : `20-00000000-${(c.cuit.replace(/\D/g, '').slice(-1) || '0')}`,
        kind: c.tipo as Client['kind'],
        rubro: 'servicios',
        jurisdiccion: c.jurisdiccion,
        empleados: c.empleados,
        volumen: 80,
        ordenDocumental: 1,
        pagador: 1,
        honorario: c.honorarioMensual,
        honorarioActualizadoEl: hoy,
        honorarioIndice: 1,
        satisfaccion: 70,
        desde: hoy,
        riesgoFiscal: 0.1,
        erroresLatentes: [],
        cierre: 12,
        categoria: 'C',
        avatar: { piel: '#000', pelo: '#000', peinado: 'corto', ropa: '#000', anteojos: false, barba: false },
        activo: true,
      };
      const ts = [...generarTareasDelMes(makeRng(1), cliente, mesGen, primero, () => nuevoId('ve')), ...generarTareasDelMes(makeRng(1), cliente, mesGen, primero, () => nuevoId('ve'), 1, 22)];
      for (const t of ts) {
        const impuesto = KIND_IMPUESTO[t.kind] ?? 'Otro';
        const clave = `${c.id}|${impuesto}|${t.periodo}`;
        if (existentes.has(clave)) continue;
        existentes.add(clave);
        const horas = t.steps.reduce((a, s) => a + s.horasTotales, 0);
        nuevas.push({ id: t.id, clienteId: c.id, impuesto, periodo: t.periodo, vence: t.vence, estado: 'pendiente', presentadaEl: '', responsable: c.responsable, horasEstimadas: Math.round(horas * 10) / 10, notas: 'Generado · fecha orientativa' });
      }
    }
    void y;
    void m;
    if (!nuevas.length) return setMsg('No hay vencimientos nuevos para generar (ya existen o no hay clientes activos).');
    const n = await guardarFilas('vencimientos', nuevas);
    setMsg(`Se generaron ${n} vencimientos para ${mesGen}. Los días son orientativos: revisalos contra el calendario de ARCA.`);
  };

  return (
    <div className="screen cargar">
      {!canEdit && <div className="alert warn">Solo lectura: necesitás ser editor del tablero para cargar datos.</div>}
      {error && <div className="alert bad">{error}</div>}
      <div className="row wrap ent-tabs">
        {ENTIDADES.map((e) => (
          <button key={e} className={`btn sm ${ent === e ? 'primary' : ''}`} onClick={() => { setEnt(e); setEdit(null); setCsv(''); setMsg(''); }}>
            {ENTIDAD_LABEL[e].icon} {ENTIDAD_LABEL[e].label} <span className="chip">{(data[e] as unknown as Fila[]).length}</span>
          </button>
        ))}
      </div>
      <Section
        title={`${ENTIDAD_LABEL[ent].icon} ${ENTIDAD_LABEL[ent].label}`}
        right={
          <div className="row wrap">
            <Segmented size="sm" value={vista} onChange={setVista} options={[{ v: 'tabla', label: 'Tabla' }, { v: 'csv', label: 'Importar CSV' }]} />
            <button className="btn sm" onClick={exportar} disabled={!filas.length}>📥 Exportar CSV</button>
            <button className="btn sm primary" disabled={!canEdit} onClick={() => setEdit({ id: '', ...filaVacia(ent, hoy) } as Fila)}>＋ Nuevo</button>
          </div>
        }
      >
        <p className="small muted mb">{ENTIDAD_LABEL[ent].ayuda}</p>
        {msg && <div className="alert info small mb">{msg}</div>}

        {ent === 'vencimientos' && canEdit && (
          <div className="row wrap gen-row mb">
            <span className="small"><b>Generar vencimientos del mes</b> según tipo de cliente y terminación de CUIT:</span>
            <input id="gen-mes" type="month" value={mesGen} onChange={(e) => setMesGen(e.target.value)} />
            <button className="btn sm" onClick={generarMes} disabled={!data.clientes.length}>⚙️ Generar</button>
          </div>
        )}

        {edit && (
          <form
            className="card edit-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const fila = normalizar(ent, edit, hoy) as Fila;
              const faltan = campos.filter((c) => c.requerido && (fila[c.key] === '' || fila[c.key] === undefined || (c.tipo === 'numero' && !Number(fila[c.key]) && c.key !== 'empleados')));
              if (faltan.length) return setMsg(`Faltan: ${faltan.map((c) => c.label).join(', ')}.`);
              if (await guardarFila(ent, fila)) {
                setEdit(null);
                setMsg('Guardado.');
              }
            }}
          >
            <div className="form-grid">
              {campos.filter((c) => c.key !== 'id').map((c) => (
                <label key={c.key} className="field">
                  <span>{c.label}{c.requerido ? ' *' : ''}</span>
                  {c.tipo === 'select' ? (
                    <select id={`f-${c.key}`} value={String(edit[c.key] ?? '')} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })}>
                      {(c.ref ? [{ v: '', label: '—' }, ...opcionesRef(c)] : opcionesRef(c)).map((o) => (
                        <option key={o.v} value={o.v}>{o.label}</option>
                      ))}
                    </select>
                  ) : c.tipo === 'bool' ? (
                    <select id={`f-${c.key}`} value={edit[c.key] ? 'si' : 'no'} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value === 'si' })}>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  ) : (
                    <input id={`f-${c.key}`} type={c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : 'text'} step={c.tipo === 'numero' ? 'any' : undefined} value={String(edit[c.key] ?? '')} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>
            <div className="row mt">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
              <div className="spacer" />
              <button type="submit" className="btn primary">Guardar</button>
            </div>
          </form>
        )}

        {vista === 'csv' ? (
          <div className="col">
            <p className="small">Pegá un CSV (de Odoo, Excel o Sheets). Separador ; , o tabulación; primera fila con los nombres de columna: <code>{campos.map((c) => c.key).join(', ')}</code>. Los clientes y el equipo se pueden referenciar por nombre.</p>
            <textarea id="csv-text" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`${campos.slice(1, 5).map((c) => c.key).join(';')}\n...`} />
            {preview && (
              <div className="card">
                <p className="small"><b>{preview.filas.length}</b> filas detectadas. Columnas reconocidas: {Object.values(preview.map).join(', ') || 'ninguna'}.</p>
                {preview.ignoradas.length > 0 && <p className="tiny muted">Ignoradas: {preview.ignoradas.join(', ')}</p>}
                {preview.faltan.length > 0 && <p className="tiny neg">Faltan columnas obligatorias: {preview.faltan.join(', ')}</p>}
                <div className="table-wrap scroll mt">
                  <table className="tbl">
                    <thead><tr>{visibles.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                    <tbody>{preview.filas.slice(0, 8).map((f) => <tr key={f.id}>{visibles.map((c) => <td key={c.key}>{nombreRef(c, f[c.key])}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <div className="row mt">
                  <div className="spacer" />
                  <button className="btn primary" disabled={!canEdit || !preview.filas.length || preview.faltan.length > 0} onClick={async () => { const n = await guardarFilas(ent, preview.filas); setMsg(`Importadas ${n} filas.`); setCsv(''); setVista('tabla'); }}>
                    Importar {preview.filas.length} filas
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : filas.length ? (
          <div className="table-wrap scroll">
            <table className="tbl">
              <thead>
                <tr>
                  {visibles.map((c) => <th key={c.key} className={c.tipo === 'numero' ? 'num' : ''}>{c.label}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...filas].reverse().map((f) => (
                  <tr key={f.id}>
                    {visibles.map((c) => <td key={c.key} className={c.tipo === 'numero' ? 'num' : ''}>{nombreRef(c, f[c.key])}</td>)}
                    <td className="row acciones">
                      <button className="btn sm ghost" disabled={!canEdit} onClick={() => setEdit({ ...f })}>✏️</button>
                      {canEdit && <ConfirmButton className="btn sm ghost" confirmLabel="¿Borrar?" onConfirm={() => void borrarFila(ent, f.id)}>🗑️</ConfirmButton>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={ENTIDAD_LABEL[ent].icon}>
            Todavía no hay {ENTIDAD_LABEL[ent].label.toLowerCase()}. Tocá <b>＋ Nuevo</b> para cargar a mano o <b>Importar CSV</b> para pegar una exportación.
            {ent === 'equipo' && ' Empezá por vos: rol Titular y tus horas semanales.'}
          </Empty>
        )}
      </Section>
    </div>
  );
}
