import { X, Navigation, Info, Footprints } from 'lucide-react';
import { CATEGORIA_POR_ID } from '../data/categorias';
import { formatoDistancia, minutosCaminando, urlComoLlegar } from '../lib/geo';
import type { Lugar, Posicion } from '../types';

interface Props {
  lugar: Lugar;
  posicion: Posicion | null;
  distanciaKm: number | null;
  onCerrar: () => void;
}

export default function DetalleLugar({ lugar, posicion, distanciaKm, onCerrar }: Props) {
  const cat = CATEGORIA_POR_ID[lugar.cat];
  const Icon = cat.Icon;
  // Sitio oficial o Wikipedia; si no hay ninguno, una búsqueda del lugar.
  const masInfo = lugar.web ?? `https://www.google.com/search?q=${encodeURIComponent(lugar.name + ' Buenos Aires')}`;
  const esWikipedia = /wikipedia\.org/.test(masInfo);
  return (
    <aside className={`detalle ${lugar.foto ? 'detalle--con-foto' : ''}`} aria-label={`Detalle de ${lugar.name}`}>
      {!lugar.foto && <div className="detalle__barra" style={{ background: cat.color }} />}
      <button type="button" className="detalle__cerrar" onClick={onCerrar} aria-label="Cerrar detalle">
        <X size={20} aria-hidden="true" />
      </button>
      {lugar.foto && (
        <figure className="detalle__foto">
          <img src={lugar.foto.url} alt={lugar.name} width={lugar.foto.ancho} height={lugar.foto.alto} decoding="async" />
          <figcaption>
            <a href={lugar.foto.archivo} target="_blank" rel="noopener noreferrer" title="Ver archivo en Wikimedia Commons">
              Foto: {lugar.foto.autor}
              {lugar.foto.licencia ? ` · ${lugar.foto.licencia}` : ''}
            </a>
          </figcaption>
        </figure>
      )}
      <div className="detalle__contenido">
        <div className="detalle__meta">
          <span className="detalle__cat" style={{ color: cat.color }}>
            <Icon size={16} aria-hidden="true" /> {cat.label}
          </span>
          <span>{lugar.barrio}</span>
        </div>
        <h2 className="detalle__titulo">{lugar.name}</h2>
        <p className="detalle__desc">{lugar.desc}</p>
        {distanciaKm !== null && (
          <p className="detalle__dist">
            <Footprints size={16} aria-hidden="true" />
            A {formatoDistancia(distanciaKm)} de vos, unos {minutosCaminando(distanciaKm)} min caminando.
          </p>
        )}
        <div className="detalle__acciones">
          <a className="btn btn--primario" href={urlComoLlegar(lugar.lat, lugar.lng, posicion ?? undefined)} target="_blank" rel="noopener noreferrer">
            <Navigation size={18} aria-hidden="true" /> Cómo llegar
          </a>
          <a className="btn" href={masInfo} target="_blank" rel="noopener noreferrer" title={esWikipedia ? 'Artículo en Wikipedia' : lugar.web ? 'Sitio oficial' : 'Buscar en Google'}>
            <Info size={18} aria-hidden="true" /> Más información
          </a>
        </div>
      </div>
    </aside>
  );
}
