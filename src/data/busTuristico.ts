import datos from '../../data/bus-turistico.json';
import { distanciaKm } from '../lib/geo';

// Buses turísticos hop-on hop-off (data/bus-turistico.json):
// - amarillo (Buenos Aires Bus): paradas y trazado publicados por el operador en buenosairesbus.com/seguimiento.
// - rojo (Buenos Aires City Bus): el operador solo publica un mapa en imagen; el trazado es una transcripción de
//   ese mapa unida por calles (scripts/bus-rojo.mjs) y las paradas están sobre ese trazado: todo aproximado.
export interface CircuitoTuristico {
  id: 'amarillo' | 'rojo';
  nombre: string;
  operador: string;
  color: string;
  texto: string;
  lugarId: string; // punto de partida, cargado como lugar en el mapa
}

export interface ParadaTuristica { n: number; nombre: string; lat: number; lng: number }

export const CIRCUITOS: CircuitoTuristico[] = [
  { id: 'amarillo', nombre: 'Bus turístico amarillo', operador: 'Buenos Aires Bus', color: '#f2b705', texto: '#14213d', lugarId: 'bus-turistico-amarillo' },
  { id: 'rojo', nombre: 'Bus turístico rojo', operador: 'Buenos Aires City Bus', color: '#d62828', texto: '#ffffff', lugarId: 'bus-turistico-rojo' },
];

const DATOS = datos.circuitos as { id: CircuitoTuristico['id']; aproximado?: boolean; paradas: ParadaTuristica[]; trazado?: [number, number][] }[];

/** Trazados y paradas de ambos circuitos, como GeoJSON para la capa del mapa. */
export const BUS_TURISTICO_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: DATOS.flatMap((c) => {
    const color = CIRCUITOS.find((x) => x.id === c.id)!.color;
    const paradas: GeoJSON.Feature[] = c.paradas.map((p) => ({
      type: 'Feature',
      properties: { tipo: 'parada', circuito: c.id, color, n: String(p.n), nombre: p.nombre },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    }));
    const trazado: GeoJSON.Feature[] = c.trazado ? [{ type: 'Feature', properties: { tipo: 'trazado', circuito: c.id, color }, geometry: { type: 'LineString', coordinates: c.trazado } }] : [];
    return [...trazado, ...paradas];
  }),
};

const RADIO_KM = 0.35;

/** Para cada circuito, su parada más cercana al lugar si está a menos de 350 m. */
export function paradasTuristicasCerca(lat: number, lng: number): { circuito: CircuitoTuristico; parada: ParadaTuristica; distKm: number; aproximada: boolean }[] {
  return DATOS.flatMap((c) => {
    const [mejor] = c.paradas.map((p) => ({ p, d: distanciaKm(lat, lng, p.lat, p.lng) })).sort((a, b) => a.d - b.d);
    if (!mejor || mejor.d > RADIO_KM) return [];
    return [{ circuito: CIRCUITOS.find((x) => x.id === c.id)!, parada: mejor.p, distKm: mejor.d, aproximada: !!c.aproximado }];
  });
}
