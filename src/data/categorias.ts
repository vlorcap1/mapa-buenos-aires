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
import type { CategoriaId } from '../types';

export interface Categoria {
  id: CategoriaId;
  label: string;
  color: string;
  Icon: LucideIcon;
}

// Orden de los chips de filtro. Los alojamientos no existen en este mapa a propósito.
export const CATEGORIAS: Categoria[] = [
  { id: 'sightseeing', label: 'Atracciones', color: '#c0392b', Icon: Landmark },
  { id: 'museum', label: 'Museos', color: '#8e44ad', Icon: Building2 },
  { id: 'culture', label: 'Cultura', color: '#d35400', Icon: Theater },
  { id: 'park', label: 'Parques', color: '#27ae60', Icon: Trees },
  { id: 'cafe', label: 'Cafés', color: '#a0522d', Icon: Coffee },
  { id: 'restaurant', label: 'Restaurantes', color: '#e67e22', Icon: UtensilsCrossed },
  { id: 'bar', label: 'Bares', color: '#2980b9', Icon: Wine },
  { id: 'shop', label: 'Tiendas y ferias', color: '#c2185b', Icon: ShoppingBag },
  { id: 'area', label: 'Barrios', color: '#16a085', Icon: Map },
  { id: 'photospot', label: 'Fotos', color: '#f39c12', Icon: Camera },
  { id: 'activity', label: 'Actividades', color: '#1abc9c', Icon: Bike },
  { id: 'tours', label: 'Tours', color: '#34495e', Icon: Footprints },
];

export const CATEGORIA_POR_ID: Record<CategoriaId, Categoria> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.id, c]),
) as Record<CategoriaId, Categoria>;
