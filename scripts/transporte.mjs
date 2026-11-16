// Descarga de OpenStreetMap (Overpass) las líneas y estaciones de Subte, Premetro y trenes metropolitanos,
// y las guarda simplificadas en data/transporte.json para dibujar la capa de transporte sin conexión.
// Uso: node scripts/transporte.mjs
import fs from 'node:fs';

const UA = { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (capa de transporte para mapa turistico)' };
// Área del mapa empaquetado (AMBA). Lo que cae afuera se recorta.
const [S, O, N, E] = [-34.95, -58.95, -34.35, -58.2];
const dentro = ([lng, lat]) => lat > S && lat < N && lng > O && lng < E;

// Trenes: solo los servicios metropolitanos (ref L…); los de larga distancia (FC…) comparten vías y no suman.
const TRENES = { LM: 'Mitre', LS: 'Sarmiento', LSM: 'San Martín', LBN: 'Belgrano Norte', LBS: 'Belgrano Sur', LU: 'Urquiza', LGR: 'Roca', LR: 'Roca' };
const COLOR_TREN = '#5b6b80';
const grupoTren = (ref) => TRENES[ref] ?? (ref?.startsWith('LGR') ? 'Roca' : null);

async function overpass(q) {
  for (let intento = 0; ; intento++) {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: UA, body: new URLSearchParams({ data: q }) });
    if (r.ok) return r.json();
    if (intento < 3) { await new Promise((s) => setTimeout(s, 15000 * (intento + 1))); continue; }
    throw new Error(`Overpass ${r.status}`);
  }
}

const bbox = '-34.75,-58.56,-34.52,-58.33'; // relaciones que pasan por la Ciudad
const datos = await overpass(`[out:json][timeout:180];(relation["route"="subway"](${bbox});relation["route"="tram"]["ref"="P"](${bbox});relation["route"="train"](${bbox}););out geom;`);

const redondear = (x) => Math.round(x * 1e5) / 1e5;
// Douglas-Peucker en grados (suficiente a esta escala): saca vértices que no cambian la forma a ~5 m.
function simplificar(pts, tol = 0.00005) {
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
// Corta un trazo en tramos que quedan dentro del área.
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

const lineas = new Map(); // clave → { tipo, ref, nombre, color, ways: Map<id, coords> }
const estaciones = new Map(); // `${nombre}|${clave}` → { nombre, tipo, linea, lat, lng }

for (const rel of datos.elements) {
  const t = rel.tags ?? {};
  let tipo, clave, nombre, color;
  if (t.route === 'subway') { tipo = 'subte'; clave = t.ref; nombre = `Línea ${t.ref}`; color = t.colour; }
  else if (t.route === 'tram') { tipo = 'premetro'; clave = 'P'; nombre = 'Premetro'; color = t.colour ?? '#F38733'; }
  else {
    const g = grupoTren(t.ref);
    if (!g) continue;
    tipo = 'tren'; clave = `Tren ${g}`; nombre = `Tren ${g}`; color = COLOR_TREN;
  }
  if (!clave) continue;
  const reg = lineas.get(clave) ?? { tipo, ref: tipo === 'tren' ? nombre.replace('Tren ', '') : clave, nombre, color, ways: new Map() };
  lineas.set(clave, reg);
  for (const m of rel.members ?? []) {
    if (m.type === 'way' && !/platform/.test(m.role) && m.geometry) {
      reg.ways.set(m.ref, m.geometry.map((g) => [redondear(g.lon), redondear(g.lat)]));
    } else if (m.type === 'node' && /^stop/.test(m.role) && m.lat) {
      // Las paradas de una relación no traen nombre en `out geom`; se completan después con los nodos.
      const k = `${m.ref}|${clave}`;
      if (!estaciones.has(k)) estaciones.set(k, { nodo: m.ref, tipo, linea: reg.ref, color: reg.color, lat: redondear(m.lat), lng: redondear(m.lon) });
    }
  }
}

// Nombres de las paradas.
const ids = [...new Set([...estaciones.values()].map((e) => e.nodo))];
const nombres = new Map();
for (let i = 0; i < ids.length; i += 400) {
  const d = await overpass(`[out:json][timeout:120];node(id:${ids.slice(i, i + 400).join(',')});out tags;`);
  for (const n of d.elements) nombres.set(n.id, n.tags?.name);
}

const features = [];
for (const l of lineas.values()) {
  const coords = [];
  for (const pts of l.ways.values()) for (const tramo of recortar(pts)) coords.push(simplificar(tramo));
  if (!coords.length) continue;
  features.push({ type: 'Feature', properties: { tipo: l.tipo, ref: l.ref, nombre: l.nombre, color: l.color }, geometry: { type: 'MultiLineString', coordinates: coords } });
}

// Una estación por nombre y línea (las dos vías de una estación son dos paradas); fuera del área, afuera.
const porNombre = new Map();
for (const e of estaciones.values()) {
  const nombre = (nombres.get(e.nodo) ?? '').replace(/^Estaci[oó]n\s+/i, '').trim();
  if (!nombre || !dentro([e.lng, e.lat])) continue;
  const k = `${nombre}|${e.linea}`;
  const prev = porNombre.get(k);
  if (prev) { prev.n++; prev.lat += e.lat; prev.lng += e.lng; }
  else porNombre.set(k, { nombre, tipo: e.tipo, linea: e.linea, color: e.color, lat: e.lat, lng: e.lng, n: 1 });
}
const listaEstaciones = [...porNombre.values()]
  .map(({ n, lat, lng, ...e }) => ({ ...e, lat: redondear(lat / n), lng: redondear(lng / n) }))
  .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.linea.localeCompare(b.linea) || a.nombre.localeCompare(b.nombre));

const salida = { fuente: 'OpenStreetMap (Overpass)', fecha: new Date().toISOString().slice(0, 10), lineas: { type: 'FeatureCollection', features }, estaciones: listaEstaciones };
fs.writeFileSync('data/transporte.json', JSON.stringify(salida));
const cuenta = (tipo) => listaEstaciones.filter((e) => e.tipo === tipo).length;
console.log(`${features.length} líneas · estaciones: ${cuenta('subte')} subte, ${cuenta('premetro')} premetro, ${cuenta('tren')} tren · ${Math.round(fs.statSync('data/transporte.json').size / 1024)} kB → data/transporte.json`);
