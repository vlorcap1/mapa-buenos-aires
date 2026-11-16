import datos from '../../data/transporte.json';
import { distanciaKm } from '../lib/geo';

// data/transporte.json lo genera `node scripts/transporte.mjs` (líneas y estaciones de Subte, Premetro y trenes desde OpenStreetMap).
export type TipoTransporte = 'subte' | 'premetro' | 'tren';

export interface Estacion {
  nombre: string;
  tipo: TipoTransporte;
  linea: string; // letra de subte, "P" o nombre del tren (Mitre, Roca…)
  color: string;
  lat: number;
  lng: number;
}

export interface EstacionCercana {
  nombre: string;
  lineas: { tipo: TipoTransporte; linea: string; color: string }[];
  distKm: number;
}

export const LINEAS_TRANSPORTE = datos.lineas as GeoJSON.FeatureCollection<GeoJSON.MultiLineString, { tipo: TipoTransporte; ref: string; nombre: string; color: string }>;
export const ESTACIONES = datos.estaciones as Estacion[];

/** Estaciones como puntos GeoJSON para la capa del mapa. */
export const ESTACIONES_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: 'FeatureCollection',
  features: ESTACIONES.map((e) => ({
    type: 'Feature',
    properties: { nombre: e.nombre, tipo: e.tipo, linea: e.linea, color: e.color },
    geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
  })),
};

/**
 * Leyenda de la capa de transporte; cada ficha prende o apaga su línea. `clave` es lo que se guarda como oculto:
 * letra de subte, "P" (Premetro), "Tren" (todos los trenes) o el circuito del bus turístico.
 */
export const LEYENDA: { clave: string; etiqueta: string; color: string; titulo: string }[] = [
  ...['A', 'B', 'C', 'D', 'E', 'H'].map((l) => ({ clave: l, etiqueta: l, color: ESTACIONES.find((e) => e.linea === l)?.color ?? '#888', titulo: `Línea ${l}` })),
  { clave: 'P', etiqueta: 'P', color: ESTACIONES.find((e) => e.tipo === 'premetro')?.color ?? '#F38733', titulo: 'Premetro' },
  { clave: 'Tren', etiqueta: 'Tren', color: ESTACIONES.find((e) => e.tipo === 'tren')?.color ?? '#5b6b80', titulo: 'Trenes' },
  { clave: 'amarillo', etiqueta: 'Tur', color: '#f2b705', titulo: 'Bus turístico amarillo' },
  { clave: 'rojo', etiqueta: 'Tur', color: '#d62828', titulo: 'Bus turístico rojo (recorrido aproximado)' },
];

const PRIORIDAD: Record<TipoTransporte, number> = { subte: 0, premetro: 1, tren: 2 };

/**
 * Estaciones más cercanas a un punto, agrupando las líneas que comparten estación (p. ej. Retiro: C, E y trenes).
 * Devuelve hasta `max` estaciones a menos de `radioKm`; si no hay ninguna, la más cercana de todas.
 */
export function estacionesCercanas(lat: number, lng: number, max = 3, radioKm = 1.2): EstacionCercana[] {
  const conDist = ESTACIONES.map((e) => ({ e, d: distanciaKm(lat, lng, e.lat, e.lng) })).sort((a, b) => a.d - b.d);
  // Sin ninguna estación dentro del radio, se amplía hasta la más cercana.
  const limite = Math.max(radioKm, conDist[0]?.d ?? 0);
  const grupos: EstacionCercana[] = [];
  for (const { e, d } of conDist) {
    if (d > limite + 0.3) break;
    // Misma estación si comparte nombre y está a menos de 300 m (combinaciones con el mismo nombre).
    const g = grupos.find((x) => x.nombre === e.nombre && Math.abs(x.distKm - d) < 0.3);
    if (g) {
      if (!g.lineas.some((l) => l.linea === e.linea)) g.lineas.push({ tipo: e.tipo, linea: e.linea, color: e.color });
    } else if (d <= limite) {
      grupos.push({ nombre: e.nombre, lineas: [{ tipo: e.tipo, linea: e.linea, color: e.color }], distKm: d });
    }
  }
  for (const g of grupos) g.lineas.sort((a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo] || a.linea.localeCompare(b.linea));
  return grupos.slice(0, max);
}
