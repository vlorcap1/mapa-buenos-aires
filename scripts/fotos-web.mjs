// Busca una foto real en el sitio oficial de cada local sin foto libre: recorre og:image, <img>, srcset,
// data-src y fondos CSS; descarta logos, íconos y botones; se queda con la foto JPG/WebP más grande.
// Uso: node scripts/fotos-web.mjs            → lista las mejores candidatas por lugar
//      node scripts/fotos-web.mjs --aplicar  → escribe en data/fotos.json la mejor (o la elegida en data/web.elegidas.json)
import fs from 'node:fs';
const lugares = JSON.parse(fs.readFileSync('data/lugares.json', 'utf8'));
const fotos = JSON.parse(fs.readFileSync('data/fotos.json', 'utf8'));
const ELEGIDAS = fs.existsSync('data/web.elegidas.json') ? JSON.parse(fs.readFileSync('data/web.elegidas.json', 'utf8')) : {};
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: 'text/html,*/*' };

export const SITIOS = {
  rapanui: ['https://www.chocolatesrapanui.com.ar/'],
  'la-brigada': ['https://labrigada.com.ar/'],
  'cafe-san-juan': ['https://cafesanjuan.com.ar/'],
  'parrilla-pena': ['https://parrillapena.com.ar/', 'https://www.parrillapenia.com.ar/'],
  mishiguene: ['https://mishiguene.com/', 'https://www.mishiguene.com/', 'https://mishiguene.com.ar/'],
  sacro: ['https://sacro.ar/', 'https://www.sacrorestaurante.com.ar/'], // sacro.com.ar está tomado por un sitio ajeno
  'siga-la-vaca': ['https://sigalavaca.com/'],
  'los-infernales-de-guemes': ['https://losinfernales.com.ar/'],
  'el-nino-gordo': ['https://ninogordo.com/', 'https://www.ninogordo.com/'],
  napoles: ['https://napolesbar.com/', 'https://www.barnapoles.com.ar/'],
  'presidente-bar': ['https://presidentebar.com/', 'https://www.presidentebar.com.ar/'],
  'tres-monos': ['https://tresmonos.bar/', 'https://www.tresmonos.bar/', 'https://tresmonosbar.com.ar/'],
  boticario: ['https://boticariobar.com.ar/'],
  'verne-club': ['https://verneclub.com/'],
  uptown: ['https://uptownba.com/', 'https://www.uptown.com.ar/', 'https://uptownbar.com.ar/'],
  'milonga-la-catedral': ['https://lacatedralclub.com/', 'https://lacatedraltango.com/'],
  'libros-del-pasaje': ['https://www.librosdelpasaje.com.ar/'],
  'teatro-nacional': ['https://www.teatronacional.com.ar/', 'https://teatronacional.com.ar/'],
  'centro-cultural-matienzo': ['https://ccmatienzo.com.ar/'],
  'niceto-club': ['https://www.nicetoclub.com/', 'https://nicetoclub.com/'],
  'patio-del-liceo': ['https://patiodelliceo.com/', 'https://www.patiodelliceo.com.ar/'],
  'galeria-bond-street': ['https://www.bondstreet.com.ar/', 'https://galeriabondstreet.com.ar/'],
  'tranvia-historico-de-caballito': ['https://www.tranvia.org.ar/', 'https://tranvia.org.ar/'],
};

const abs = (u, base) => { try { return new URL(u, base).href; } catch { return null; } };
const conTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const MALO = /logo|icon|favicon|sprite|pixel|boton|button|badge|flag|bandera|whatsapp|instagram|facebook|tripadvisor|google|apple|android|payment|mercadopago|visa|master|\.svg|\.gif|placeholder|blank|loader|spinner|arrow|flecha|menu|nav_|frame\.png|qr/i;

async function candidatas(url) {
  const r = await conTimeout(fetch(url, { headers: UA, redirect: 'follow' }), 15000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const titulo = (html.match(/<title[^>]*>([^<]{1,120})/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const urls = new Set();
  const add = (u) => {
    if (!u) return;
    u = u.trim().replace(/&amp;/g, '&').split(/\s+/)[0];
    if (/^(data:|#)/.test(u)) return;
    const a = abs(u, r.url);
    if (a && !MALO.test(a)) urls.add(a);
  };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)) for (const part of m[1].split(',')) add(part);
  for (const m of html.matchAll(/url\((["']?)([^)"']+\.(?:jpe?g|png|webp)[^)"']*)\1\)/gi)) add(m[2]);
  for (const m of html.matchAll(/["'](https?:\/\/[^"'\s]+\.(?:jpe?g|webp)(?:\?[^"'\s]*)?)["']/gi)) add(m[1]);
  const lista = [...urls].filter((u) => /\.(jpe?g|webp|png)(\?|$)/i.test(u) || /cdn|upload|image|media|assets|wp-content|files/i.test(u)).slice(0, 40);
  const out = [];
  for (const u of lista) {
    try {
      const h = await conTimeout(fetch(u, { headers: UA }), 12000);
      const tipo = h.headers.get('content-type') ?? '';
      if (!h.ok || !/^image\/(jpeg|webp|png)/.test(tipo)) continue;
      const buf = new Uint8Array(await h.arrayBuffer());
      const dims = dimensiones(buf, tipo);
      if (!dims || dims.w < 600 || dims.h < 350) continue; // demasiado chica para portada
      if (dims.w / dims.h > 4 || dims.h / dims.w > 2.2) continue; // tiras y verticales extremas
      out.push({ url: u, kb: Math.round(buf.length / 1024), tipo: tipo.split(';')[0], ...dims });
    } catch { /* siguiente */ }
  }
  out.sort((a, b) => b.w * b.h - a.w * a.h);
  return { sitio: r.url, titulo, imagenes: out.slice(0, 5) };
}

// Dimensiones desde los bytes (JPEG SOF, PNG IHDR, WebP VP8/VP8L/VP8X).
function dimensiones(b, tipo) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (/png/.test(tipo) && b.length > 24) return { w: dv.getUint32(16), h: dv.getUint32(20) };
  if (/webp/.test(tipo) && b.length > 30) {
    const tag = String.fromCharCode(...b.slice(12, 16));
    if (tag === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    if (tag === 'VP8L') { const bits = dv.getUint32(21, true); return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }; }
    if (tag === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  if (/jpeg/.test(tipo)) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      i += 2 + dv.getUint16(i + 2);
    }
  }
  return null;
}

const aplicar = process.argv.includes('--aplicar');
let n = 0;
for (const l of lugares.filter((l) => !fotos[l.id] && SITIOS[l.id])) {
  let res = null;
  const errores = [];
  for (const u of SITIOS[l.id]) {
    try {
      const c = await candidatas(u);
      if (c.imagenes.length) { res = c; break; }
      errores.push(`${u}: sin fotos grandes (${c.titulo})`);
    } catch (e) { errores.push(`${u}: ${e.message}`); }
  }
  if (!res) { console.log(`sin foto   ${l.name}\n             ${errores.join('\n             ')}`); continue; }
  console.log(`== ${l.name}  ·  ${res.sitio}  ·  "${res.titulo}"`);
  res.imagenes.forEach((im, i) => console.log(`   ${i + 1}. ${im.w}x${im.h} ${im.kb} kB  ${im.url}`));
  if (aplicar) {
    if (ELEGIDAS[l.id] === null) continue; // descartado a mano
    const elegida = ELEGIDAS[l.id] ? res.imagenes.find((im) => im.url.includes(ELEGIDAS[l.id])) ?? res.imagenes[0] : res.imagenes[0];
    fotos[l.id] = { url: elegida.url, ancho: elegida.w, alto: elegida.h, autor: `sitio oficial de ${l.name}`, licencia: '', archivo: res.sitio, titulo: `web: ${res.titulo}`, fuente: 'sitio oficial' };
    n++;
  }
}
if (aplicar) { fs.writeFileSync('data/fotos.json', JSON.stringify(fotos, null, 2)); console.log(`\n${n} fotos agregadas → data/fotos.json`); }
