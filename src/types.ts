export type CategoriaId =
  | 'sightseeing'
  | 'photospot'
  | 'area'
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'culture'
  | 'museum'
  | 'park'
  | 'shop'
  | 'activity'
  | 'tours';

export interface Lugar {
  id: string;
  cat: CategoriaId;
  name: string;
  barrio: string;
  lat: number;
  lng: number;
  desc: string;
}

export interface Posicion {
  lat: number;
  lng: number;
  precision: number; // metros
  timestamp: number;
}

export type EstadoGps = 'inactivo' | 'buscando' | 'activo' | 'denegado' | 'no-disponible' | 'inseguro';
