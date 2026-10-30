import { useCallback, useEffect, useRef, useState } from 'react';
import type { EstadoGps, Posicion } from '../types';

/**
 * Sigue la posición del usuario con watchPosition.
 * Solo empieza cuando se llama a `activar()` (gesto del usuario) para que el navegador muestre el permiso en contexto.
 */
export function useGeolocalizacion() {
  const [estado, setEstado] = useState<EstadoGps>('inactivo');
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const watchId = useRef<number | null>(null);

  const detener = useCallback(() => {
    if (watchId.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setEstado('inactivo');
  }, []);

  const activar = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setEstado('no-disponible');
      return;
    }
    if (!window.isSecureContext) {
      // El GPS solo funciona en https o en localhost.
      setEstado('inseguro');
      return;
    }
    setEstado('buscando');
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPosicion({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision: p.coords.accuracy,
          timestamp: p.timestamp,
        });
        setEstado('activo');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setEstado('denegado');
        else if (err.code === err.POSITION_UNAVAILABLE) setEstado('no-disponible');
        else setEstado((prev) => (prev === 'activo' ? 'activo' : 'no-disponible'));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, []);

  useEffect(() => () => {
    if (watchId.current !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  return { estado, posicion, activar, detener };
}
