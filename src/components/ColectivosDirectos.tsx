import { useEffect, useState } from 'react';
import { Bus, Loader2, LocateFixed, Map as MapIcon } from 'lucide-react';
import { colectivosDirectos, lineasCerca, type Viaje } from '../lib/colectivos';
import { distanciaKm, formatoDistancia } from '../lib/geo';
import type { Lugar, Posicion } from '../types';

interface Props {
  lugar: Lugar;
  posicion: Posicion | null;
  onActivarGps: () => void;
  onVerViaje: (v: Viaje) => void;
}

const LEJOS_KM = 40; // más lejos que esto, la persona no está en Buenos Aires: no tiene sentido buscar desde su ubicación

export default function ColectivosDirectos({ lugar, posicion, onActivarGps, onVerViaje }: Props) {
  const [viajes, setViajes] = useState<Viaje[] | null>(null);
  const [cerca, setCerca] = useState<string[] | null>(null);
  const km = posicion ? distanciaKm(posicion.lat, posicion.lng, lugar.lat, lugar.lng) : null;
  const buscarDesdeUbicacion = km !== null && km < LEJOS_KM && km >= 0.6;
  // El GPS se actualiza seguido: se busca de nuevo solo si la persona se movió ~100 m.
  const latR = posicion ? Math.round(posicion.lat * 1000) : null;
  const lngR = posicion ? Math.round(posicion.lng * 1000) : null;

  useEffect(() => {
    let vigente = true;
    setViajes(null);
    setCerca(null);
    if (buscarDesdeUbicacion && latR !== null && lngR !== null) {
      const origen = { lat: latR / 1000, lng: lngR / 1000 };
      colectivosDirectos(origen, lugar)
        .then((v) => (v.length ? v : colectivosDirectos(origen, lugar, 800)))
        .then((v) => vigente && setViajes(v))
        .catch(() => vigente && setViajes([]));
    } else {
      lineasCerca(lugar).then((l) => vigente && setCerca(l)).catch(() => vigente && setCerca([]));
    }
    return () => { vigente = false; };
  }, [lugar, buscarDesdeUbicacion, latR, lngR]);

  return (
    <section className="transporte" aria-label="Colectivos">
      <h3 className="transporte__titulo">
        <Bus size={16} aria-hidden="true" /> {buscarDesdeUbicacion ? 'Colectivos directos desde tu ubicación' : 'Colectivos'}
      </h3>

      {km !== null && km < 0.6 && <p className="transporte__nota transporte__nota--sin-margen">Estás a {formatoDistancia(km)}: conviene ir caminando.</p>}

      {buscarDesdeUbicacion && viajes === null && (
        <p className="transporte__cargando"><Loader2 size={16} className="girar" aria-hidden="true" /> Buscando colectivos…</p>
      )}
      {buscarDesdeUbicacion && viajes?.length === 0 && (
        <p className="transporte__nota transporte__nota--sin-margen">No hay colectivos directos cerca de tu ubicación. Con combinación, usá el botón “En colectivo o subte”.</p>
      )}
      {buscarDesdeUbicacion && !!viajes?.length && (
        <ul className="transporte__lista">
          {viajes.map((v) => (
            <li key={`${v.linea}-${v.ramal}`} className="viaje">
              <span className="linea linea--colectivo">{v.linea}</span>
              <span className="viaje__texto">
                <span className="viaje__ramal">hacia {v.ramal.split('→').pop()?.trim()}</span>
                <span className="transporte__dist">
                  Caminá {formatoDistancia(v.caminarHastaM / 1000)} · bajás a {formatoDistancia(v.caminarDesdeM / 1000)} · ~{v.minutos} min
                </span>
              </span>
              <button type="button" className="btn btn--chico" onClick={() => onVerViaje(v)} title="Ver el recorrido en el mapa">
                <MapIcon size={15} aria-hidden="true" /> Ver
              </button>
            </li>
          ))}
        </ul>
      )}

      {!buscarDesdeUbicacion && cerca === null && <p className="transporte__cargando"><Loader2 size={16} className="girar" aria-hidden="true" /> Buscando líneas…</p>}
      {!buscarDesdeUbicacion && !!cerca?.length && (
        <>
          <p className="transporte__nota transporte__nota--sin-margen">Pasan a menos de 300 m:</p>
          <div className="lineas-cerca">
            {cerca.map((l) => (
              <span key={l} className="linea linea--colectivo">{l}</span>
            ))}
          </div>
        </>
      )}
      {!buscarDesdeUbicacion && cerca?.length === 0 && <p className="transporte__nota transporte__nota--sin-margen">No hay líneas a menos de 300 m.</p>}
      {!posicion && (
        <button type="button" className="btn btn--chico transporte__gps" onClick={onActivarGps}>
          <LocateFixed size={15} aria-hidden="true" /> Usar mi ubicación para ver colectivos directos
        </button>
      )}
      {km !== null && km >= LEJOS_KM && (
        <p className="transporte__nota">Cuando estés en Buenos Aires, acá vas a ver qué colectivo te lleva directo desde donde estés.</p>
      )}
    </section>
  );
}
