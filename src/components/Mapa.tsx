import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORIA_POR_ID } from '../data/categorias';
import { CENTRO_BUENOS_AIRES } from '../data/lugares';
import type { Lugar, Posicion } from '../types';

interface Props {
  lugares: Lugar[];
  seleccionado: Lugar | null;
  posicion: Posicion | null;
  centrarEnUsuario: number; // contador: cada incremento vuelve a centrar en el usuario
  onSelect: (l: Lugar) => void;
}

// Pin SVG por categoría (sin imágenes externas, para que el build sea autocontenido).
function iconoPin(color: string, activo: boolean): L.DivIcon {
  const s = activo ? 40 : 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${s}" height="${s}" fill="${color}" stroke="${activo ? '#14213d' : '#ffffff'}" stroke-width="1.5" stroke-linejoin="round"><path d="M12 22s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="10" r="2.8" fill="#ffffff" stroke="none"/></svg>`;
  return L.divIcon({
    className: `pin ${activo ? 'pin--activo' : ''}`,
    html: svg,
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
    popupAnchor: [0, -s],
  });
}

function Enfoque({ seleccionado, posicion, centrarEnUsuario }: Pick<Props, 'seleccionado' | 'posicion' | 'centrarEnUsuario'>) {
  const map = useMap();
  useEffect(() => {
    if (seleccionado) map.flyTo([seleccionado.lat, seleccionado.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [seleccionado, map]);
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

export default function Mapa({ lugares, seleccionado, posicion, centrarEnUsuario, onSelect }: Props) {
  const iconos = useMemo(() => {
    const m = new Map<string, { normal: L.DivIcon; activo: L.DivIcon }>();
    for (const c of Object.values(CATEGORIA_POR_ID)) m.set(c.id, { normal: iconoPin(c.color, false), activo: iconoPin(c.color, true) });
    return m;
  }, []);

  return (
    <MapContainer center={CENTRO_BUENOS_AIRES} zoom={13} minZoom={10} zoomControl={false} className="mapa" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <ZoomControl position="bottomright" />
      {lugares.map((l) => {
        const activo = seleccionado?.id === l.id;
        const ic = iconos.get(l.cat)!;
        return (
          <Marker
            key={l.id}
            position={[l.lat, l.lng]}
            icon={activo ? ic.activo : ic.normal}
            zIndexOffset={activo ? 1000 : 0}
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
      <Enfoque seleccionado={seleccionado} posicion={posicion} centrarEnUsuario={centrarEnUsuario} />
    </MapContainer>
  );
}
