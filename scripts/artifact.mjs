// Convierte un HTML autocontenido de Vite en una página lista para publicar como Artifact de
// claude.ai: sin <html>/<head>/<body> propios (el publicador agrega el esqueleto), con <title>
// al principio, estilos y fuentes arriba, y el bundle al final del contenido.
// Uso: node scripts/artifact.mjs [entrada] [salida] [título]
import fs from 'node:fs';

const [entrada = 'dist-single/index.html', salida = 'dist-single/partida-doble.html', titulo = 'Partida Doble'] = process.argv.slice(2);
const src = fs.readFileSync(entrada, 'utf8');
const sStart = src.indexOf('<script');
const sEnd = src.lastIndexOf('</script>') + '</script>'.length;
if (sStart < 0) throw new Error('No encontré el bundle');
const script = src.slice(sStart, sEnd).replace(' crossorigin', '');
const resto = src.slice(0, sStart) + src.slice(sEnd);
const styles = [...resto.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const links = [...resto.matchAll(/<link [^>]*>/g)].map((m) => m[0]).join('\n');
const out = [`<title>${titulo}</title>`, '<meta name="theme-color" content="#1d2b3a">', links, styles, '<div id="root"></div>', script, ''].join('\n');
fs.writeFileSync(salida, out);
console.log(`${salida} (${(out.length / 1024).toFixed(0)} KB)`);
