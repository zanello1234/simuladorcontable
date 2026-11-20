// CSV pegado/exportado: separador autodetectado (; , tab), comillas, decimales con coma.
export function detectarSeparador(texto: string): string {
  const linea = texto.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const cuenta = (c: string) => linea.split(c).length - 1;
  const cands = [';', '\t', ',', '|'];
  return cands.sort((a, b) => cuenta(b) - cuenta(a))[0];
}

export function parseCSV(texto: string, sep = detectarSeparador(texto)): { headers: string[]; rows: Record<string, string>[] } {
  const lineas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;
  const t = texto.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (enComillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo);
      if (fila.some((c) => c.trim())) lineas.push(fila);
      fila = [];
      campo = '';
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((c) => c.trim())) lineas.push(fila);
  if (!lineas.length) return { headers: [], rows: [] };
  const headers = lineas[0].map((h) => h.trim());
  const rows = lineas.slice(1).map((l) => Object.fromEntries(headers.map((h, i) => [h, (l[i] ?? '').trim()])));
  return { headers, rows };
}

/** Empareja cabeceras del CSV con claves del esquema (por clave exacta o por etiqueta, sin tildes ni mayúsculas). */
export function mapearCabeceras(headers: string[], campos: { key: string; label: string }[]): Record<string, string> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const map: Record<string, string> = {};
  for (const h of headers) {
    const n = norm(h);
    const c = campos.find((x) => norm(x.key) === n) ?? campos.find((x) => norm(x.label) === n) ?? campos.find((x) => n.includes(norm(x.key)) || norm(x.label).includes(n));
    if (c) map[h] = c.key;
  }
  return map;
}

export function toCSV(rows: Record<string, unknown>[], keys: string[]): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(';'), ...rows.map((r) => keys.map((k) => esc(r[k])).join(';'))].join('\n');
}
