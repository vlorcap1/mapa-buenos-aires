const R_TIERRA_KM = 6371;
const aRad = (g: number) => (g * Math.PI) / 180;

/** Distancia ortodrómica en kilómetros (fórmula del haversine). */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = aRad(lat2 - lat1);
  const dLng = aRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.sqrt(h));
}

export function formatoDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

/** Tiempo caminando a 4,5 km/h, redondeado a minutos. */
export function minutosCaminando(km: number): number {
  return Math.max(1, Math.round((km / 4.5) * 60));
}

export function urlComoLlegar(lat: number, lng: number, desde?: { lat: number; lng: number }): string {
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('destination', `${lat},${lng}`);
  u.searchParams.set('travelmode', 'walking');
  if (desde) u.searchParams.set('origin', `${desde.lat},${desde.lng}`);
  return u.toString();
}
