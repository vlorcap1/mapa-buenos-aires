// Busca fotos en un buscador de imágenes (DuckDuckGo Images, sin clave) para los lugares sin foto.
// Modo listar:  node scripts/fotos-buscador.mjs <carpeta>   → descarga las 3 primeras candidatas por lugar en <carpeta>/<id>-N.jpg y escribe <carpeta>/candidatas.json
// Modo aplicar: node scripts/fotos-buscador.mjs <carpeta> --aplicar  → usa data/buscador.elegidas.json {id: N | null}, copia la imagen
//               redimensionada a public/fotos/<id>.jpg y anota en data/fotos.json el crédito con la página de origen.
import fs from 'node:fs';
import path from 'node:path';
const lugares = JSON.parse(fs.readFileSync('data/lugares.json', 'utf8'));
const fotos = JSON.parse(fs.readFileSync('data/fotos.json', 'utf8'));
const carpeta = process.argv[2];
if (!carpeta) { console.error('Uso: node scripts/fotos-buscador.mjs <carpeta> [--aplicar]'); process.exit(1); }
fs.mkdirSync(carpeta, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const conTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const CONSULTAS = {
  'cafe-san-juan': 'Café San Juan restaurante San Telmo Buenos Aires',
  'parrilla-pena': 'Parrilla Peña Rodríguez Peña 682 fachada',
  mishiguene: 'Mishiguene Tomás Kalika restaurante',
  sacro: 'Sacro restaurante plant based Palermo Buenos Aires',
  'siga-la-vaca': 'Siga la Vaca Puerto Madero parrilla',
  'los-infernales-de-guemes': 'restaurante "Los Infernales" Güemes 4315 Palermo empanadas salteñas',
  'el-nino-gordo': 'Niño Gordo parrilla asiática Thames Palermo',
  napoles: 'Nápoles bar San Telmo Caseros 449 Buenos Aires',
  'tres-monos': 'Tres Monos bar Palermo Buenos Aires',
  boticario: 'Boticario bar Palermo Buenos Aires',
  'verne-club': 'Verne Cocktail Club Palermo Buenos Aires',
  uptown: 'Uptown BA bar Arévalo Palermo vagón subte Nueva York',
  'milonga-la-catedral': 'La Catedral Club milonga Almagro Buenos Aires',
  'teatro-nacional': 'Teatro Nacional Buenos Aires Avenida Corrientes fachada',
  'patio-del-liceo': 'Patio del Liceo Santa Fe Buenos Aires',
  'centro-cultural-matienzo': 'Club Cultural Matienzo terraza Pringles',
  'niceto-club': 'Niceto Club Buenos Aires',
  'galeria-bond-street': 'Galería Bond Street Santa Fe skate Buenos Aires',
  'pizzeria-banchero': 'Pizzería Banchero La Boca Buenos Aires',
  'floreria-atlantico': 'Florería Atlántico bar Arroyo 872 Retiro Buenos Aires',
};

async function buscarImagenes(q) {
  const inicio = await conTimeout(fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, { headers: UA }), 15000);
  const html = await inicio.text();
  const vqd = html.match(/vqd=["']?([\d-]+)["']?/)?.[1] ?? html.match(/vqd=([\d-]+)/)?.[1];
  if (!vqd) throw new Error('sin token de búsqueda');
  const u = `https://duckduckgo.com/i.js?l=es-ar&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,,&p=1`;
  const r = await conTimeout(fetch(u, { headers: { ...UA, Referer: 'https://duckduckgo.com/' } }), 15000);
  if (!r.ok) throw new Error(`búsqueda ${r.status}`);
  const j = await r.json();
  return (j.results ?? []).map((x) => ({ imagen: x.image, pagina: x.url, titulo: x.title, w: x.width, h: x.height, fuente: new URL(x.url).hostname.replace(/^www\./, '') }));
}

async function descargar(url, destino) {
  // Primero directo; si el sitio bloquea el acceso externo, a través del proxy de imágenes del buscador.
  const intentos = [url, `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(url)}&f=1`];
  let ultimoError = 'sin intentos';
  for (const u of intentos) {
    try {
      const r = await conTimeout(fetch(u, { headers: { ...UA, Accept: 'image/*' } }), 20000);
      const tipo = r.headers.get('content-type') ?? '';
      if (!r.ok || !/^image\/(jpeg|png|webp)/.test(tipo)) { ultimoError = `no es imagen (${r.status} ${tipo})`; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 15000) { ultimoError = 'demasiado chica'; continue; }
      fs.writeFileSync(destino, buf);
      return { bytes: buf.length, tipo };
    } catch (e) { ultimoError = e.message; }
  }
  throw new Error(ultimoError);
}

const aplicar = process.argv.includes('--aplicar');
const faltan = lugares.filter((l) => !fotos[l.id] && CONSULTAS[l.id]);

if (!aplicar) {
  const archivoCand = path.join(carpeta, 'candidatas.json');
  const candidatas = fs.existsSync(archivoCand) ? JSON.parse(fs.readFileSync(archivoCand, 'utf8')) : {};
  for (const l of faltan) {
    if (candidatas[l.id]?.length && !process.argv.includes('--forzar')) continue; // ya buscado
    console.log(`== ${l.name}`);
    try {
      let resultados;
      for (let intento = 0; ; intento++) {
        try { resultados = await buscarImagenes(CONSULTAS[l.id]); break; }
        catch (e) { if (/403|429/.test(e.message) && intento < 3) { await sleep(60000 * (intento + 1)); continue; } throw e; } // límite del buscador: esperar
      }
      const res = resultados
        .filter((x) => x.w >= 500 && x.h >= 350 && x.w / x.h < 2.5 && x.h / x.w < 1.6)
        .filter((x) => !/instagram\.com|facebook\.com|tiktok\.com|pinterest|alamy|shutterstock|dreamstime|gettyimages|istockphoto|depositphotos/.test(x.fuente)); // redes sin acceso y bancos con marca de agua
      candidatas[l.id] = [];
      let n = 0, fallos = [];
      for (const x of res) {
        if (n >= 3) break;
        const destino = path.join(carpeta, `${l.id}-${n + 1}.jpg`);
        try { await descargar(x.imagen, destino); n++; candidatas[l.id].push({ n, ...x }); console.log(`   ${n}. ${x.w}x${x.h}  ${x.fuente}  | ${x.titulo.slice(0, 70)}`); }
        catch (e) { fallos.push(`${x.fuente}: ${e.message}`); }
      }
      if (!n) console.log(`   sin candidatas descargables (${resultados.length} resultados, ${res.length} aptos${fallos.length ? '; fallos: ' + fallos.slice(0, 3).join(' · ') : ''})`);
    } catch (e) { console.log(`   error: ${e.message}`); }
    fs.writeFileSync(archivoCand, JSON.stringify(candidatas, null, 2));
    await sleep(8000);
  }
} else {
  const sharp = (await import('sharp')).default;
  const candidatas = JSON.parse(fs.readFileSync(path.join(carpeta, 'candidatas.json'), 'utf8'));
  const elegidas = JSON.parse(fs.readFileSync('data/buscador.elegidas.json', 'utf8'));
  fs.mkdirSync('public/fotos', { recursive: true });
  let n = 0;
  for (const l of faltan) {
    const sel = elegidas[l.id];
    if (sel == null) continue;
    const c = candidatas[l.id]?.find((x) => x.n === sel);
    if (!c) { console.log(`omitido    ${l.name}: candidata ${sel} no existe`); continue; }
    const salida = `public/fotos/${l.id}.jpg`;
    const info = await sharp(path.join(carpeta, `${l.id}-${sel}.jpg`)).rotate().resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(salida);
    fotos[l.id] = { url: `fotos/${l.id}.jpg`, ancho: info.width, alto: info.height, autor: c.fuente, licencia: '', archivo: c.pagina, titulo: `buscador: ${c.titulo}`, fuente: 'buscador de imágenes' };
    n++;
    console.log(`ok         ${l.name}  ←  ${c.fuente}  (${info.width}x${info.height}, ${Math.round(info.size / 1024)} kB)`);
  }
  fs.writeFileSync('data/fotos.json', JSON.stringify(fotos, null, 2));
  console.log(`\n${n} fotos agregadas → public/fotos/ y data/fotos.json`);
}
