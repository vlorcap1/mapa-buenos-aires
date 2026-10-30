// Verifica las coordenadas de data/lugares.src.tsv contra Nominatim (OpenStreetMap).
// Si OSM devuelve un resultado a menos de 1,5 km de la coordenada estimada, la reemplaza.
// Si no hay resultado o está lejos, conserva la estimada y lo anota en la columna `src`.
// Uso: node scripts/geocode.mjs  →  escribe data/lugares.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'data', 'lugares.src.tsv'), 'utf8').trim().split(/\r?\n/);
const header = src.shift().split('\t');
const rows = src.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [header[i], v])));

const distKm = (a, b, c, d) => {
  const R = 6371, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(c - a), dLng = toR(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Los lugares ya geocodificados se conservan (incluidas correcciones manuales); con --todo se rehacen todos.
const salida = path.join(root, 'data', 'lugares.json');
const previos = fs.existsSync(salida) && !process.argv.includes('--todo') ? JSON.parse(fs.readFileSync(salida, 'utf8')) : [];
const previoPorId = new Map(previos.map((p) => [p.id, p]));

const out = [];
for (const r of rows) {
  const previo = previoPorId.get(slug(r.name));
  if (previo) { out.push({ ...previo, cat: r.cat, barrio: r.barrio, desc: r.desc }); continue; }
  const lat0 = Number(r.lat), lng0 = Number(r.lng);
  let lat = lat0, lng = lng0, from = 'estimada';
  try {
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('q', `${r.q}, ${r.barrio === 'Tigre' ? 'Tigre, Buenos Aires' : 'Ciudad Autónoma de Buenos Aires'}, Argentina`);
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('limit', '3');
    const res = await fetch(u, { headers: { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (verificacion de coordenadas)' } });
    if (res.ok) {
      const hits = await res.json();
      const near = hits.map((h) => ({ ...h, d: distKm(lat0, lng0, Number(h.lat), Number(h.lon)) })).filter((h) => h.d < 1.5).sort((a, b) => a.d - b.d)[0];
      if (near) { lat = Number(Number(near.lat).toFixed(6)); lng = Number(Number(near.lon).toFixed(6)); from = `osm (${near.d.toFixed(2)} km)`; }
      else if (hits.length) from = `estimada (osm lejos: ${hits[0].d.toFixed(1)} km)`;
    }
  } catch (e) { from = `estimada (error: ${e.message})`; }
  out.push({ id: slug(r.name), cat: r.cat, name: r.name, barrio: r.barrio, lat, lng, desc: r.desc, src: from });
  console.log(`${from.padEnd(30)} ${r.name}`);
  await sleep(1100);
}
fs.writeFileSync(salida, JSON.stringify(out, null, 2));
console.log(`\n${out.length} lugares → data/lugares.json`);
