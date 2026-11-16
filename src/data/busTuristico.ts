import datos from '../../data/bus-turistico.json';
import { distanciaKm } from '../lib/geo';

// Buses turísticos hop-on hop-off (data/bus-turistico.json):
// - amarillo (Buenos Aires Bus): paradas y trazado publicados por el operador en buenosairesbus.com/seguimiento.
// - rojo (Buenos Aires City Bus): el operador solo publica un mapa en imagen; el trazado es una transcripción de
//   ese mapa unida por calles (scripts/bus-rojo.mjs) y las paradas están sobre ese trazado: todo aproximado.
export interface CircuitoTuristico {
  id: 'amarillo' | 'rojo';
  nombre: string;
  operador: string; // nombre comercial
  empresas: string; // empresas de la UTE concesionaria (vigente hasta diciembre de 2026)
  color: string;
  texto: string;
  lugarId: string; // punto de partida, cargado como lugar en el mapa
  web: string; // compra online
  aBordo: boolean; // se puede comprar arriba del bus
  venta: { parada?: string; donde: string; nombre?: string }[]; // puntos de venta según el operador (noviembre de 2026)
}

/** Circuito cuyo punto de partida es este lugar (las fichas de los buses turísticos). */
export const circuitoDeLugar = (lugarId: string) => CIRCUITOS.find((c) => c.lugarId === lugarId);

export interface ParadaTuristica { n: number; nombre: string; lat: number; lng: number }

export const CIRCUITOS: CircuitoTuristico[] = [
  { id: 'amarillo', nombre: 'Bus turístico amarillo', operador: 'Buenos Aires Bus', empresas: 'UTE de Rotamund, Empresa General Urquiza y Empresa de Transportes Sierras de Córdoba', color: '#f2b705', texto: '#14213d', lugarId: 'bus-turistico-amarillo',
    web: 'https://www.buenosairesbus.com/',
    aBordo: true,
    venta: [
      { parada: '00', donde: 'Av. Manuel Quintana 591, Recoleta' },
      { parada: '14', donde: 'Av. Córdoba 466' },
      { donde: 'Florida y Diagonal Norte' },
    ],
  },
  { id: 'rojo', nombre: 'Bus turístico rojo', operador: 'Buenos Aires City Bus (Gray Line)', empresas: 'UTE de División Industrial, AV&MV y Condominios', color: '#d62828', texto: '#ffffff', lugarId: 'bus-turistico-rojo',
    web: 'https://buenosairescitybus.com/',
    aBordo: false,
    venta: [
      { parada: '0', donde: 'Roque Sáenz Peña 722 y 749, y Cerrito 458' },
      { parada: '1', donde: 'Rivadavia 1539' },
      { parada: '6', donde: 'Magallanes 874', nombre: 'Planet Baires' },
      { parada: '10', donde: 'Córdoba 787' },
      { parada: '12', donde: 'Av. Santa Fe 808' },
      { parada: '12', donde: 'Florida y Marcelo T. de Alvear', nombre: 'Centro de Informes' },
      { parada: '17', donde: 'Aeroparque Jorge Newbery, arribos' },
      { parada: '20', donde: 'Juramento 1701', nombre: 'Gran Barrio Chino' },
    ],
  },
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
