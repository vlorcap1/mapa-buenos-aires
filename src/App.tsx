import { useEffect, useMemo, useState } from 'react';
import { LocateFixed, Loader2, Search, ArrowDownUp, List, Map as MapIcon } from 'lucide-react';
import Mapa from './components/Mapa';
import Filtros from './components/Filtros';
import TarjetaLugar from './components/TarjetaLugar';
import DetalleLugar from './components/DetalleLugar';
import Carrusel from './components/Carrusel';
import { useGeolocalizacion } from './hooks/useGeolocalizacion';
import { LUGARES } from './data/lugares';
import { distanciaKm } from './lib/geo';
import type { CategoriaId, Lugar } from './types';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MENSAJE_GPS: Record<string, string> = {
  buscando: 'Buscando tu ubicación…',
  denegado: 'Permiso de ubicación denegado. Activalo en la configuración del navegador.',
  'no-disponible': 'No se pudo obtener la ubicación en este dispositivo.',
  inseguro: 'El GPS solo funciona en una conexión segura (https).',
};

export default function App() {
  const [activas, setActivas] = useState<Set<CategoriaId>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<Lugar | null>(null); // detalle abierto
  const [resaltado, setResaltado] = useState<Lugar | null>(null); // pin resaltado desde el carrusel (móvil)
  const [ordenarPorCercania, setOrdenarPorCercania] = useState(false);
  const [centrarEnUsuario, setCentrarEnUsuario] = useState(0);
  const [vistaMovil, setVistaMovil] = useState<'mapa' | 'lista'>('mapa');
  const [avisoOffline, setAvisoOffline] = useState(false);
  const { estado, posicion, activar } = useGeolocalizacion();

  // El service worker avisa cuando la app, las fotos y el mapa quedaron guardados para usar sin conexión.
  useEffect(() => {
    const mostrar = () => { setAvisoOffline(true); window.setTimeout(() => setAvisoOffline(false), 6000); };
    window.addEventListener('offline-listo', mostrar);
    const porMensaje = (e: MessageEvent) => { if (e.data?.tipo === 'offline-listo') mostrar(); };
    navigator.serviceWorker?.addEventListener('message', porMensaje);
    return () => {
      window.removeEventListener('offline-listo', mostrar);
      navigator.serviceWorker?.removeEventListener('message', porMensaje);
    };
  }, []);

  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of LUGARES) c[l.cat] = (c[l.cat] ?? 0) + 1;
    return c;
  }, []);

  const conDistancia = useMemo(
    () =>
      LUGARES.map((l) => ({
        lugar: l,
        dist: posicion ? distanciaKm(posicion.lat, posicion.lng, l.lat, l.lng) : null,
      })),
    [posicion],
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    let lista = conDistancia.filter(({ lugar }) => activas.size === 0 || activas.has(lugar.cat));
    if (q) lista = lista.filter(({ lugar }) => normalizar(`${lugar.name} ${lugar.barrio} ${lugar.desc}`).includes(q));
    if (ordenarPorCercania && posicion) lista = [...lista].sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
    return lista;
  }, [conDistancia, activas, busqueda, ordenarPorCercania, posicion]);

  const activo = seleccionado ?? resaltado;
  const distSeleccionado = seleccionado && posicion ? distanciaKm(posicion.lat, posicion.lng, seleccionado.lat, seleccionado.lng) : null;

  // Si el lugar activo deja de estar visible por el filtro, se cierra el detalle y se quita el resaltado.
  useEffect(() => {
    if (seleccionado && !visibles.some((v) => v.lugar.id === seleccionado.id)) setSeleccionado(null);
    if (resaltado && !visibles.some((v) => v.lugar.id === resaltado.id)) setResaltado(null);
  }, [visibles, seleccionado, resaltado]);

  // Al seleccionar desde el mapa, la tarjeta correspondiente de la lista se desplaza a la vista.
  useEffect(() => {
    if (seleccionado) document.getElementById(`tarjeta-${seleccionado.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [seleccionado]);

  const toggleCategoria = (id: CategoriaId) =>
    setActivas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const onLocalizar = () => {
    if (estado !== 'activo') activar();
    setCentrarEnUsuario((n) => n + 1);
    setVistaMovil('mapa');
  };

  const onSelect = (l: Lugar) => {
    setSeleccionado(l);
    setResaltado(l);
    setVistaMovil('mapa');
  };

  const gpsActivo = estado === 'activo' && posicion;

  return (
    <div className={`app app--${vistaMovil} ${seleccionado ? 'app--detalle' : ''}`}>
      <header className="cabecera">
        <h1 className="visualmente-oculto">Turista en Buenos Aires</h1>
        <label className="buscador">
          <Search size={18} aria-hidden="true" />
          <input
            id="buscador"
            type="search"
            placeholder="Buscar lugar, barrio o palabra clave"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoComplete="off"
          />
        </label>
      </header>

      <Filtros activas={activas} conteo={conteo} onToggle={toggleCategoria} onTodas={() => setActivas(new Set())} />

      <main className="cuerpo">
        <section className="panel" aria-label="Lista de lugares">
          <div className="panel__cabecera">
            <span className="panel__total">
              {visibles.length} {visibles.length === 1 ? 'lugar' : 'lugares'}
            </span>
            <button
              type="button"
              className={`btn btn--chico ${ordenarPorCercania ? 'btn--on' : ''}`}
              onClick={() => {
                if (!gpsActivo) activar();
                setOrdenarPorCercania((v) => !v);
              }}
              aria-pressed={ordenarPorCercania}
              title="Ordenar por cercanía a tu ubicación"
            >
              <ArrowDownUp size={16} aria-hidden="true" /> Más cerca primero
            </button>
          </div>
          {ordenarPorCercania && !gpsActivo && (
            <p className="aviso">{MENSAJE_GPS[estado] ?? 'Activá la ubicación para ordenar por cercanía.'}</p>
          )}
          <div className="lista">
            {visibles.map(({ lugar, dist }) => (
              <TarjetaLugar key={lugar.id} lugar={lugar} distanciaKm={dist} seleccionado={seleccionado?.id === lugar.id} onSelect={onSelect} />
            ))}
            {visibles.length === 0 && <p className="vacio">Ningún lugar coincide con la búsqueda o el filtro.</p>}
          </div>
        </section>

        <section className="zona-mapa" aria-label="Mapa">
          <Mapa lugares={visibles.map((v) => v.lugar)} activo={activo} posicion={posicion} centrarEnUsuario={centrarEnUsuario} onSelect={onSelect} />

          <button
            type="button"
            className={`btn-gps ${gpsActivo ? 'btn-gps--on' : ''}`}
            onClick={onLocalizar}
            aria-label="Mostrar mi ubicación"
            title="Mostrar mi ubicación"
          >
            {estado === 'buscando' ? <Loader2 size={22} className="girar" aria-hidden="true" /> : <LocateFixed size={22} aria-hidden="true" />}
          </button>

          {avisoOffline && <div className="toast toast--ok" role="status">Mapa y fotos guardados: la app ya funciona sin conexión.</div>}
          {estado !== 'inactivo' && estado !== 'activo' && <div className="toast" role="status">{MENSAJE_GPS[estado]}</div>}
          {gpsActivo && posicion && (
            <div className="toast toast--ok" role="status">
              Ubicación activa · precisión ±{Math.round(posicion.precision)} m
            </div>
          )}

          <Carrusel items={visibles} activoId={activo?.id ?? null} onResaltar={setResaltado} onAbrir={onSelect} />

          {seleccionado && <DetalleLugar lugar={seleccionado} posicion={posicion} distanciaKm={distSeleccionado} onCerrar={() => setSeleccionado(null)} />}
        </section>
      </main>

      <nav className="barra-movil" aria-label="Cambiar vista">
        <button type="button" className={vistaMovil === 'mapa' ? 'on' : ''} onClick={() => setVistaMovil('mapa')}>
          <MapIcon size={20} aria-hidden="true" /> Mapa
        </button>
        <button type="button" className={vistaMovil === 'lista' ? 'on' : ''} onClick={() => setVistaMovil('lista')}>
          <List size={20} aria-hidden="true" /> Lista
          <span className="barra-movil__n">{visibles.length}</span>
        </button>
      </nav>
    </div>
  );
}
