import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';

/**
 * Mosaicos vectoriales empaquetados en el sitio (public/mapa/tiles.bin + tiles.idx.json), generados por
 * scripts/extraer-mapa.mjs. Se sirven a MapLibre con un protocolo propio `ba://z/x/y` que lee el trozo
 * correspondiente del archivo con una petición Range y lo descomprime. Como todo está dentro del sitio,
 * el service worker puede guardarlo y el mapa funciona sin conexión.
 */
interface Indice {
  build: string;
  compresion: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  atribucion: string;
  tiles: Record<string, [number, number]>;
}

const BASE = new URL(import.meta.env.BASE_URL, document.baseURI).href; // absoluta: MapLibre la necesita para sprites y glifos
const URL_INDICE = `${BASE}mapa/tiles.idx.json`;
const URL_BIN = `${BASE}mapa/tiles.bin`;

let indicePromesa: Promise<Indice> | null = null;
export function cargarIndice(): Promise<Indice> {
  indicePromesa ??= fetch(URL_INDICE).then((r) => {
    if (!r.ok) throw new Error(`índice de mapa: HTTP ${r.status}`);
    return r.json() as Promise<Indice>;
  });
  return indicePromesa;
}

async function descomprimirGzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([buf]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer();
}

let protocoloRegistrado = false;
export function registrarProtocolo() {
  if (protocoloRegistrado) return;
  protocoloRegistrado = true;
  maplibregl.addProtocol('ba', async (params, abort) => {
    const m = /^ba:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (!m) throw new Error(`url de mosaico inválida: ${params.url}`);
    const indice = await cargarIndice();
    const entrada = indice.tiles[`${m[1]}/${m[2]}/${m[3]}`];
    if (!entrada) return { data: new Uint8Array(0) }; // fuera de lo empaquetado: mosaico vacío
    const [offset, largo] = entrada;
    const r = await fetch(URL_BIN, { headers: { Range: `bytes=${offset}-${offset + largo - 1}` }, signal: abort.signal });
    if (!r.ok && r.status !== 206) throw new Error(`mosaico ${params.url}: HTTP ${r.status}`);
    let buf = await r.arrayBuffer();
    if (r.status === 200 && buf.byteLength !== largo) buf = buf.slice(offset, offset + largo); // servidor sin soporte Range
    return { data: indice.compresion === 'gzip' ? await descomprimirGzip(buf) : buf };
  });
}

export async function crearEstilo(): Promise<StyleSpecification> {
  const indice = await cargarIndice();
  return {
    version: 8,
    glyphs: `${BASE}mapa/fonts/{fontstack}/{range}.pbf`,
    sprite: `${BASE}mapa/sprites/light`,
    sources: {
      protomaps: {
        type: 'vector',
        tiles: ['ba://{z}/{x}/{y}'],
        minzoom: indice.minzoom,
        maxzoom: indice.maxzoom,
        bounds: indice.bounds,
        attribution: indice.atribucion || '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'es' }),
  };
}
