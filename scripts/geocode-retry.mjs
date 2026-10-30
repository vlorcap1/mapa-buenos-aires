// Segundo intento por dirección postal para los lugares que Nominatim no encontró por nombre.
// Uso: node scripts/geocode-retry.mjs  →  actualiza data/lugares.json en el lugar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data', 'lugares.json');
const lugares = JSON.parse(fs.readFileSync(file, 'utf8'));

const DIRECCIONES = {
  'basilica-del-pilar': 'Junín 1898',
  'fragata-sarmiento': 'Alicia Moreau de Justo 900',
  'pasaje-lanin': 'Lanín 100, Barracas',
  'las-violetas': 'Avenida Rivadavia 3899',
  'london-city': 'Avenida de Mayo 599',
  'don-julio': 'Guatemala 4699',
  'la-cabrera': 'José Antonio Cabrera 5099',
  'pizzeria-guerrin': 'Avenida Corrientes 1368',
  'el-cuartito': 'Talcahuano 937',
  'el-obrero': 'Agustín R. Caffarena 64',
  mishiguene: 'Lafinur 3368',
  'pizzeria-banchero': 'Avenida Almirante Brown 1220',
  'la-mezzetta': 'Avenida Álvarez Thomas 1321',
  'los-infernales-de-guemes': 'Güemes 4315',
  'cafe-san-bernardo': 'Avenida Corrientes 5436',
  'verne-club': 'Avenida Medrano 1475',
  'la-poesia': 'Chile 502',
  'bar-sur': 'Estados Unidos 299',
  'cafe-paulin': 'Sarmiento 635',
  malba: 'Avenida Figueroa Alcorta 3415',
};

const distKm = (a, b, c, d) => {
  const R = 6371, toR = (x) => (x * Math.PI) / 180;
  const h = Math.sin(toR(c - a) / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(toR(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const l of lugares) {
  if (!l.src.startsWith('estimada') || !DIRECCIONES[l.id]) continue;
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('q', `${DIRECCIONES[l.id]}, Ciudad Autónoma de Buenos Aires, Argentina`);
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', '1');
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (verificacion de coordenadas)' } });
    const hits = res.ok ? await res.json() : [];
    if (hits.length) {
      const d = distKm(l.lat, l.lng, Number(hits[0].lat), Number(hits[0].lon));
      if (d < 1.5) {
        l.lat = Number(Number(hits[0].lat).toFixed(6));
        l.lng = Number(Number(hits[0].lon).toFixed(6));
        l.src = `osm direccion (${d.toFixed(2)} km)`;
      } else l.src = `estimada (direccion lejos: ${d.toFixed(1)} km)`;
    } else l.src = 'estimada (direccion sin resultado)';
  } catch (e) { l.src = `estimada (error: ${e.message})`; }
  console.log(`${l.src.padEnd(32)} ${l.name}`);
  await sleep(1100);
}
fs.writeFileSync(file, JSON.stringify(lugares, null, 2));
console.log('listo');
