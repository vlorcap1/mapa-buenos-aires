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

export interface Foto {
  url: string; // miniatura de Wikimedia Commons (~900 px de ancho)
  ancho: number;
  alto: number;
  autor: string;
  licencia: string;
  archivo: string; // página del archivo en Commons (para el crédito)
}

export interface Lugar {
  id: string;
  cat: CategoriaId;
  name: string;
  barrio: string;
  lat: number;
  lng: number;
  desc: string;
  foto?: Foto;
  web?: string; // sitio oficial o artículo de Wikipedia para "Más información"
}

export interface Posicion {
  lat: number;
  lng: number;
  precision: number; // metros
  timestamp: number;
}

export type EstadoGps = 'inactivo' | 'buscando' | 'activo' | 'denegado' | 'no-disponible' | 'inseguro';
