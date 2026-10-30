import { Footprints } from 'lucide-react';
import { CATEGORIA_POR_ID } from '../data/categorias';
import { formatoDistancia, minutosCaminando } from '../lib/geo';
import type { Lugar } from '../types';

interface Props {
  lugar: Lugar;
  distanciaKm: number | null;
  seleccionado: boolean;
  onSelect: (l: Lugar) => void;
}

export default function TarjetaLugar({ lugar, distanciaKm, seleccionado, onSelect }: Props) {
  const cat = CATEGORIA_POR_ID[lugar.cat];
  const Icon = cat.Icon;
  return (
    <button
      type="button"
      className={`tarjeta ${seleccionado ? 'tarjeta--sel' : ''}`}
      onClick={() => onSelect(lugar)}
      aria-pressed={seleccionado}
      id={`tarjeta-${lugar.id}`}
    >
      <span className="tarjeta__icono" style={{ background: cat.color }}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="tarjeta__cuerpo">
        <span className="tarjeta__meta">
          <span>{cat.label}</span>
          <span aria-hidden="true">·</span>
          <span>{lugar.barrio}</span>
        </span>
        <span className="tarjeta__nombre">{lugar.name}</span>
        <span className="tarjeta__desc">{lugar.desc}</span>
      </span>
      {distanciaKm !== null && (
        <span className="tarjeta__dist" title={`${minutosCaminando(distanciaKm)} min caminando`}>
          <Footprints size={14} aria-hidden="true" />
          {formatoDistancia(distanciaKm)}
        </span>
      )}
    </button>
  );
}
