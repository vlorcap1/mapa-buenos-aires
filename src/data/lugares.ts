import type { Foto, Lugar } from '../types';
import datos from '../../data/lugares.json';
import fotos from '../../data/fotos.json';
import webs from '../../data/webs.json';

// data/lugares.json lo genera `npm run geocode`; data/fotos.json lo genera `npm run fotos` (Wikipedia / Wikimedia Commons);
// data/webs.json tiene los sitios oficiales conocidos para el botón "Más información".
const FOTOS = fotos as Record<string, Partial<Foto> & { articulo?: string }>;
const WEBS = webs as Record<string, string>;

export const LUGARES: Lugar[] = (datos as Array<Omit<Lugar, 'foto' | 'web'> & { src?: string }>).map(({ src: _src, ...l }) => {
  const f = FOTOS[l.id];
  const articulo = f?.articulo && /wikipedia\.org\/wiki\//.test(f.articulo) ? f.articulo : undefined;
  const web = WEBS[l.id] ?? articulo;
  return {
    ...l,
    ...(web ? { web } : {}),
    ...(f?.url
      ? {
          foto: {
            url: f.url,
            ancho: f.ancho ?? 900,
            alto: f.alto ?? 600,
            autor: f.autor ?? 'Autor desconocido',
            licencia: f.licencia ?? '',
            archivo: f.archivo ?? f.url,
          },
        }
      : {}),
  };
});

export const CENTRO_BUENOS_AIRES: [number, number] = [-34.6037, -58.3916];
