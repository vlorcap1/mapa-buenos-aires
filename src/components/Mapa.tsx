import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CATEGORIA_POR_ID, trazosSvg, type Categoria } from '../data/categorias';
import { CENTRO_BUENOS_AIRES } from '../data/lugares';
import { crearEstilo, registrarProtocolo } from '../lib/mapaOffline';
import type { Lugar, Posicion } from '../types';

interface Props {
  lugares: Lugar[];
  activo: Lugar | null; // pin resaltado y centrado (seleccionado en detalle o resaltado desde el carrusel)
  posicion: Posicion | null;
  centrarEnUsuario: number; // contador: cada incremento vuelve a centrar en el usuario
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

function claseDeZoom(z: number): string {
  return z <= 12 ? 'zoom-lejos' : z <= 14 ? 'zoom-medio' : '';
}

export default function Mapa({ lugares, activo, posicion, centrarEnUsuario, onSelect }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const marcadores = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLElement; cat: Categoria; activo: boolean }>());
  const marcadorYo = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
        m.setStyle(estilo);
        m.once('style.load', () => {
          listo.current = true;
          m.addSource('yo-precision', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          m.addLayer({ id: 'yo-precision', type: 'fill', source: 'yo-precision', paint: { 'fill-color': '#1d6fd1', 'fill-opacity': 0.12 } });
          m.addLayer({ id: 'yo-precision-borde', type: 'line', source: 'yo-precision', paint: { 'line-color': '#1d6fd1', 'line-width': 1 } });
        });
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
