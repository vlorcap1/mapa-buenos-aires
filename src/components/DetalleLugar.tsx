import { X, Info, Footprints, BusFront, TrainFront, Ticket } from 'lucide-react';
import { CATEGORIA_POR_ID } from '../data/categorias';
import { formatoDistancia, minutosCaminando, urlComoLlegar } from '../lib/geo';
import { estacionesCercanas } from '../data/transporte';
import ColectivosDirectos from './ColectivosDirectos';
import { paradasTuristicasCerca, circuitoDeLugar } from '../data/busTuristico';
import type { Viaje } from '../lib/colectivos';
import type { Lugar, Posicion } from '../types';

// Texto oscuro sobre colores claros (línea H amarilla), blanco sobre el resto.
function colorTexto(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#14213d' : '#ffffff';
}

interface Props {
  lugar: Lugar;
  posicion: Posicion | null;
  distanciaKm: number | null;
  onCerrar: () => void;
  onActivarGps: () => void;
  onVerViaje: (v: Viaje) => void;
}

export default function DetalleLugar({ lugar, posicion, distanciaKm, onCerrar, onActivarGps, onVerViaje }: Props) {
  const cat = CATEGORIA_POR_ID[lugar.cat];
  const Icon = cat.Icon;
  // Sitio oficial o Wikipedia; si no hay ninguno, una búsqueda del lugar.
  const masInfo = lugar.web ?? `https://www.google.com/search?q=${encodeURIComponent(lugar.name + ' Buenos Aires')}`;
  const esWikipedia = /wikipedia\.org/.test(masInfo);
  const estaciones = estacionesCercanas(lugar.lat, lugar.lng);
  const paradasTur = paradasTuristicasCerca(lugar.lat, lugar.lng).filter((p) => p.circuito.lugarId !== lugar.id);
  const circuitoPropio = circuitoDeLugar(lugar.id);
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
        {paradasTur.length > 0 && (
          <ul className="bus-turistico" aria-label="Bus turístico hop-on hop-off">
            {paradasTur.map(({ circuito, parada, distKm, aproximada }) => (
              <li key={circuito.id}>
                <span className="bus-turistico__chip" style={{ background: circuito.color, color: circuito.texto }} title={`${circuito.operador}: ${circuito.empresas}`}>
                  {circuito.nombre.replace('Bus turístico ', 'Bus ')} · parada {parada.n}
                </span>{' '}
                {parada.nombre}
                {distKm >= 0.05 ? `, a ${aproximada ? '~' : ''}${formatoDistancia(distKm)}` : ''}
                <span className="bus-turistico__empresa" title={circuito.empresas}> · {circuito.operador}</span>{' '}
                <a href={circuito.web} target="_blank" rel="noopener noreferrer">
                  Comprar
                </a>
              </li>
            ))}
          </ul>
        )}
        {distanciaKm !== null && (
          <p className="detalle__dist">
            <Footprints size={16} aria-hidden="true" />
            A {formatoDistancia(distanciaKm)} de vos, unos {minutosCaminando(distanciaKm)} min caminando.
          </p>
        )}
        {circuitoPropio && (
          <section className="transporte" aria-label="Dónde comprar el pasaje">
            <h3 className="transporte__titulo">
              <Ticket size={16} aria-hidden="true" /> Dónde comprar el pasaje
            </h3>
            <ul className="venta">
              <li>
                <a href={circuitoPropio.web} target="_blank" rel="noopener noreferrer">Online en {circuitoPropio.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
              </li>
              {circuitoPropio.aBordo && <li>A bordo del bus, en cualquiera de sus paradas</li>}
              {circuitoPropio.venta.map((v) => (
                <li key={`${v.parada}-${v.donde}`}>
                  {v.parada && <span className="venta__parada" style={{ background: circuitoPropio.color, color: circuitoPropio.texto }}>Parada {v.parada}</span>}{' '}
                  {v.nombre ? `${v.nombre}: ` : ''}
                  {v.donde}
                </li>
              ))}
            </ul>
            <p className="transporte__nota">Opera {circuitoPropio.empresas}. Datos del operador, noviembre de 2026.</p>
          </section>
        )}
        <ColectivosDirectos lugar={lugar} posicion={posicion} onActivarGps={onActivarGps} onVerViaje={onVerViaje} />
        {estaciones.length > 0 && (
          <section className="transporte" aria-label="Estaciones cercanas">
            <h3 className="transporte__titulo">
              <TrainFront size={16} aria-hidden="true" /> Subte y tren más cercanos
            </h3>
            <ul className="transporte__lista">
              {estaciones.map((e) => (
                <li key={e.nombre} className="transporte__estacion">
                  <span className="transporte__lineas">
                    {e.lineas.map((l) => (
                      <span
                        key={l.linea}
                        className={`linea linea--${l.tipo}`}
                        style={{ background: l.color, color: colorTexto(l.color) }}
                        title={l.tipo === 'subte' ? `Línea ${l.linea}` : l.tipo === 'premetro' ? 'Premetro' : `Tren ${l.linea}`}
                      >
                        {l.tipo === 'tren' ? `Tren ${l.linea}` : l.linea}
                      </span>
                    ))}
                  </span>
                  <span className="transporte__nombre">{e.nombre}</span>
                  <span className="transporte__dist">
                    {formatoDistancia(e.distKm)} · {minutosCaminando(e.distKm)} min a pie
                  </span>
                </li>
              ))}
            </ul>
            <p className="transporte__nota">Colectivo, subte y tren se pagan con la tarjeta SUBE.</p>
          </section>
        )}
        <div className="detalle__acciones">
          <a
            className="btn btn--primario"
            href={urlComoLlegar(lugar.lat, lugar.lng, posicion ?? undefined, 'transit')}
            target="_blank"
            rel="noopener noreferrer"
            title={posicion ? 'Ruta en colectivo, subte o tren desde tu ubicación (Google Maps)' : 'Ruta en colectivo, subte o tren (Google Maps)'}
          >
            <BusFront size={18} aria-hidden="true" /> En colectivo o subte
          </a>
          <a className="btn" href={urlComoLlegar(lugar.lat, lugar.lng, posicion ?? undefined)} target="_blank" rel="noopener noreferrer" title="Ruta caminando (Google Maps)">
            <Footprints size={18} aria-hidden="true" /> A pie
          </a>
          <a className="btn" href={masInfo} target="_blank" rel="noopener noreferrer" title={esWikipedia ? 'Artículo en Wikipedia' : lugar.web ? 'Sitio oficial' : 'Buscar en Google'}>
            <Info size={18} aria-hidden="true" /> Más información
          </a>
        </div>
      </div>
    </aside>
  );
}
