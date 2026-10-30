import type { Lugar } from '../types';
import datos from '../../data/lugares.json';

// data/lugares.json lo genera `npm run geocode` a partir de data/lugares.src.tsv.
export const LUGARES: Lugar[] = (datos as Array<Lugar & { src?: string }>).map(({ src: _src, ...l }) => l);

export const CENTRO_BUENOS_AIRES: [number, number] = [-34.6037, -58.3916];
