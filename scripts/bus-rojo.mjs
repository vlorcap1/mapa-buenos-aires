// Trazado APROXIMADO del bus turístico rojo (Buenos Aires City Bus). El operador solo publica un mapa en imagen
// (buenosairescitybus.com/down_map.php?map=true); acá se transcribe ese recorrido como una lista de cuadras
// ("por tal calle, entre tal y tal") y se une por calles con OSRM (perfil auto, respeta el sentido de las calles).
// Cada cuadra se convierte en el punto medio entre sus dos esquinas, calculadas con las calles de OpenStreetMap,
// así el punto cae sobre la calle correcta y no en una vecina.
// Uso: node scripts/bus-rojo.mjs  →  agrega `trazado` al circuito rojo de data/bus-turistico.json
import fs from 'node:fs';

const UA = { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (trazado aproximado de bus turistico)' };
const BBOX = '-34.70,-58.53,-34.52,-58.33';

// [calle, entre, y, nota]: expresiones regulares sobre el nombre en OSM (sin distinguir mayúsculas).
// ['@', calle, lat, lng, nota]: el punto de esa calle más cercano a lat/lng (cuando las calles no se cruzan).
const CUADRAS = [
  ['Roque S[aá]enz Pe[ñn]a', '^Esmeralda$', '^Maip[uú]$', 'P00 Diagonal Norte 728'],
  ['^Balcarce$', 'Hip[oó]lito Yrigoyen', 'Rivadavia', 'vuelta a Plaza de Mayo'],
  ['^Avenida de Mayo$', '^Per[uú]$', '^Chacabuco$', 'Av. de Mayo'],
  ['^Avenida de Mayo$', '^Salta$', 'Santiago del Estero', 'Av. de Mayo'],
  ['^Avenida de Mayo$', '^San Jos[eé]$', 'Luis S[aá]enz Pe[ñn]a', 'P01 Plaza del Congreso'],
  ['@', '^Sol[ií]s$', -34.6115, -58.3905, 'Solís'],
  ['^Avenida Belgrano$', '^Piedras$', '^Tacuar[ií]$', 'Av. Belgrano'],
  ['@', 'Avenida Paseo Col[oó]n', -34.6160, -58.3688, 'P02 Paseo de la Historieta'],
  ['Avenida Independencia', '^Bol[ií]var$', '^Per[uú]$', 'Independencia'],
  ['Avenida San Juan', '^Defensa$', '^Balcarce$', 'P03 San Telmo'],
  ['Paseo Col[oó]n', 'Juan de Garay', '^Avenida Brasil$|^Brasil$', 'Paseo Colón hacia La Boca'],
  ['Pedro de Mendoza', 'Caffarena', 'Pinz[oó]n', 'P04 Usina del Arte'],
  ['^Brandsen$', 'Del Valle Iberlucea', 'Irala', 'P05 La Bombonera'],
  ['Pedro de Mendoza', 'Del Valle Iberlucea', '^Caminito$|Garibaldi', 'P06 Caminito'],
  ['Regimiento de Patricios', '^Su[aá]rez$', '^Olavarr[ií]a$', 'Av. Regimiento de Patricios'],
  ['Mart[ií]n Garc[ií]a', 'Montes de Oca', 'Hernandarias|Defensa', 'Av. Martín García'],
  ['Ingeniero Huergo', '^Avenida Brasil$|^Brasil$', 'Avenida Independencia', 'Av. Ingeniero Huergo'],
  ['@', 'Ach[aá]val Rodr[ií]guez', -34.61693, -58.35675, 'P07 Costanera Sur'],
  ['@', 'Avenida Alicia Moreau de Justo', -34.6078, -58.3650, 'P08 Puente de la Mujer'],
  ['@', 'Avenida Ant[aá]rtida Argentina', -34.5985, -58.3670, 'P09 Terminal Fluvial'],
  ['Leandro N\\.? Alem', '^Viamonte$', '^Tucum[aá]n$', 'Av. Leandro N. Alem'],
  ['^Avenida C[oó]rdoba$', '^Florida$', '^San Mart[ií]n$', 'P10 Galerías Pacífico'],
  ['@', '^Avenida C[oó]rdoba$', -34.5993, -58.3870, 'Av. Córdoba'],
  ['@', '^Avenida C[oó]rdoba$', -34.5994, -58.3926, 'P11 Plaza Rodríguez Peña'],
  ['@', '^Avenida Santa Fe$', -34.5955, -58.3925, 'Av. Santa Fe'],
  ['^Avenida Santa Fe$', '^Suipacha$', '^Esmeralda$', 'P12 Av. Santa Fe 808'],
  ['Avenida del Libertador', '^Cerrito$|Carlos Pellegrini', '^Avenida Callao$', 'Av. del Libertador'],
  ['Figueroa Alcorta', 'Pueyrred[oó]n', 'Austria|Agote', 'P13 Floralis Genérica'],
  ['Figueroa Alcorta', 'Salguero|Jer[oó]nimo Salguero', 'Ortiz de Ocampo|Tagle', 'P14 MALBA'],
  ['@', 'Avenida Presidente Sarmiento', -34.5690, -58.4110, 'P15 Planetario'],
  ['@', 'Costanera Rafael Obligado', -34.56331, -58.40346, 'P16 Costanera Norte'],
  ['@', 'Costanera Rafael Obligado', -34.5615, -58.4065, 'P17 Plaza Puerto Argentino'],
  ['@', 'Ra[uú]l Alfons[ií]n', -34.5394, -58.4422, 'P18 Parque de la Memoria'],
  ['Udaondo', 'Figueroa Alcorta', 'Libertador', 'P19 Estadio Monumental'],
  ['Avenida Monroe|^Monroe$', 'Avenida del Libertador', 'Cramer|Arribe[ñn]os', 'Av. Monroe'],
  ['Avenida del Libertador', 'Juramento', 'Echeverr[ií]a|Sucre', 'P20 Barrancas de Belgrano'],
  ['Avenida del Libertador', 'Dorrego', 'Olleros|Matienzo', 'P21 Campo Argentino de Polo'],
  ['Avenida del Libertador', 'Sarmiento', 'Casares|Berro', 'P22 Monumento a los Españoles'],
  ['Avenida del Libertador', 'Mariscal Ram[oó]n Castilla|Castilla', 'Tagle|Salguero', 'P23 Museo de Arte Decorativo'],
  ['Avenida del Libertador', 'Pueyrred[oó]n', 'Agote|Austria', 'P24 Museo Nacional de Bellas Artes'],
  ['Avenida Alvear|^Alvear$', 'Ayacucho', 'Rodr[ií]guez Pe[ñn]a', 'Av. Alvear'],
  ['^Cerrito$', '^Viamonte$', '^Tucum[aá]n$', 'P25 Teatro Colón'],
  ['Roque S[aá]enz Pe[ñn]a', 'Carlos Pellegrini|Cerrito', '^Suipacha$', 'Diagonal Norte'],
  ['Roque S[aá]enz Pe[ñn]a', '^Esmeralda$', '^Maip[uú]$', 'P00 cierre del circuito'],
];

async function overpass(q) {
  for (let i = 0; ; i++) {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: UA, body: new URLSearchParams({ data: q }) });
    if (r.ok) return r.json();
    if (i < 3) { await new Promise((s) => setTimeout(s, 15000 * (i + 1))); continue; }
    throw new Error(`Overpass ${r.status}`);
  }
}

// Una sola descarga: todas las calles cuyo nombre aparece en CUADRAS, con sus nodos.
const patrones = [...new Set(CUADRAS.flatMap((c) => (c[0] === '@' ? [c[1]] : [c[0], c[1], c[2]])).flatMap((p) => p.split('|')))];
const CACHE_OSM = process.env.CACHE_CALLES;
let osm;
if (CACHE_OSM && fs.existsSync(CACHE_OSM)) osm = JSON.parse(fs.readFileSync(CACHE_OSM, 'utf8'));
else {
  const union = patrones.map((p) => `(${p})`).join('|').replace(/"/g, '');
  osm = await overpass(`[out:json][timeout:180];way["highway"]["name"~"${union}",i](${BBOX});out body;>;out skel qt;`);
  if (CACHE_OSM) fs.writeFileSync(CACHE_OSM, JSON.stringify(osm));
}
const nodos = new Map(osm.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lat, n.lon]]));
const vias = osm.elements.filter((e) => e.type === 'way');
const nodosDe = (re) => {
  const rx = new RegExp(re, 'i');
  const set = new Set();
  for (const w of vias) if (rx.test(w.tags?.name ?? '')) for (const n of w.nodes) set.add(n);
  return set;
};
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.3, (a[1] - b[1]) * 92);
// Esquina entre dos calles: nodos compartidos, agrupados; si hay varias (calles homónimas o que se cruzan dos
// veces), la más cercana a `cerca` (el punto anterior del recorrido).
function esquina(a, b, cerca) {
  const na = nodosDe(a), nb = nodosDe(b);
  const comunes = [...na].filter((n) => nb.has(n)).map((n) => nodos.get(n)).filter(Boolean);
  if (!comunes.length) return null;
  const grupos = [];
  for (const p of comunes) {
    const g = grupos.find((g) => km(g.c, p) < 0.12);
    if (g) { g.pts.push(p); g.c = [g.pts.reduce((s, q) => s + q[0], 0) / g.pts.length, g.pts.reduce((s, q) => s + q[1], 0) / g.pts.length]; }
    else grupos.push({ c: p, pts: [p] });
  }
  grupos.sort((x, y) => km(x.c, cerca) - km(y.c, cerca));
  return grupos[0].c;
}

const puntos = [];
let cerca = [-34.6063, -58.377]; // Diagonal Norte, punto de partida
for (const fila of CUADRAS) {
  if (fila[0] === '@') {
    const [, calle, lat, lng, nota] = fila;
    let mejor = null;
    for (const n of nodosDe(calle)) { const q = nodos.get(n); if (q && (!mejor || km(q, [lat, lng]) < km(mejor, [lat, lng]))) mejor = q; }
    if (!mejor) { console.log(`  ✗ calle no encontrada: ${nota}`); continue; }
    if (km(mejor, [lat, lng]) > 0.25) console.log(`  ⚠ ${nota}: la calle queda a ${km(mejor, [lat, lng]).toFixed(2)} km del punto`);
    puntos.push([mejor[0], mejor[1], nota]);
    cerca = mejor;
    continue;
  }
  const [calle, x1, x2, nota] = fila;
  const a = esquina(calle, x1, cerca), b = a && esquina(calle, x2, a);
  if (!a || !b) { console.log(`  ✗ sin esquina: ${nota} (${calle} y ${!a ? x1 : x2})`); continue; }
  const largo = km(a, b);
  if (largo > 0.5) console.log(`  ⚠ cuadra larga ${largo.toFixed(2)} km: ${nota}`);
  const p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, nota];
  if (km(p, cerca) > 4) console.log(`  ⚠ salto de ${km(p, cerca).toFixed(1)} km hasta ${nota}`);
  puntos.push(p);
  cerca = p;
}

const coords = puntos.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
const r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=true`, { headers: UA })).json();
if (r.code !== 'Ok') throw new Error(`OSRM: ${r.code} ${r.message ?? ''}`);
const ruta = r.routes[0];
const dist = (a, b) => Math.hypot((a[0] - b[0]) * 111.3, (a[1] - b[1]) * 92);
ruta.legs.forEach((leg, i) => {
  const recta = dist(puntos[i], puntos[i + 1]);
  if (leg.distance > 600 && leg.distance / 1000 / Math.max(recta, 0.05) > 2.2) console.log(`  ⚠ desvío: ${puntos[i][2]} → ${puntos[i + 1][2]}: ${(leg.distance / 1000).toFixed(1)} km por calle vs ${recta.toFixed(1)} km recto`);
});
const trazado = ruta.geometry.coordinates.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
const datos = JSON.parse(fs.readFileSync('data/bus-turistico.json', 'utf8'));
const rojo = datos.circuitos.find((c) => c.id === 'rojo');
rojo.trazado = trazado;
// Las paradas se corren al punto del trazado más cercano, para que queden sobre la línea dibujada.
for (const p of rojo.paradas) {
  let mejor = trazado[0];
  for (const q of trazado) if (km([q[1], q[0]], [p.lat, p.lng]) < km([mejor[1], mejor[0]], [p.lat, p.lng])) mejor = q;
  const d = km([mejor[1], mejor[0]], [p.lat, p.lng]);
  if (d > 0.4) console.log(`  ⚠ parada ${p.n} ${p.nombre}: el trazado pasa a ${d.toFixed(2)} km`);
  p.lat = mejor[1]; p.lng = mejor[0];
}
rojo.trazadoAproximado = true;
datos.fuentes.rojoTrazado = 'transcripción del mapa del operador, unida por calles con OSRM (aproximado)';
fs.writeFileSync('data/bus-turistico.json', JSON.stringify(datos));
console.log(`rojo: ${puntos.length} puntos de paso, ${trazado.length} vértices, ${(ruta.distance / 1000).toFixed(1)} km → data/bus-turistico.json`);
