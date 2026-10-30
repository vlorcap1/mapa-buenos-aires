// Busca una foto libre por lugar en Wikipedia en español (imagen principal del artículo)
// y obtiene autor y licencia desde Wikimedia Commons para mostrar el crédito.
// Uso: node scripts/fotos.mjs  →  escribe data/fotos.json  { [id]: { url, ancho, alto, autor, licencia, articulo } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lugares = JSON.parse(fs.readFileSync(path.join(root, 'data', 'lugares.json'), 'utf8'));
const salida = path.join(root, 'data', 'fotos.json');
const previas = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, 'utf8')) : {};

// Títulos exactos de artículo cuando la búsqueda por nombre es ambigua. `null` = no buscar.
const ARTICULOS = {
  'la-bombonera': 'Estadio Alberto J. Armando',
  'estadio-monumental': 'Estadio Monumental (Buenos Aires)',
  'basilica-del-pilar': 'Basílica de Nuestra Señora del Pilar (Buenos Aires)',
  'torre-monumental': 'Torre Monumental',
  'fragata-sarmiento': 'ARA Presidente Sarmiento',
  'monumento-a-los-espanoles': 'Monumento a la Carta Magna y las Cuatro Regiones Argentinas',
  'palacio-paz': 'Palacio Paz',
  'galeria-guemes': 'Galería Güemes',
  'mirador-de-galeria-guemes': 'Galería Güemes',
  'confiteria-ideal': 'Confitería Ideal',
  'clase-de-tango-en-confiteria-ideal': 'Confitería Ideal',
  'pasaje-lanin': 'Pasaje Lanín',
  'barrancas-de-belgrano': 'Barrancas de Belgrano',
  'plaza-dorrego-y-feria-de-san-telmo': 'Plaza Dorrego',
  'palermo-soho': 'Palermo Soho',
  'barrio-chino': 'Barrio Chino (Buenos Aires)',
  'puerto-madero': 'Puerto Madero',
  'villa-crespo': 'Villa Crespo (Buenos Aires)',
  'cafe-tortoni': 'Café Tortoni',
  'las-violetas': 'Confitería Las Violetas',
  'la-biela': 'La Biela',
  'london-city': 'London City (café)',
  'el-gato-negro': 'El Gato Negro (Buenos Aires)',
  'heladeria-cadore': null,
  rapanui: null,
  'cafe-rivas': null,
  lattente: null,
  'don-julio': 'Don Julio (restaurante)',
  'la-cabrera': null,
  'el-preferido-de-palermo': null,
  'pizzeria-guerrin': 'Güerrín',
  'el-cuartito': 'El Cuartito',
  'la-brigada': null,
  'cafe-san-juan': null,
  'parrilla-pena': null,
  'el-obrero': 'El Obrero (restaurante)',
  chui: null,
  mishiguene: null,
  sacro: null,
  'pizzeria-banchero': 'Banchero (pizzería)',
  'la-mezzetta': 'La Mezzetta',
  'siga-la-vaca': null,
  'pizzeria-angelin': 'Pizzería Angelín',
  'los-infernales-de-guemes': null,
  'floreria-atlantico': 'Florería Atlántico',
  'los-galgos': 'Los Galgos (bar)',
  'presidente-bar': null,
  'tres-monos': null,
  'cafe-san-bernardo': 'Café San Bernardo',
  boticario: null,
  'verne-club': null,
  'bar-britanico': 'Bar Británico',
  'la-poesia': null,
  'bar-sur': 'Bar Sur',
  uptown: null,
  'cafe-paulin': null,
  'centro-cultural-kirchner': 'Centro Cultural Kirchner',
  'teatro-san-martin': 'Teatro General San Martín',
  'ciudad-cultural-konex': 'Ciudad Cultural Konex',
  'la-bomba-de-tiempo': 'La Bomba de Tiempo',
  'biblioteca-nacional': 'Biblioteca Nacional Mariano Moreno',
  'milonga-la-catedral': null,
  'teatro-gran-rex': 'Teatro Gran Rex',
  malba: 'Museo de Arte Latinoamericano de Buenos Aires',
  'museo-de-arte-decorativo': 'Museo Nacional de Arte Decorativo',
  'museo-del-bicentenario': 'Museo Casa Rosada',
  'museo-de-arte-moderno': 'Museo de Arte Moderno de Buenos Aires',
  'museo-quinquela-martin': 'Museo de Bellas Artes de La Boca Benito Quinquela Martín',
  'museo-larreta': 'Museo de Arte Español Enrique Larreta',
  'museo-fernandez-blanco': 'Museo de Arte Hispanoamericano Isaac Fernández Blanco',
  'bosques-de-palermo': 'Parque Tres de Febrero',
  'paseo-en-bote-en-el-rosedal': 'Rosedal de Palermo',
  'jardin-japones': 'Jardín Japonés de Buenos Aires',
  'jardin-botanico': 'Jardín Botánico de Buenos Aires',
  'reserva-ecologica': 'Reserva Ecológica Costanera Sur',
  'paseo-en-bici-por-puerto-madero': 'Reserva Ecológica Costanera Sur',
  'plaza-san-martin': 'Plaza San Martín (Buenos Aires)',
  'parque-centenario': 'Parque Centenario',
  ecoparque: 'Ecoparque de Buenos Aires',
  'plaza-francia': 'Plaza Francia (Buenos Aires)',
  'parque-las-heras': 'Parque Las Heras',
  'el-ateneo-grand-splendid': 'El Ateneo Grand Splendid',
  'feria-de-mataderos': 'Feria de Mataderos',
  'libros-del-pasaje': null,
  'patio-bullrich': 'Patio Bullrich',
  'distrito-arcos': 'Distrito Arcos',
  'mercado-de-abasto': 'Abasto de Buenos Aires',
  'free-walking-tour-del-centro': 'Plaza de Mayo',
  'visita-guiada-al-teatro-colon': 'Teatro Colón',
  'mirador-del-palacio-barolo': 'Palacio Barolo',
  'excursion-al-delta-del-tigre': 'Delta del Paraná',
  'museo-historico-nacional': 'Museo Histórico Nacional (Argentina)',
  'congreso-de-la-nacion': 'Palacio del Congreso de la Nación Argentina',
  'catedral-metropolitana': 'Catedral Metropolitana de Buenos Aires',
  cabildo: 'Cabildo de Buenos Aires',
  'manzana-de-las-luces': 'Manzana de las Luces',
  'puente-de-la-mujer': 'Puente de la Mujer',
  'floralis-generica': 'Floralis Genérica',
  'cementerio-de-la-recoleta': 'Cementerio de la Recoleta',
  'planetario-galileo-galilei': 'Planetario Galileo Galilei',
  'mercado-de-san-telmo': 'Mercado de San Telmo',
  'usina-del-arte': 'Usina del Arte',
  'fundacion-proa': 'Fundación Proa',
  'museo-evita': 'Museo Evita',
  'museo-xul-solar': 'Museo Xul Solar',
  'centro-cultural-recoleta': 'Centro Cultural Recoleta',
  'museo-nacional-de-bellas-artes': 'Museo Nacional de Bellas Artes (Argentina)',
  'parque-lezama': 'Parque Lezama',
  'galerias-pacifico': 'Galerías Pacífico',
  'el-nino-gordo': null,
  napoles: null,
  microteatro: null,
  'teatro-opera': 'Teatro Ópera (Buenos Aires)',
  'teatro-nacional': 'Teatro Nacional (Buenos Aires)',
  'teatro-broadway': 'Teatro Broadway (Buenos Aires)',
  'teatro-lola-membrives': 'Teatro Lola Membrives',
  multiteatro: 'Multiteatro',
  'teatro-metropolitan': 'Teatro Metropolitan (Buenos Aires)',
  'teatro-apolo': 'Teatro Apolo (Buenos Aires)',
  'teatro-politeama': 'Teatro Politeama (Buenos Aires)',
  'teatro-astral': 'Teatro Astral',
  'paseo-la-plaza': 'Paseo La Plaza',
  'teatro-maipo': 'Teatro Maipo',
};

// Búsqueda personalizada en Commons cuando la imagen del artículo es un logo o la búsqueda por nombre falla.
const BUSQUEDAS = {
  cabildo: 'Cabildo de Buenos Aires Plaza de Mayo fachada',
  'manzana-de-las-luces': 'Manzana de las Luces Buenos Aires',
  'museo-de-arte-decorativo': 'Palacio Errázuriz Buenos Aires',
  'la-brigada': 'La Brigada parrilla San Telmo',
  'pizzeria-banchero': 'Pizzería Banchero Almirante Brown',
  'floreria-atlantico': 'Florería Atlántico Arroyo Retiro',
  'villa-crespo': 'Villa Crespo Avenida Corrientes Buenos Aires',
  'catedral-metropolitana': 'Catedral Metropolitana de Buenos Aires fachada',
  'teatro-nacional': 'Teatro Nacional Avenida Corrientes Buenos Aires',
};
// Palabras del nombre que deben aparecer en el título del archivo para aceptarlo (evita fotos de otra cosa).
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PALABRAS_CLAVE = {
  cabildo: ['cabildo'], 'manzana-de-las-luces': ['manzana'], 'museo-de-arte-decorativo': ['errazuriz', 'decorativo'],
  'la-brigada': ['brigada'], 'pizzeria-banchero': ['banchero'], 'floreria-atlantico': ['floreria', 'atlantico'],
  'villa-crespo': ['villa crespo', 'crespo'], 'catedral-metropolitana': ['catedral'],
  'teatro-nacional': ['teatro nacional'], napoles: ['napoles'], 'el-nino-gordo': ['nino gordo'],
};
const esRelevante = (lugar, tituloArchivo) => {
  const t = normalizar(tituloArchivo);
  const claves = PALABRAS_CLAVE[lugar.id] ?? normalizar(lugar.name).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  return claves.length === 0 || claves.some((w) => t.includes(w));
};
// Archivos de Commons elegidos a mano (encontrados en categorías; la búsqueda por texto no los devolvía).
const ARCHIVOS_FIJOS = {
  'la-cabrera': 'Parilla La Cabrera.jpg',
  'la-mezzetta': 'LaMezzetta marzo2016.JPG',
};
// Lugares para los que ninguna búsqueda da una foto correcta (nombres demasiado genéricos): mejor sin foto que con una ajena.
const SIN_BUSCAR = new Set(['sacro', 'napoles', 'la-brigada', 'presidente-bar', 'boticario', 'uptown']);
const REHACER = new Set((process.argv.find((a) => a.startsWith('--rehacer='))?.slice(10) ?? '').split(',').filter(Boolean));

const UA = { 'User-Agent': 'mapa-buenos-aires-dev/1.0 (fotos para mapa turistico; contacto via GitHub)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const limpiar = (html) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function api(host, params) {
  const u = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', origin: '*', ...params })) u.searchParams.set(k, v);
  for (let intento = 0; ; intento++) {
    const r = await fetch(u, { headers: UA });
    if (r.status === 429 && intento < 5) { await sleep(4000 * (intento + 1)); continue; } // límite de tasa: esperar y reintentar
    if (!r.ok) throw new Error(`${host} ${r.status}`);
    return r.json();
  }
}

async function datosArchivo(nombreArchivo) {
  const info = await api('commons.wikimedia.org', { action: 'query', titles: `File:${nombreArchivo}`, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '900' });
  const ii = info.query?.pages?.[0]?.imageinfo?.[0];
  if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime ?? '')) return null;
  const m = ii.extmetadata ?? {};
  return {
    url: ii.thumburl ?? ii.url,
    ancho: ii.thumbwidth ?? ii.width,
    alto: ii.thumbheight ?? ii.height,
    autor: limpiar(m.Artist?.value) || 'Autor desconocido',
    licencia: m.LicenseShortName?.value ?? 'ver Commons',
    archivo: ii.descriptionurl,
  };
}

// Plan B: buscar el archivo directamente en Commons por nombre del lugar (locales sin artículo en Wikipedia).
async function fotoEnCommons(lugar) {
  const consulta = BUSQUEDAS[lugar.id] ?? `"${lugar.name}" Buenos Aires`;
  const b = await api('commons.wikimedia.org', { action: 'query', generator: 'search', gsrsearch: consulta, gsrnamespace: '6', gsrlimit: '8', prop: 'imageinfo', iiprop: 'mime|size' });
  const archivos = (b.query?.pages ?? [])
    .filter((p) => /^image\/(jpeg|png|webp)$/.test(p.imageinfo?.[0]?.mime ?? ''))
    .filter((p) => esRelevante(lugar, p.title))
    .filter((p) => !/logo|escudo|emblem|mapa|map_|plano|bandera|flag/i.test(p.title))
    .sort((a, b) => (b.imageinfo[0].width ?? 0) - (a.imageinfo[0].width ?? 0)); // la más grande suele ser la mejor foto
  for (const p of archivos) {
    const f = await datosArchivo(p.title.replace(/^File:/, ''));
    if (f) return { ...f, titulo: `Commons: ${p.title}`, articulo: f.archivo };
  }
  return null;
}

async function imagenPrincipal(lugar) {
  if (ARCHIVOS_FIJOS[lugar.id]) {
    const f = await datosArchivo(ARCHIVOS_FIJOS[lugar.id]);
    return f ? { ...f, titulo: `Commons (fijo): ${ARCHIVOS_FIJOS[lugar.id]}`, articulo: f.archivo } : null;
  }
  const titulo = ARTICULOS[lugar.id] === undefined ? `${lugar.name} (Buenos Aires)` : ARTICULOS[lugar.id];
  if (titulo === null || BUSQUEDAS[lugar.id]) return fotoEnCommons(lugar);
  // 1) Artículo por título exacto; si no existe, búsqueda.
  let pagina;
  const porTitulo = await api('es.wikipedia.org', { action: 'query', titles: titulo, prop: 'pageimages|info', piprop: 'name', inprop: 'url', redirects: '1' });
  pagina = porTitulo.query?.pages?.find((p) => !p.missing);
  if (!pagina) {
    const b = await api('es.wikipedia.org', { action: 'query', generator: 'search', gsrsearch: `${lugar.name} Buenos Aires`, gsrlimit: '1', prop: 'pageimages|info', piprop: 'name', inprop: 'url' });
    pagina = b.query?.pages?.[0];
  }
  if (pagina?.pageimage && /logo|escudo|emblem|mapa|plano|bandera|flag/i.test(pagina.pageimage)) pagina.pageimage = undefined; // la imagen del artículo es un logo: buscar foto
  if (!pagina?.pageimage) {
    const plan = await fotoEnCommons(lugar);
    return plan ?? (pagina ? { articulo: pagina.fullurl, sinImagen: true, titulo: pagina.title } : null);
  }
  // 2) Datos del archivo en Commons (url a 900 px, autor, licencia).
  const f = await datosArchivo(pagina.pageimage);
  if (!f) return { articulo: pagina.fullurl, sinImagen: true, titulo: pagina.title };
  return { ...f, articulo: pagina.fullurl, titulo: pagina.title };
}

const fotos = {};
let ok = 0;
for (const l of lugares) {
  if (SIN_BUSCAR.has(l.id)) { console.log(`omitido    ${l.name}`); continue; }
  if (previas[l.id]?.url && !process.argv.includes('--forzar') && !REHACER.has(l.id)) { fotos[l.id] = previas[l.id]; ok++; console.log(`cache      ${l.name}`); continue; }
  try {
    const f = await imagenPrincipal(l);
    if (f?.url) { fotos[l.id] = f; ok++; console.log(`ok         ${l.name}  ←  ${f.titulo}  [${f.licencia}]`); }
    else console.log(`sin foto   ${l.name}${f?.titulo ? `  (artículo sin imagen: ${f.titulo})` : ''}`);
  } catch (e) { console.log(`error      ${l.name}: ${e.message}`); }
  await sleep(1200);
}
fs.writeFileSync(salida, JSON.stringify(fotos, null, 2));
console.log(`\n${ok}/${lugares.length} con foto → data/fotos.json`);
