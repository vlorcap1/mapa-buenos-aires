import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CATEGORIA_POR_ID, trazosSvg, type Categoria } from '../data/categorias';
import { CENTRO_BUENOS_AIRES } from '../data/lugares';
import { crearEstilo, registrarProtocolo } from '../lib/mapaOffline';
import { ESTACIONES_GEOJSON, LINEAS_TRANSPORTE } from '../data/transporte';
import { BUS_TURISTICO_GEOJSON } from '../data/busTuristico';
import type { Lugar, Posicion } from '../types';
import type { Viaje } from '../lib/colectivos';

interface Props {
  lugares: Lugar[];
  activo: Lugar | null; // pin resaltado y centrado (seleccionado en detalle o resaltado desde el carrusel)
  posicion: Posicion | null;
  centrarEnUsuario: number; // contador: cada incremento vuelve a centrar en el usuario
  transporte: boolean; // capa de Subte, Premetro y trenes visible
  ocultas: string[]; // líneas apagadas desde la leyenda (claves de LEYENDA)
  viaje: { viaje: Viaje; origen: [number, number]; destino: [number, number] } | null; // colectivo elegido para dibujar
  onSelect: (l: Lugar) => void;
}

const ZOOM_DETALLE = 15; // zoom al que se acerca al elegir un lugar

// Pin con el ícono de la categoría: gota del color de la categoría, disco blanco y el ícono dentro.
function svgPin(cat: Categoria, activo: boolean): string {
  const w = activo ? 42 : 32;
  const h = Math.round(w * 1.3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 39" width="${w}" height="${h}">
  <path d="M15 38c-.6 0-1.1-.3-1.4-.8C11.3 33.4 2 21.2 2 14.5 2 7.1 7.8 1 15 1s13 6.1 13 13.5c0 6.7-9.3 18.9-11.6 22.7-.3.5-.8.8-1.4.8Z" fill="${cat.color}" stroke="${activo ? '#14213d' : '#ffffff'}" stroke-width="${activo ? 2 : 1.25}" stroke-linejoin="round"/>
  <circle cx="15" cy="14.5" r="9" fill="#ffffff"/>
  <svg x="9.5" y="9" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${cat.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${trazosSvg(cat.nodo)}</svg>
</svg>`;
}

// Polígono circular de `radio` metros alrededor de un punto (para dibujar la precisión del GPS).
function circulo(lng: number, lat: number, radio: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const pts: [number, number][] = [];
  const kmLat = 111.32, kmLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([lng + ((radio / 1000) * Math.cos(a)) / kmLng, lat + ((radio / 1000) * Math.sin(a)) / kmLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } };
}

const CAPAS_TRANSPORTE = ['tr-trenes', 'tr-subte-borde', 'tr-subte', 'tr-estaciones', 'tr-nombres', 'bt-trazado-borde', 'bt-trazado', 'bt-paradas', 'bt-numeros'];

// Capa de transporte: líneas debajo de los nombres de calles del mapa base; estaciones y sus nombres encima.
function agregarCapaTransporte(m: maplibregl.Map, visible: boolean) {
  const visibility = visible ? 'visible' : 'none';
  const debajoDeEtiquetas = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  m.addSource('tr-lineas', { type: 'geojson', data: LINEAS_TRANSPORTE });
  m.addSource('tr-estaciones', { type: 'geojson', data: ESTACIONES_GEOJSON });
  const esTren = ['==', ['get', 'tipo'], 'tren'] as maplibregl.FilterSpecification;
  const noEsTren = ['!=', ['get', 'tipo'], 'tren'] as maplibregl.FilterSpecification;
  m.addLayer({
    id: 'tr-trenes', type: 'line', source: 'tr-lineas', filter: esTren,
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2.5, 17, 4], 'line-dasharray': [3, 1.5] },
  }, debajoDeEtiquetas);
  m.addLayer({
    id: 'tr-subte-borde', type: 'line', source: 'tr-lineas', filter: noEsTren,
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 6.5, 17, 11] },
  }, debajoDeEtiquetas);
  m.addLayer({
    id: 'tr-subte', type: 'line', source: 'tr-lineas', filter: noEsTren,
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 4, 17, 7] },
  }, debajoDeEtiquetas);
  // Bus turístico: trazado del amarillo (el rojo no publica recorrido) y paradas numeradas de ambos circuitos.
  m.addSource('bus-turistico', { type: 'geojson', data: BUS_TURISTICO_GEOJSON });
  const esTrazado = ['==', ['get', 'tipo'], 'trazado'] as maplibregl.FilterSpecification;
  const esParada = ['==', ['get', 'tipo'], 'parada'] as maplibregl.FilterSpecification;
  m.addLayer({
    id: 'bt-trazado-borde', type: 'line', source: 'bus-turistico', filter: esTrazado,
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#7a5b00', 'line-opacity': 0.35, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 15, 7.5] },
  }, debajoDeEtiquetas);
  m.addLayer({
    id: 'bt-trazado', type: 'line', source: 'bus-turistico', filter: esTrazado,
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 4.5], 'line-dasharray': [2, 1] },
  }, debajoDeEtiquetas);
  m.addLayer({
    id: 'bt-paradas', type: 'circle', source: 'bus-turistico', filter: esParada, minzoom: 11.5,
    layout: { visibility },
    paint: { 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 15, 9] },
  });
  m.addLayer({
    id: 'bt-numeros', type: 'symbol', source: 'bus-turistico', filter: esParada, minzoom: 13,
    layout: { visibility, 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Medium'], 'text-size': 10.5, 'text-allow-overlap': true },
    paint: { 'text-color': ['case', ['==', ['get', 'circuito'], 'amarillo'], '#14213d', '#ffffff'] },
  });
  m.addLayer({
    id: 'tr-estaciones', type: 'circle', source: 'tr-estaciones', minzoom: 11.5,
    filter: ['any', noEsTren, ['>=', ['zoom'], 13]] as maplibregl.FilterSpecification,
    layout: { visibility },
    paint: {
      'circle-color': '#ffffff',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 2.5],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 14, 4.5, 17, 7],
    },
  });
  m.addLayer({
    id: 'tr-nombres', type: 'symbol', source: 'tr-estaciones', minzoom: 13.5,
    layout: {
      visibility,
      'text-field': ['case', ['==', ['get', 'tipo'], 'tren'], ['concat', ['get', 'nombre'], ' (tren)'], ['concat', ['get', 'nombre'], ' · ', ['get', 'linea']]],
      'text-font': ['Noto Sans Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10.5, 17, 13],
      'text-anchor': 'top',
      'text-offset': [0, 0.7],
      'text-optional': true,
      'text-max-width': 9,
    },
    paint: { 'text-color': '#14213d', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
  });
}

const COLOR_COLECTIVO = '#c2185b'; // magenta: no se confunde con ninguna línea de subte
const VACIO: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Viaje en colectivo: caminata punteada hasta la parada, tramo en colectivo y caminata desde la bajada.
function agregarCapaViaje(m: maplibregl.Map) {
  m.addSource('viaje', { type: 'geojson', data: VACIO });
  m.addLayer({ id: 'viaje-caminar', type: 'line', source: 'viaje', filter: ['==', ['get', 'parte'], 'caminar'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#14213d', 'line-width': 3, 'line-dasharray': [0.1, 2] } });
  m.addLayer({ id: 'viaje-colectivo-borde', type: 'line', source: 'viaje', filter: ['==', ['get', 'parte'], 'colectivo'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } });
  m.addLayer({ id: 'viaje-colectivo', type: 'line', source: 'viaje', filter: ['==', ['get', 'parte'], 'colectivo'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLOR_COLECTIVO, 'line-width': 5 } });
  m.addLayer({ id: 'viaje-paradas', type: 'circle', source: 'viaje', filter: ['==', ['get', 'parte'], 'parada'], paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': COLOR_COLECTIVO, 'circle-stroke-width': 3 } });
  m.addLayer({
    id: 'viaje-etiquetas', type: 'symbol', source: 'viaje', filter: ['==', ['get', 'parte'], 'parada'],
    layout: { 'text-field': ['get', 'texto'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-allow-overlap': true },
    paint: { 'text-color': COLOR_COLECTIVO, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
  });
}

// Filtros de cada capa de transporte: el filtro base de la capa más las líneas que la persona apagó.
function aplicarOcultas(m: maplibregl.Map, ocultas: string[]) {
  const sinTren = ocultas.includes('Tren');
  const letras = ocultas.filter((c) => c !== 'Tren' && c !== 'amarillo' && c !== 'rojo');
  const circuitos = ocultas.filter((c) => c === 'amarillo' || c === 'rojo');
  const fuera = (prop: string, lista: string[]) => ['!', ['in', ['get', prop], ['literal', lista]]];
  const tipo = (t: string) => ['==', ['get', 'tipo'], t];
  const noTipo = (t: string) => ['!=', ['get', 'tipo'], t];
  const F: Record<string, unknown[]> = {
    'tr-trenes': ['all', tipo('tren'), sinTren ? false : true],
    'tr-subte-borde': ['all', noTipo('tren'), fuera('ref', letras)],
    'tr-subte': ['all', noTipo('tren'), fuera('ref', letras)],
    'tr-estaciones': ['all', ['any', noTipo('tren'), ['>=', ['zoom'], 13]], fuera('linea', letras), sinTren ? noTipo('tren') : true],
    'tr-nombres': ['all', fuera('linea', letras), sinTren ? noTipo('tren') : true],
    'bt-trazado-borde': ['all', tipo('trazado'), fuera('circuito', circuitos)],
    'bt-trazado': ['all', tipo('trazado'), fuera('circuito', circuitos)],
    'bt-paradas': ['all', tipo('parada'), fuera('circuito', circuitos)],
    'bt-numeros': ['all', tipo('parada'), fuera('circuito', circuitos)],
  };
  for (const [id, f] of Object.entries(F)) if (m.getLayer(id)) m.setFilter(id, f as maplibregl.FilterSpecification);
}

function claseDeZoom(z: number): string {
  return z <= 12 ? 'zoom-lejos' : z <= 14 ? 'zoom-medio' : '';
}

export default function Mapa({ lugares, activo, posicion, centrarEnUsuario, transporte, ocultas, viaje, onSelect }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const marcadores = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLElement; cat: Categoria; activo: boolean }>());
  const marcadorYo = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const transporteRef = useRef(transporte);
  transporteRef.current = transporte;
  const ocultasRef = useRef(ocultas);
  ocultasRef.current = ocultas;
  const pintarViajeRef = useRef<() => void>(() => {});

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    registrarProtocolo();
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: { version: 8, sources: {}, layers: [] }, // provisorio hasta que cargue el índice
      center: [CENTRO_BUENOS_AIRES[1], CENTRO_BUENOS_AIRES[0]],
      zoom: 12.6,
      minZoom: 9,
      maxZoom: 19,
      attributionControl: false,
      renderWorldCopies: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    m.touchPitch.disable();
    m.dragRotate.disable();
    m.touchZoomRotate.disableRotation();
    mapa.current = m;

    const aplicarZoom = () => {
      const el = m.getContainer();
      el.classList.remove('zoom-lejos', 'zoom-medio');
      const c = claseDeZoom(m.getZoom());
      if (c) el.classList.add(c);
    };
    m.on('zoomend', aplicarZoom);
    aplicarZoom();

    crearEstilo()
      .then((estilo) => {
        // El listener va antes de setStyle, y sin `diff`: aplicado como diferencia sobre el estilo provisorio,
        // MapLibre no emite 'style.load' y las capas propias (GPS, transporte, viaje) nunca se agregaban.
        m.once('style.load', () => {
          listo.current = true;
          m.addSource('yo-precision', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          m.addLayer({ id: 'yo-precision', type: 'fill', source: 'yo-precision', paint: { 'fill-color': '#1d6fd1', 'fill-opacity': 0.12 } });
          m.addLayer({ id: 'yo-precision-borde', type: 'line', source: 'yo-precision', paint: { 'line-color': '#1d6fd1', 'line-width': 1 } });
          agregarCapaTransporte(m, transporteRef.current);
          aplicarOcultas(m, ocultasRef.current);
          agregarCapaViaje(m);
          pintarViajeRef.current();
        });
        m.setStyle(estilo, { diff: false });
      })
      .catch((e) => console.error('No se pudo cargar el mapa base', e));

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(contenedor.current);
    return () => {
      ro.disconnect();
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Marcadores: se crean/quitan según los lugares visibles y se actualiza el resaltado.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const vivos = new Set(lugares.map((l) => l.id));
    for (const [id, reg] of marcadores.current) {
      if (!vivos.has(id)) { reg.marker.remove(); marcadores.current.delete(id); }
    }
    for (const l of lugares) {
      const cat = CATEGORIA_POR_ID[l.cat];
      const esActivo = activo?.id === l.id;
      let reg = marcadores.current.get(l.id);
      if (!reg) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'pin';
        el.title = l.name;
        el.setAttribute('aria-label', l.name);
        el.innerHTML = svgPin(cat, esActivo);
        el.addEventListener('click', (e) => { e.stopPropagation(); onSelectRef.current(l); });
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.lng, l.lat]).addTo(m);
        reg = { marker, el, cat, activo: esActivo };
        marcadores.current.set(l.id, reg);
      }
      if (reg.activo !== esActivo) {
        reg.el.innerHTML = svgPin(cat, esActivo);
        reg.activo = esActivo;
      }
      reg.el.classList.toggle('pin--activo', esActivo);
      reg.el.style.zIndex = esActivo ? '10' : '';
    }
  }, [lugares, activo]);

  // Mostrar u ocultar la capa de transporte.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    for (const id of CAPAS_TRANSPORTE) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', transporte ? 'visible' : 'none');
  }, [transporte]);

  useEffect(() => {
    const m = mapa.current;
    if (m && listo.current) aplicarOcultas(m, ocultas);
  }, [ocultas]);

  // Dibujar el viaje en colectivo elegido y encuadrarlo.
  useEffect(() => {
    const pintar = () => {
      const m = mapa.current;
      const src = m?.getSource('viaje') as maplibregl.GeoJSONSource | undefined;
      if (!m || !src) return;
      if (!viaje) { src.setData(VACIO); return; }
      const { viaje: v, origen, destino } = viaje;
      const linea = (coords: [number, number][], parte: string): GeoJSON.Feature => ({ type: 'Feature', properties: { parte }, geometry: { type: 'LineString', coordinates: coords } });
      const parada = (c: [number, number], texto: string): GeoJSON.Feature => ({ type: 'Feature', properties: { parte: 'parada', texto }, geometry: { type: 'Point', coordinates: c } });
      src.setData({
        type: 'FeatureCollection',
        features: [
          linea([origen, v.subida], 'caminar'),
          linea(v.tramo, 'colectivo'),
          linea([v.bajada, destino], 'caminar'),
          parada(v.subida, `Subí al ${v.linea}`),
          parada(v.bajada, 'Bajá acá'),
        ],
      });
      const b = new maplibregl.LngLatBounds(origen, origen);
      for (const c of [...v.tramo, destino]) b.extend(c);
      const movil = window.matchMedia('(max-width: 860px)').matches;
      m.fitBounds(b, { padding: movil ? { top: 120, bottom: 230, left: 40, right: 40 } : 80, maxZoom: 16, duration: 700 });
    };
    pintarViajeRef.current = pintar;
    if (listo.current) pintar();
  }, [viaje]);

  // Centrar en el lugar activo; en móvil se corre el centro para que el pin no quede bajo el carrusel o la hoja.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !activo) return;
    const movil = window.matchMedia('(max-width: 860px)').matches;
    const zona = m.getContainer().parentElement;
    const tapa = movil ? zona?.querySelector<HTMLElement>('.detalle') ?? zona?.querySelector<HTMLElement>('.carrusel') : null;
    const corrimiento = tapa ? tapa.offsetHeight / 2 + 8 : 0;
    m.flyTo({ center: [activo.lng, activo.lat], zoom: Math.max(m.getZoom(), ZOOM_DETALLE), offset: [0, -corrimiento], duration: 600, essential: true });
  }, [activo]);

  // Posición del usuario: punto azul y círculo de precisión.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!posicion) {
      marcadorYo.current?.remove();
      marcadorYo.current = null;
      return;
    }
    if (!marcadorYo.current) {
      const el = document.createElement('div');
      el.className = 'yo';
      el.innerHTML = '<span class="yo__halo"></span><span class="yo__punto"></span><span class="yo__etiqueta">Estás aquí</span>';
      el.style.zIndex = '20';
      marcadorYo.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([posicion.lng, posicion.lat]).addTo(m);
    } else marcadorYo.current.setLngLat([posicion.lng, posicion.lat]);
    const pintar = () => {
      const src = m.getSource('yo-precision') as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features: [circulo(posicion.lng, posicion.lat, posicion.precision)] });
    };
    if (listo.current) pintar();
    else m.once('style.load', pintar);
  }, [posicion]);

  useEffect(() => {
    const m = mapa.current;
    if (!m || centrarEnUsuario === 0 || !posicion) return;
    m.flyTo({ center: [posicion.lng, posicion.lat], zoom: Math.max(m.getZoom(), ZOOM_DETALLE), duration: 700, essential: true });
    // Solo reacciona al pedido explícito de centrar, no a cada actualización del GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEnUsuario]);

  return <div ref={contenedor} className="mapa" role="region" aria-label="Mapa de Buenos Aires" />;
}
