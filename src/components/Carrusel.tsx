import { useEffect, useRef } from 'react';
import { Footprints } from 'lucide-react';
import { CATEGORIA_POR_ID } from '../data/categorias';
import { formatoDistancia } from '../lib/geo';
import type { Lugar } from '../types';

interface Props {
  items: Array<{ lugar: Lugar; dist: number | null }>;
  activoId: string | null;
  onResaltar: (l: Lugar) => void; // la tarjeta centrada al deslizar
  onAbrir: (l: Lugar) => void; // toque en la tarjeta
}

/** Carrusel horizontal de tarjetas con foto sobre el mapa (solo móvil). Al deslizar, la tarjeta centrada resalta su pin. */
export default function Carrusel({ items, activoId, onResaltar, onAbrir }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const temporizador = useRef<number | null>(null);
  const desplazandoPorCodigo = useRef(false);

  // Cuando el resaltado cambia desde afuera (toque en un pin), la tarjeta correspondiente se centra.
  useEffect(() => {
    if (!activoId || !ref.current) return;
    const el = ref.current.querySelector<HTMLElement>(`[data-id="${activoId}"]`);
    if (!el) return;
    desplazandoPorCodigo.current = true;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    window.setTimeout(() => { desplazandoPorCodigo.current = false; }, 500);
  }, [activoId]);

  const onScroll = () => {
    if (desplazandoPorCodigo.current) return;
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => {
      const cont = ref.current;
      if (!cont) return;
      const centro = cont.scrollLeft + cont.clientWidth / 2;
      let mejor: HTMLElement | null = null;
      let mejorDist = Infinity;
      cont.querySelectorAll<HTMLElement>('.ficha').forEach((el) => {
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centro);
        if (d < mejorDist) { mejorDist = d; mejor = el; }
      });
      const id = mejor ? (mejor as HTMLElement).dataset.id : undefined;
      if (id && id !== activoId) {
        const l = items.find((x) => x.lugar.id === id)?.lugar;
        if (l) onResaltar(l);
      }
    }, 120);
  };

  if (items.length === 0) return null;

  return (
    <div className="carrusel" ref={ref} onScroll={onScroll} aria-label="Lugares cercanos al mapa">
      {items.map(({ lugar, dist }) => {
        const cat = CATEGORIA_POR_ID[lugar.cat];
        const Icon = cat.Icon;
        return (
          <button
            key={lugar.id}
            type="button"
            data-id={lugar.id}
            className={`ficha ${activoId === lugar.id ? 'ficha--activa' : ''}`}
            onClick={() => onAbrir(lugar)}
          >
            <span className="ficha__foto" style={{ background: cat.color }}>
              {lugar.foto && <img src={lugar.foto.url} alt="" loading="lazy" decoding="async" />}
              <span className="ficha__cat" style={{ color: cat.color }}>
                <Icon size={13} aria-hidden="true" /> {cat.label}
              </span>
              {dist !== null && (
                <span className="ficha__dist">
                  <Footprints size={12} aria-hidden="true" /> {formatoDistancia(dist)}
                </span>
              )}
            </span>
            <span className="ficha__texto">
              <span className="ficha__nombre">{lugar.name}</span>
              <span className="ficha__barrio">{lugar.barrio}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
