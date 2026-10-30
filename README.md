# Turista en Buenos Aires · Mapa

Mapa turístico interactivo de Buenos Aires inspirado en la estructura de los mapas de viaje de Rexby: lista de lugares a la izquierda, mapa a la derecha, filtros por categoría, búsqueda, detalle de cada lugar y ubicación GPS del visitante con distancias y tiempo caminando.

**Sin alojamientos a propósito.** Las categorías son: atracciones, museos, cultura, parques, cafés, restaurantes, bares, tiendas y ferias, barrios, fotos, actividades y tours. 115 lugares.

Stack: React 18 + Vite + TypeScript, Leaflet (react-leaflet), iconos `lucide-react`, mapa base de OpenStreetMap/CARTO. No hay backend: es un sitio estático que funciona en cualquier hosting con HTTPS (necesario para el GPS).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5177
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://localhost:4177
```

## Datos

- `data/lugares.src.tsv`: fuente editable (categoría, nombre, barrio, consulta de geocodificación, lat/lng estimadas, descripción).
- `npm run geocode`: verifica cada coordenada contra Nominatim (OpenStreetMap) y escribe `data/lugares.json`, que es lo que carga la app.
- `scripts/geocode-retry.mjs`: segundo intento por dirección postal para los que no se encontraron por nombre.

Para agregar un lugar: añadí una fila al TSV, corré `npm run geocode` (solo procesa las filas nuevas; `--todo` rehace todas) y volvé a compilar.

## Fotos

- `npm run fotos` (`scripts/fotos.mjs`): imagen principal del artículo de Wikipedia en español o búsqueda en Wikimedia Commons, con autor y licencia. Escribe `data/fotos.json`. Mapas `ARTICULOS`, `BUSQUEDAS`, `ARCHIVOS_FIJOS` y `SIN_BUSCAR` para afinar casos; `--rehacer=id1,id2` repite lugares puntuales.
- `scripts/fotos-web.mjs`: para locales sin foto libre, toma la foto más grande del sitio oficial (lista candidatas; `--aplicar` las guarda con crédito "sitio oficial de …" y enlace al sitio). Son imágenes promocionales de cada local, no libres: se usan como vista previa con enlace, igual que una red social.
- `scripts/openverse.mjs`: búsqueda alternativa de fotos Creative Commons (Flickr y otras fuentes) vía Openverse.

Las fotos se muestran desde su origen (hotlink), no se copian al repositorio.

## Publicar en GitHub Pages

Requiere `gh` autenticado (`gh auth login`).

```bash
gh repo create mapa-buenos-aires --public --source=. --push
npm run deploy                     # compila y sube dist/ a la rama gh-pages
gh api -X POST repos/{owner}/mapa-buenos-aires/pages -f "source[branch]=gh-pages" -f "source[path]=/"
```

La URL queda en `https://<usuario>.github.io/mapa-buenos-aires/`. El `base: './'` de Vite hace que el build funcione también en Netlify, Vercel, Cloudflare Pages o cualquier carpeta.

## GPS

El botón de ubicación usa `navigator.geolocation.watchPosition`. Solo funciona en `https://` o en `localhost`; en `http://` la app lo avisa. Con la ubicación activa, cada tarjeta muestra la distancia, el detalle muestra minutos caminando y "Cómo llegar" abre Google Maps con la ruta a pie desde tu posición.
