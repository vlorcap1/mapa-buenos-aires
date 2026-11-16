/**
 * Colectivos directos entre dos puntos, sin conexión. Los recorridos (data/colectivos.json, generado por
 * scripts/colectivos.mjs) están en orden de viaje, así que un recorrido sirve si pasa cerca del origen y,
 * más adelante, cerca del destino. No hay horarios: los tiempos son estimaciones.
 */
export interface Viaje {
  linea: string;
  ramal: string; // "Desde → Hasta" del recorrido
  subida: [number, number]; // [lng, lat] del punto del recorrido más cercano al origen
  bajada: [number, number];
  caminarHastaM: number; // del origen a la subida
  caminarDesdeM: number; // de la bajada al destino
  enColectivoM: number; // distancia recorrida arriba del colectivo
  minutos: number; // estimación total
  tramo: [number, number][]; // recorrido entre subida y bajada, para dibujarlo
}

interface Ruta {
  linea: string;
  ramal: string;
  partes: { pts: [number, number][]; acum: number[] }[]; // acum: metros desde el inicio del recorrido hasta cada vértice
}

const CAMINAR_M_MIN = 75; // ~4,5 km/h
const COLECTIVO_M_MIN = 230; // ~14 km/h en la Ciudad, con paradas y semáforos
const ESPERA_MIN = 8; // espera promedio en la parada
const MIN_VIAJE_M = 400; // menos que esto, conviene caminar

// Metros en un plano local (equirrectangular): suficiente a escala de ciudad.
const M_LAT = 111_320;
const M_LNG = 111_320 * Math.cos((-34.6 * Math.PI) / 180);
const dist = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * M_LNG, (a[1] - b[1]) * M_LAT);

function decodificar(s: string): [number, number][] {
  const pts: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  const num = () => {
    let r = 0, sh = 0, b;
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < s.length) { lat += num(); lng += num(); pts.push([lng / 1e5, lat / 1e5]); }
  return pts;
}

let rutasPromesa: Promise<Ruta[]> | null = null;
/** Carga los recorridos la primera vez que se necesitan (archivo aparte, guardado también para uso sin conexión). */
export function cargarRutas(): Promise<Ruta[]> {
  rutasPromesa ??= import('../../data/colectivos.json').then(({ default: datos }) =>
    (datos.rutas as { l: string; d: string; p: string | string[] }[]).map((r) => {
      let total = 0;
      const partes = (Array.isArray(r.p) ? r.p : [r.p]).map((cod, k, todas) => {
        const pts = decodificar(cod);
        // Entre partes (hueco en los datos) se suma la distancia en línea recta, para mantener el orden.
        if (k > 0) {
          const ant = decodificar(todas[k - 1]);
          total += dist(ant[ant.length - 1], pts[0]);
        }
        const acum = [total];
        for (let j = 1; j < pts.length; j++) acum.push((total += dist(pts[j - 1], pts[j])));
        return { pts, acum };
      });
      return { linea: r.l, ramal: r.d, partes };
    }),
  );
  return rutasPromesa;
}

interface Proyeccion { d: number; a: number; p: [number, number]; parte: number; seg: number }
// Punto del recorrido más cercano a `q`: distancia, posición a lo largo del recorrido y el punto.
function proyectar(r: Ruta, q: [number, number]): Proyeccion {
  let mejor: Proyeccion = { d: Infinity, a: 0, p: q, parte: 0, seg: 0 };
  r.partes.forEach(({ pts, acum }, k) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const ax = (b[0] - a[0]) * M_LNG, ay = (b[1] - a[1]) * M_LAT;
      const qx = (q[0] - a[0]) * M_LNG, qy = (q[1] - a[1]) * M_LAT;
      const L2 = ax * ax + ay * ay;
      const t = L2 ? Math.max(0, Math.min(1, (qx * ax + qy * ay) / L2)) : 0;
      const d = Math.hypot(qx - t * ax, qy - t * ay);
      if (d < mejor.d) mejor = { d, a: acum[i] + t * Math.sqrt(L2), p: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], parte: k, seg: i };
    }
  });
  return mejor;
}

function recortarTramo(r: Ruta, o: Proyeccion, d: Proyeccion): [number, number][] {
  const out: [number, number][] = [o.p];
  for (let k = o.parte; k <= d.parte; k++) {
    const { pts } = r.partes[k];
    const desde = k === o.parte ? o.seg + 1 : 0;
    const hasta = k === d.parte ? d.seg : pts.length - 1;
    for (let i = desde; i <= hasta; i++) out.push(pts[i]);
  }
  out.push(d.p);
  return out;
}

/**
 * Colectivos que llevan del origen al destino sin combinar, el mejor ramal de cada línea, ordenados por tiempo.
 * `maxCaminarM`: lo máximo que se camina hasta la parada y desde la bajada.
 */
export async function colectivosDirectos(origen: { lat: number; lng: number }, destino: { lat: number; lng: number }, maxCaminarM = 500, max = 6): Promise<Viaje[]> {
  const rutas = await cargarRutas();
  const o: [number, number] = [origen.lng, origen.lat];
  const de: [number, number] = [destino.lng, destino.lat];
  const porLinea = new Map<string, Viaje>();
  for (const r of rutas) {
    const po = proyectar(r, o);
    if (po.d > maxCaminarM) continue;
    const pd = proyectar(r, de);
    if (pd.d > maxCaminarM) continue;
    const enColectivo = pd.a - po.a;
    if (enColectivo < MIN_VIAJE_M) continue; // va en el otro sentido, o es tan corto que conviene caminar
    // Un recorrido que da mucha más vuelta que la distancia directa no conviene (p. ej. ida y vuelta del mismo ramal).
    if (enColectivo > 3.5 * dist(o, de) + 1500) continue;
    const minutos = Math.round((po.d + pd.d) / CAMINAR_M_MIN + ESPERA_MIN + enColectivo / COLECTIVO_M_MIN);
    const prev = porLinea.get(r.linea);
    if (prev && prev.minutos <= minutos) continue;
    porLinea.set(r.linea, {
      linea: r.linea, ramal: r.ramal, subida: po.p, bajada: pd.p,
      caminarHastaM: Math.round(po.d), caminarDesdeM: Math.round(pd.d), enColectivoM: Math.round(enColectivo),
      minutos, tramo: recortarTramo(r, po, pd),
    });
  }
  return [...porLinea.values()].sort((a, b) => a.minutos - b.minutos).slice(0, max);
}

/** Líneas que pasan a menos de `radioM` de un punto (para mostrar sin GPS). */
export async function lineasCerca(punto: { lat: number; lng: number }, radioM = 300): Promise<string[]> {
  const rutas = await cargarRutas();
  const q: [number, number] = [punto.lng, punto.lat];
  const lineas = new Set<string>();
  for (const r of rutas) if (!lineas.has(r.linea) && proyectar(r, q).d <= radioM) lineas.add(r.linea);
  return [...lineas].sort((a, b) => Number(a) - Number(b));
}
