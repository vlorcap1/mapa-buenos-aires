// Extrae los mosaicos vectoriales de Buenos Aires del build planetario de Protomaps y los guarda en el proyecto
// como un paquete propio: public/mapa/tiles.bin (mosaicos gzip concatenados) + public/mapa/tiles.idx.json (índice z/x/y → [offset, largo]).
// La app los lee con un protocolo propio de MapLibre, con peticiones Range, así que el archivo puede ser grande.
// Uso: node scripts/extraer-mapa.mjs [fecha-build]   (por defecto el último build conocido)
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { PMTiles, FetchSource } from 'pmtiles';

const build = process.argv[2] ?? '20261029';
const URL_BUILD = `https://build.protomaps.com/${build}.pmtiles`;

// Zonas: toda el área metropolitana con poco detalle (para que el mapa no quede vacío al alejarse)
// y la Ciudad de Buenos Aires con detalle de calles hasta el zoom máximo del build (15; MapLibre sobre-amplía hasta 19).
const ZONAS = [
  { nombre: 'AMBA', bbox: [-58.95, -34.95, -58.2, -34.35], zooms: [6, 12] },
  { nombre: 'CABA', bbox: [-58.54, -34.72, -58.33, -34.52], zooms: [13, 15] },
];

const aRad = (g) => (g * Math.PI) / 180;
function tileX(lon, z) { return Math.floor(((lon + 180) / 360) * 2 ** z); }
function tileY(lat, z) { return Math.floor(((1 - Math.log(Math.tan(aRad(lat)) + 1 / Math.cos(aRad(lat))) / Math.PI) / 2) * 2 ** z); }

// La librería descomprime directorios y mosaicos; los mosaicos se vuelven a comprimir (gzip) al guardarlos y la app los descomprime.
const pm = new PMTiles(new FetchSource(URL_BUILD));
const header = await pm.getHeader();
const meta = await pm.getMetadata();
console.log(`build ${build}: zoom ${header.minZoom}-${header.maxZoom}, compresión ${header.tileCompression}, tipo ${header.tileType}`);

const pedidos = [];
for (const z of ZONAS) {
  for (let zoom = z.zooms[0]; zoom <= Math.min(z.zooms[1], header.maxZoom); zoom++) {
    const x0 = tileX(z.bbox[0], zoom), x1 = tileX(z.bbox[2], zoom);
    const y0 = tileY(z.bbox[3], zoom), y1 = tileY(z.bbox[1], zoom);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) pedidos.push([zoom, x, y]);
  }
}
const unicos = [...new Map(pedidos.map((t) => [t.join('/'), t])).values()];
console.log(`${unicos.length} mosaicos a descargar`);

fs.mkdirSync('public/mapa', { recursive: true });
const salida = fs.openSync('public/mapa/tiles.bin', 'w');
const indice = {};
let offset = 0, hechos = 0, vacios = 0, errores = 0;
const CONCURRENCIA = 8;
let i = 0;
async function trabajador() {
  while (i < unicos.length) {
    const [z, x, y] = unicos[i++];
    for (let intento = 0; ; intento++) {
      try {
        const r = await pm.getZxy(z, x, y);
        if (r?.data?.byteLength) {
          const buf = gzipSync(Buffer.from(r.data), { level: 9 });
          // escritura secuencial protegida por el bucle de eventos: fs.writeSync es atómico por llamada
          fs.writeSync(salida, buf, 0, buf.length, offset);
          indice[`${z}/${x}/${y}`] = [offset, buf.length];
          offset += buf.length;
        } else vacios++;
        break;
      } catch (e) {
        if (intento < 4) { await new Promise((s) => setTimeout(s, 1500 * (intento + 1))); continue; }
        errores++; console.log(`error ${z}/${x}/${y}: ${e.message}`); break;
      }
    }
    hechos++;
    if (hechos % 100 === 0) console.log(`${hechos}/${unicos.length}  ${(offset / 1e6).toFixed(1)} MB`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
fs.closeSync(salida);
fs.writeFileSync('public/mapa/tiles.idx.json', JSON.stringify({
  build, compresion: 'gzip', minzoom: ZONAS[0].zooms[0], maxzoom: Math.min(15, header.maxZoom),
  bounds: ZONAS[0].bbox, atribucion: meta.attribution ?? '', tiles: indice,
}));
console.log(`listo: ${Object.keys(indice).length} mosaicos, ${(offset / 1e6).toFixed(1)} MB, ${vacios} vacíos, ${errores} errores → public/mapa/tiles.bin`);
