// Busca fotos Creative Commons en Openverse (Flickr y otras fuentes) para los lugares sin foto en Commons.
// Modo listar:  node scripts/openverse.mjs            → imprime candidatos por lugar
// Modo aplicar: node scripts/openverse.mjs --aplicar  → usa ELEGIDAS (id → identificador de Openverse) y escribe data/fotos.json
import fs from 'node:fs';
const lugares = JSON.parse(fs.readFileSync('data/lugares.json', 'utf8'));
const fotos = JSON.parse(fs.readFileSync('data/fotos.json', 'utf8'));
const UA = { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (fotos CC para mapa turistico)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONSULTAS = {
  rapanui: ['Rapanui chocolate helado Buenos Aires', 'Rapanui heladería Recoleta'],
  'la-cabrera': ['La Cabrera parrilla Palermo', 'La Cabrera restaurant Buenos Aires'],
  'la-brigada': ['La Brigada parrilla San Telmo', 'La Brigada restaurant Buenos Aires'],
  'cafe-san-juan': ['Café San Juan restaurant San Telmo', 'Cafe San Juan Buenos Aires'],
  'parrilla-pena': ['Parrilla Peña Buenos Aires', 'Parrilla Peña Rodriguez Peña'],
  mishiguene: ['Mishiguene restaurant Buenos Aires', 'Mishiguene Palermo'],
  sacro: ['Sacro restaurant Palermo Buenos Aires', 'Sacro plant based Buenos Aires'],
  'siga-la-vaca': ['Siga la Vaca Puerto Madero', 'Siga la Vaca parrilla'],
  'la-mezzetta': ['La Mezzetta pizzería Buenos Aires', 'La Mezzetta fugazzeta'],
  'los-infernales-de-guemes': ['Los Infernales de Güemes', 'Los Infernales empanadas Palermo'],
  'el-nino-gordo': ['Niño Gordo restaurant Palermo', 'Niño Gordo Buenos Aires'],
  napoles: ['Nápoles bar San Telmo Caseros', 'Napoles restaurante Buenos Aires Caseros 449'],
  'presidente-bar': ['Presidente Bar Buenos Aires', 'Presidente Bar Recoleta cocktail'],
  'tres-monos': ['Tres Monos bar Palermo', 'Tres Monos Buenos Aires cocktail'],
  boticario: ['Boticario bar Palermo', 'Boticario Buenos Aires'],
  'verne-club': ['Verne Club bar Buenos Aires', 'Verne Cocktail Club Palermo'],
  uptown: ['Uptown bar Palermo Buenos Aires', 'Uptown bar subte Buenos Aires'],
  'milonga-la-catedral': ['La Catedral milonga Buenos Aires', 'La Catedral Club Almagro tango'],
  'libros-del-pasaje': ['Libros del Pasaje Palermo', 'Libros del Pasaje librería Buenos Aires'],
  'teatro-nacional': ['Teatro Nacional Corrientes Buenos Aires', 'Teatro Nacional Sancor Seguros'],
};

// id del lugar → identificador de Openverse elegido tras revisar la lista (se completa a mano).
const ELEGIDAS = JSON.parse(fs.existsSync('data/openverse.elegidas.json') ? fs.readFileSync('data/openverse.elegidas.json', 'utf8') : '{}');

async function buscar(q) {
  const u = new URL('https://api.openverse.org/v1/images/');
  u.searchParams.set('q', q);
  u.searchParams.set('page_size', '8');
  u.searchParams.set('license_type', 'commercial'); // CC BY, BY-SA, CC0, PDM: aptas para cualquier uso con crédito
  for (let i = 0; ; i++) {
    const r = await fetch(u, { headers: UA });
    if (r.status === 429 && i < 4) { await sleep(15000); continue; }
    if (!r.ok) throw new Error(`openverse ${r.status}`);
    return (await r.json()).results ?? [];
  }
}

const aplicar = process.argv.includes('--aplicar');
const faltan = lugares.filter((l) => !fotos[l.id]);
let agregadas = 0;
for (const l of faltan) {
  if (aplicar) {
    const idOv = ELEGIDAS[l.id];
    if (!idOv) continue;
    const r = await fetch(`https://api.openverse.org/v1/images/${idOv}/`, { headers: UA });
    if (!r.ok) { console.log(`error ${l.name}: ${r.status}`); continue; }
    const d = await r.json();
    fotos[l.id] = {
      url: d.url, ancho: d.width ?? 900, alto: d.height ?? 600,
      autor: d.creator || 'Autor desconocido',
      licencia: `${d.license.toUpperCase().replace(/^(?!CC|PDM)/, 'CC ')} ${d.license_version ?? ''}`.trim(),
      archivo: d.foreign_landing_url, titulo: `Openverse: ${d.title}`, fuente: d.source,
    };
    agregadas++; console.log(`ok         ${l.name}  ←  ${d.title} (${d.source}, ${d.creator})`);
    await sleep(3200);
    continue;
  }
  console.log(`\n== ${l.name} (${l.id})`);
  const vistos = new Set();
  for (const q of CONSULTAS[l.id] ?? [`${l.name} Buenos Aires`]) {
    try {
      for (const r of await buscar(q)) {
        if (vistos.has(r.id)) continue; vistos.add(r.id);
        console.log(`   ${r.id}  ${r.license}${r.license_version ? ' ' + r.license_version : ''}  ${r.source}  ${r.width}x${r.height}  | ${r.title} | ${r.creator ?? ''}${r.tags?.length ? ' | #' + r.tags.slice(0, 6).map((t) => t.name).join(' #') : ''}`);
      }
    } catch (e) { console.log(`   error: ${e.message}`); }
    await sleep(3200); // 20/min
  }
}
if (aplicar) { fs.writeFileSync('data/fotos.json', JSON.stringify(fotos, null, 2)); console.log(`\n${agregadas} fotos agregadas → data/fotos.json`); }
