import { useEffect, useState } from 'react';
import { Section } from '../../ui/components';
import { hoyISO, type RConfig } from '../model';
import { useReal } from '../store';

export function Config() {
  const { data, canEdit, guardarConfig, modo } = useReal();
  const [c, setC] = useState<RConfig>(data.config);
  const [msg, setMsg] = useState('');
  useEffect(() => setC(data.config), [data.config]);
  const set = (k: keyof RConfig, v: string | number) => setC({ ...c, [k]: v });
  return (
    <div className="screen">
      <Section title="⚙️ Configuración del estudio">
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg((await guardarConfig(c)) ? 'Configuración guardada.' : 'No se pudo guardar.');
          }}
        >
          <label className="field"><span>Nombre del estudio</span><input id="cfg-nombre" value={c.nombreEstudio} onChange={(e) => set('nombreEstudio', e.target.value)} /></label>
          <label className="field"><span>Titular</span><input id="cfg-titular" value={c.titular} onChange={(e) => set('titular', e.target.value)} /></label>
          <label className="field"><span>Caja hoy ($)</span><input id="cfg-caja" type="number" value={c.cajaHoy} onChange={(e) => set('cajaHoy', Number(e.target.value))} /></label>
          <label className="field"><span>Fecha de esa caja</span><input id="cfg-caja-fecha" type="date" value={c.cajaHoyFecha || hoyISO()} onChange={(e) => set('cajaHoyFecha', e.target.value)} /></label>
          <label className="field"><span>Días promedio de cobro</span><input id="cfg-dias" type="number" min={0} value={c.diasCobro} onChange={(e) => set('diasCobro', Number(e.target.value))} /></label>
          <label className="field"><span>Inflación mensual estimada (%)</span><input id="cfg-infl" type="number" step="0.1" min={0} value={Math.round(c.inflacionMensualEstimada * 1000) / 10} onChange={(e) => set('inflacionMensualEstimada', Number(e.target.value) / 100)} /></label>
          <div className="row span2">
            <span className="tiny muted">Guardado: {modo === 'nube' ? 'en el artefacto (todos los editores ven lo mismo)' : modo === 'local' ? 'en este navegador' : 'sin persistencia'}</span>
            <div className="spacer" />
            <button className="btn primary" type="submit" disabled={!canEdit}>Guardar</button>
          </div>
        </form>
        {msg && <p className="small mt">{msg}</p>}
        <p className="tiny muted mt">La caja de hoy más los cobros y gastos posteriores a esa fecha es la caja que muestra el tablero. La inflación estimada sirve para medir el atraso de cada abono desde su última actualización.</p>
      </Section>
    </div>
  );
}
