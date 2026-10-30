import type { LucideIcon } from 'lucide-react';
import {
  Landmark,
  Camera,
  Map,
  Coffee,
  UtensilsCrossed,
  Wine,
  Theater,
  Building2,
  Trees,
  ShoppingBag,
  Bike,
  Footprints,
} from 'lucide-react';
// Trazos del mismo ícono como datos, para dibujarlo dentro de los pines SVG del mapa (Leaflet no renderiza React).
import {
  Landmark as LandmarkNodo,
  Camera as CameraNodo,
  Map as MapNodo,
  Coffee as CoffeeNodo,
  UtensilsCrossed as UtensilsCrossedNodo,
  Wine as WineNodo,
  Theater as TheaterNodo,
  Building2 as Building2Nodo,
  Trees as TreesNodo,
  ShoppingBag as ShoppingBagNodo,
  Bike as BikeNodo,
  Footprints as FootprintsNodo,
  type IconNode,
} from 'lucide';
import type { CategoriaId } from '../types';

export interface Categoria {
  id: CategoriaId;
  label: string;
  color: string;
  Icon: LucideIcon;
  nodo: IconNode;
}

// Orden de los chips de filtro. Los alojamientos no existen en este mapa a propósito.
export const CATEGORIAS: Categoria[] = [
  { id: 'sightseeing', label: 'Atracciones', color: '#c0392b', Icon: Landmark, nodo: LandmarkNodo },
  { id: 'museum', label: 'Museos', color: '#8e44ad', Icon: Building2, nodo: Building2Nodo },
  { id: 'culture', label: 'Cultura', color: '#d35400', Icon: Theater, nodo: TheaterNodo },
  { id: 'park', label: 'Parques', color: '#27ae60', Icon: Trees, nodo: TreesNodo },
  { id: 'cafe', label: 'Cafés', color: '#a0522d', Icon: Coffee, nodo: CoffeeNodo },
  { id: 'restaurant', label: 'Restaurantes', color: '#e67e22', Icon: UtensilsCrossed, nodo: UtensilsCrossedNodo },
  { id: 'bar', label: 'Bares', color: '#2980b9', Icon: Wine, nodo: WineNodo },
  { id: 'shop', label: 'Tiendas y ferias', color: '#c2185b', Icon: ShoppingBag, nodo: ShoppingBagNodo },
  { id: 'area', label: 'Barrios', color: '#16a085', Icon: Map, nodo: MapNodo },
  { id: 'photospot', label: 'Fotos', color: '#f39c12', Icon: Camera, nodo: CameraNodo },
  { id: 'activity', label: 'Actividades', color: '#1abc9c', Icon: Bike, nodo: BikeNodo },
  { id: 'tours', label: 'Tours', color: '#34495e', Icon: Footprints, nodo: FootprintsNodo },
];

export const CATEGORIA_POR_ID: Record<CategoriaId, Categoria> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.id, c]),
) as Record<CategoriaId, Categoria>;

/** Trazos del ícono como marcado SVG (sin el <svg> envolvente). El nodo de lucide es ['svg', attrs, hijos]. */
export function trazosSvg(nodo: IconNode): string {
  const hijos = (nodo as unknown as [string, unknown, Array<[string, Record<string, string | number>]>])[2] ?? [];
  return hijos
    .map(([etiqueta, attrs]) => `<${etiqueta} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
}
