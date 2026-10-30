import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORIA_POR_ID, trazosSvg, type Categoria } from '../data/categorias';
import { CENTRO_BUENOS_AIRES } from '../data/lugares';
import type { Lugar, Posicion } from '../types';

interface Props {
  lugares: Lugar[];
  activo: Lugar | null; // pin resaltado y centrado (seleccionado en detalle o resaltado desde el carrusel)
  posicion: Posicion | null;
  centrarEnUsuario: number; // contador: cada incremento vuelve a centrar en el usuario
  onSelect: (l: Lugar) => void;
}

// Pin con el ícono de la categoría: gota del color de la categoría, disco blanco y el ícono dentro.
function iconoPin(cat: Categoria, activo: boolean): L.DivIcon {
  const w = activo ? 46 : 34; // ancho del pin; alto = ancho * 1.3
  const h = Math.round(w * 1.3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 39" width="${w}" height="${h}">
  <path d="M15 38c-.6 0-1.1-.3-1.4-.8C11.3 33.4 2 21.2 2 14.5 2 7.1 7.8 1 15 1s13 6.1 13 13.5c0 6.7-9.3 18.9-11.6 22.7-.3.5-.8.8-1.4.8Z" fill="${cat.color}" stroke="${activo ? '#14213d' : '#ffffff'}" stroke-width="${activo ? 2 : 1.5}" stroke-linejoin="round"/>
  <circle cx="15" cy="14.5" r="9" fill="#ffffff"/>
  <svg x="9.5" y="9" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${cat.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${trazosSvg(cat.nodo)}</svg>
</svg>`;
  return L.divIcon({
    className: `pin ${activo ? 'pin--activo' : ''}`,
    html: svg,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
}

function Enfoque({ activo, posicion, centrarEnUsuario }: Pick<Props, 'activo' | 'posicion' | 'centrarEnUsuario'>) {
  const map = useMap();
  useEffect(() => {
    if (!activo) return;
    const zoom = Math.max(map.getZoom(), 14);
    // En móvil el carrusel o la hoja de detalle tapan la parte baja del mapa: se corre el centro
    // la mitad de esa altura para que el pin quede en el medio de la zona visible.
    const movil = window.matchMedia('(max-width: 860px)').matches;
    const zona = map.getContainer().parentElement;
    const tapa = movil ? zona?.querySelector<HTMLElement>('.detalle') ?? zona?.querySelector<HTMLElement>('.carrusel') : null;
    const corrimiento = tapa ? tapa.offsetHeight / 2 + 8 : 0;
    const destino = map.project([activo.lat, activo.lng], zoom).add([0, corrimiento]);
    map.flyTo(map.unproject(destino, zoom), zoom, { duration: 0.5 });
  }, [activo, map]);
  useEffect(() => {
    if (centrarEnUsuario > 0 && posicion) map.flyTo([posicion.lat, posicion.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    // Solo reacciona al pedido explícito de centrar, no a cada actualización del GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEnUsuario, map]);
  useEffect(() => {
    // Leaflet necesita recalcular el tamaño cuando cambia el layout (rotación, panel que aparece).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function Mapa({ lugares, activo, posicion, centrarEnUsuario, onSelect }: Props) {
  const iconos = useMemo(() => {
    const m = new Map<string, { normal: L.DivIcon; activo: L.DivIcon }>();
    for (const c of Object.values(CATEGORIA_POR_ID)) m.set(c.id, { normal: iconoPin(c, false), activo: iconoPin(c, true) });
    return m;
  }, []);

  return (
    <MapContainer center={CENTRO_BUENOS_AIRES} zoom={13} minZoom={10} zoomControl={false} className="mapa" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      {lugares.map((l) => {
        const esActivo = activo?.id === l.id;
        const ic = iconos.get(l.cat)!;
        return (
          <Marker
            key={l.id}
            position={[l.lat, l.lng]}
            icon={esActivo ? ic.activo : ic.normal}
            zIndexOffset={esActivo ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(l) }}
            title={l.name}
          />
        );
      })}
      {posicion && (
        <>
          <Circle center={[posicion.lat, posicion.lng]} radius={posicion.precision} pathOptions={{ color: '#1d6fd1', weight: 1, fillColor: '#1d6fd1', fillOpacity: 0.12 }} />
          <CircleMarker center={[posicion.lat, posicion.lng]} radius={8} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1d6fd1', fillOpacity: 1 }} />
        </>
      )}
      <Enfoque activo={activo} posicion={posicion} centrarEnUsuario={centrarEnUsuario} />
    </MapContainer>
  );
}
