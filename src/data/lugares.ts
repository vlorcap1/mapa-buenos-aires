import type { Foto, Lugar } from '../types';
import datos from '../../data/lugares.json';
import fotos from '../../data/fotos.json';

// data/lugares.json lo genera `npm run geocode`; data/fotos.json lo genera `npm run fotos` (Wikipedia / Wikimedia Commons).
const FOTOS = fotos as Record<string, Partial<Foto>>;

export const LUGARES: Lugar[] = (datos as Array<Omit<Lugar, 'foto'> & { src?: string }>).map(({ src: _src, ...l }) => {
  const f = FOTOS[l.id];
  return f?.url
    ? {
        ...l,
        foto: {
          url: f.url,
          ancho: f.ancho ?? 900,
          alto: f.alto ?? 600,
          autor: f.autor ?? 'Autor desconocido',
          licencia: f.licencia ?? '',
          archivo: f.archivo ?? f.url,
        },
      }
    : l;
});

export const CENTRO_BUENOS_AIRES: [number, number] = [-34.6037, -58.3916];
