// Atracciones del mapa que son parada de los buses turísticos hop-on hop-off, según la lista oficial de
// Buenos Aires Travel (turismo.buenosaires.gob.ar/es/article/bus-turistico, consultada en noviembre de 2026).
// La fuente nombra atracciones, no paradas con dirección: se marcan los lugares del mapa que corresponden a cada una.
export interface CircuitoTuristico {
  id: 'amarillo' | 'rojo';
  nombre: string;
  operador: string;
  color: string;
  texto: string;
  lugarId: string; // punto de partida, cargado como lugar en el mapa
}

export const CIRCUITOS: CircuitoTuristico[] = [
  { id: 'amarillo', nombre: 'Bus turístico amarillo', operador: 'Buenos Aires Bus', color: '#face27', texto: '#14213d', lugarId: 'bus-turistico-amarillo' },
  { id: 'rojo', nombre: 'Bus turístico rojo', operador: 'Buenos Aires City Bus', color: '#d62828', texto: '#ffffff', lugarId: 'bus-turistico-rojo' },
];

const AMBOS = ['congreso-de-la-nacion', 'confiteria-del-molino', 'plaza-dorrego-y-feria-de-san-telmo', 'la-bombonera', 'caminito', 'museo-quinquela-martin', 'reserva-ecologica', 'puerto-madero', 'fragata-sarmiento', 'puente-de-la-mujer', 'galerias-pacifico', 'plaza-san-martin', 'malba', 'planetario-galileo-galilei', 'monumento-a-los-espanoles', 'museo-nacional-de-bellas-artes', 'teatro-colon', 'visita-guiada-al-teatro-colon'];
const SOLO_AMARILLO = ['cementerio-de-la-recoleta', 'plaza-francia', 'centro-cultural-recoleta', 'plaza-de-mayo', 'casa-rosada', 'cabildo', 'catedral-metropolitana', 'cafe-tortoni', 'palacio-barolo', 'parque-lezama', 'obelisco', 'ecoparque', 'palermo-soho', 'villa-crespo', 'distrito-arcos', 'bosques-de-palermo', 'paseo-en-bote-en-el-rosedal', 'bus-turistico-amarillo'];
const SOLO_ROJO = ['usina-del-arte', 'el-ateneo-grand-splendid', 'torre-monumental', 'floralis-generica', 'parque-de-la-memoria', 'estadio-monumental', 'barrio-chino', 'campo-argentino-de-polo', 'museo-de-arte-decorativo', 'bus-turistico-rojo'];

const PARADAS = new Map<string, CircuitoTuristico['id'][]>();
for (const id of AMBOS) PARADAS.set(id, ['amarillo', 'rojo']);
for (const id of SOLO_AMARILLO) PARADAS.set(id, ['amarillo']);
for (const id of SOLO_ROJO) PARADAS.set(id, ['rojo']);

/** Circuitos de bus turístico que paran en este lugar. */
export function circuitosEn(lugarId: string): CircuitoTuristico[] {
  const ids = PARADAS.get(lugarId) ?? [];
  return CIRCUITOS.filter((c) => ids.includes(c.id));
}
