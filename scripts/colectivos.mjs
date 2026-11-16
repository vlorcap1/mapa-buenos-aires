// Recorridos de colectivos que pasan por la Ciudad, para buscar colectivos directos sin conexión.
// Fuente principal: OpenStreetMap (Overpass), al día y con línea, ramal y sentido. Las líneas que faltan en OSM
// se completan con el dataset "Colectivos: recorridos" de Buenos Aires Data (2019) si está en esa fuente.
// Uso: node scripts/colectivos.mjs  →  data/colectivos.json  { rutas: [{ l: línea, d: "Desde → Hasta", p: polyline o [polylines] (precisión 5, en orden de viaje) }] }
import fs from 'node:fs';

const UA = { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (recorridos de colectivos para mapa turistico)' };
const BBOX = '-34.71,-58.535,-34.525,-58.33'; // Ciudad Autónoma de Buenos Aires
const [S, O, N, E] = [-34.95, -58.95, -34.35, -58.2]; // área del mapa (AMBA): fuera de esto se recorta
const URL_GCBA = 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-recorridos/recorrido-colectivos.geojson';

async function overpass(q) {
  for (let intento = 0; ; intento++) {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: UA, body: new URLSearchParams({ data: q }) });
    if (r.ok) return r.json();
    if (intento < 3) { await new Promise((s) => setTimeout(s, 20000 * (intento + 1))); continue; }
    throw new Error(`Overpass ${r.status}`);
  }
}

// --- geometría -------------------------------------------------------------------------------
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
// Une los tramos (ways) de una ruta en orden de viaje, dando vuelta los que vienen al revés.
// Si entre un tramo y el siguiente hay un hueco de más de 300 m (relación incompleta en OSM), empieza una parte nueva.
const HUECO = (0.3 / 100) ** 2; // ~300 m en grados², suficiente a esta latitud
function encadenar(tramos) {
  const tr = tramos.filter((t) => t.length > 1);
  if (!tr.length) return [];
  let linea = [...tr[0]];
  if (tr.length > 1) {
    const [a, b] = [tr[0][0], tr[0][tr[0].length - 1]];
    const sig = tr[1];
    // El primer tramo se orienta según cuál de sus extremos toca el segundo.
    if (Math.min(d2(a, sig[0]), d2(a, sig[sig.length - 1])) < Math.min(d2(b, sig[0]), d2(b, sig[sig.length - 1]))) linea.reverse();
  }
  const partes = [linea];
  for (const t of tr.slice(1)) {
    const fin = linea[linea.length - 1];
    const orientado = d2(fin, t[0]) <= d2(fin, t[t.length - 1]) ? t : [...t].reverse();
    if (d2(fin, orientado[0]) > HUECO) { linea = [...orientado]; partes.push(linea); continue; }
    linea.push(...(d2(fin, orientado[0]) < 1e-12 ? orientado.slice(1) : orientado));
  }
  return partes;
}
function simplificar(pts, tol = 0.00007) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x1, y1] = a, [x2, y2] = b;
    const dx = x2 - x1, dy = y2 - y1;
    const d = dx || dy ? Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy) : Math.hypot(x - x1, y - y1);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...simplificar(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(pts.slice(idx), tol)];
}
// Codificación polyline de Google (precisión 5) sobre [lng, lat].
function codificar(pts) {
  let out = '', pLat = 0, pLng = 0;
  const num = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  for (const [lng, lat] of pts) {
    const la = Math.round(lat * 1e5), ln = Math.round(lng * 1e5);
    out += num(la - pLat) + num(ln - pLng);
    pLat = la; pLng = ln;
  }
  return out;
}
const dentro = ([lng, lat]) => lat > S && lat < N && lng > O && lng < E;
// Recorta al área del mapa: devuelve los tramos que quedan dentro.
function recortar(pts) {
  const tramos = [];
  let actual = [];
  for (const p of pts) {
    if (dentro(p)) actual.push(p);
    else { if (actual.length > 1) tramos.push(actual); actual = []; }
  }
  if (actual.length > 1) tramos.push(actual);
  return tramos;
}
// Partes en orden de viaje → una polyline (string) o varias (array) si el recorrido tiene cortes.
const aPolylines = (partes) => {
  const cod = partes.flatMap((p) => recortar(p)).map((p) => codificar(simplificar(p)));
  return cod.length === 1 ? cod[0] : cod;
};

// --- OpenStreetMap ---------------------------------------------------------------------------
const CACHE = process.env.CACHE_OVERPASS; // ruta opcional para reutilizar la descarga mientras se ajusta el script
const datos = CACHE && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : await overpass(`[out:json][timeout:300];relation["route"="bus"](${BBOX});out geom;`);
if (CACHE && !fs.existsSync(CACHE)) fs.writeFileSync(CACHE, JSON.stringify(datos));
const rutas = [];
const lineasOsm = new Set();
for (const rel of datos.elements) {
  const t = rel.tags ?? {};
  const linea = /^(\d+)/.exec(t.ref ?? '')?.[1];
  if (!linea || /larga distancia/i.test(t.name ?? '')) continue; // turísticos, eBus y larga distancia, afuera
  const tramos = (rel.members ?? []).filter((m) => m.type === 'way' && !/platform/.test(m.role) && m.geometry).map((m) => m.geometry.map((g) => [g.lon, g.lat]));
  const p = aPolylines(encadenar(tramos));
  if (!p.length) continue;
  const desdeHasta = (t.name ?? '').split(':').slice(1).join(':').trim() || [t.from, t.to].filter(Boolean).join(' → ');
  rutas.push({ l: String(Number(linea)), d: desdeHasta, p });
  lineasOsm.add(String(Number(linea)));
}

// --- Buenos Aires Data (solo líneas ausentes en OSM) -----------------------------------------
try {
  const g = await (await fetch(URL_GCBA, { headers: UA })).json();
  for (const f of g.features) {
    const pr = f.properties;
    if (!/^\d+$/.test(pr.linea ?? '')) continue;
    const linea = String(Number(pr.linea));
    if (lineasOsm.has(linea)) continue;
    const geo = f.geometry;
    const partes = geo.type === 'LineString' ? [geo.coordinates] : geo.coordinates;
    const p = aPolylines(encadenar(partes));
    if (!p.length) continue;
    const lugar = (s) => (s ?? '').split('(')[0].trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    const [desde, hasta] = [pr.desde, pr.hasta]; // ya vienen según el sentido (IDA o VUELTA)
    rutas.push({ l: linea, d: `${lugar(desde)} → ${lugar(hasta)}`, p, f: 'gcba2019' });
  }
} catch (e) { console.log('Buenos Aires Data no disponible:', e.message); }

rutas.sort((a, b) => Number(a.l) - Number(b.l) || a.d.localeCompare(b.d));
fs.writeFileSync('data/colectivos.json', JSON.stringify({ fuente: 'OpenStreetMap (Overpass); Buenos Aires Data 2019 para líneas ausentes', fecha: new Date().toISOString().slice(0, 10), rutas }));
const lineas = new Set(rutas.map((r) => r.l));
console.log(`${rutas.length} recorridos de ${lineas.size} líneas (${rutas.filter((r) => r.f).length} de Buenos Aires Data) · ${Math.round(fs.statSync('data/colectivos.json').size / 1024)} kB → data/colectivos.json`);
