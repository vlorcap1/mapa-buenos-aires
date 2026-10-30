// Copia al proyecto todas las fotos que todavía se cargan desde internet (Wikimedia, sitios oficiales),
// redimensionadas a 900 px, para que la app funcione sin conexión. Mantiene autor, licencia y enlace de crédito.
// Uso: node scripts/fotos-local.mjs
import fs from 'node:fs';
import sharp from 'sharp';

const fotos = JSON.parse(fs.readFileSync('data/fotos.json', 'utf8'));
fs.mkdirSync('public/fotos', { recursive: true });
const UA = { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (copia local de fotos para uso sin conexion)' };
const conTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, fallos = 0;
for (const [id, f] of Object.entries(fotos)) {
  if (!/^https?:/.test(f.url)) { ok++; continue; } // ya es local
  const destino = `public/fotos/${id}.jpg`;
  try {
    const r = await conTimeout(fetch(f.url, { headers: UA }), 30000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const info = await sharp(buf).rotate().resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(destino);
    f.urlOriginal = f.url;
    f.url = `fotos/${id}.jpg`;
    f.ancho = info.width;
    f.alto = info.height;
    ok++;
    console.log(`ok     ${id}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} kB`);
  } catch (e) {
    fallos++;
    console.log(`error  ${id}: ${e.message}`);
  }
  await sleep(/wikimedia/.test(f.urlOriginal ?? f.url) ? 400 : 100);
}
fs.writeFileSync('data/fotos.json', JSON.stringify(fotos, null, 2));
console.log(`\n${ok} locales, ${fallos} fallos`);
