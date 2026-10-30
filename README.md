# Turista en Buenos Aires · Mapa

Mapa turístico interactivo de Buenos Aires inspirado en la estructura de los mapas de viaje de Rexby: lista de lugares a la izquierda, mapa a la derecha, filtros por categoría, búsqueda, detalle de cada lugar y ubicación GPS del visitante con distancias y tiempo caminando.

**Sin alojamientos a propósito.** Las categorías son: atracciones, museos, cultura, parques, cafés, restaurantes, bares, tiendas y ferias, barrios, fotos, actividades y tours. 115 lugares.

Stack: React 18 + Vite + TypeScript, MapLibre GL con mosaicos vectoriales de Protomaps/OpenStreetMap empaquetados en el sitio, iconos `lucide-react`. No hay backend: es un sitio estático que funciona en cualquier hosting con HTTPS (necesario para el GPS) y se instala como app (PWA) que funciona sin conexión.

## Sin conexión y app instalable

- `public/mapa/tiles.bin` + `tiles.idx.json`: mosaicos vectoriales de Buenos Aires (AMBA hasta zoom 12, Ciudad hasta zoom 15; MapLibre sobreamplía hasta 19), unos 15 MB. Los genera `node scripts/extraer-mapa.mjs [fecha]` a partir del build planetario diario de Protomaps (`https://build.protomaps.com/AAAAMMDD.pmtiles`). La app los lee con un protocolo propio (`ba://z/x/y`, en `src/lib/mapaOffline.ts`) mediante peticiones Range, así el archivo no se descarga entero al navegar.
- `public/mapa/fonts` y `public/mapa/sprites`: glifos y símbolos del estilo Protomaps "light", servidos localmente.
- Todas las fotos están en `public/fotos/` (`scripts/fotos-local.mjs` copia las que estaban en internet).
- Service worker (`src/sw.ts`, Workbox vía `vite-plugin-pwa`): precarga la app, fotos, fuentes y sprites, guarda `tiles.bin` completo al instalarse y responde los rangos desde la caché. La app avisa cuando todo quedó guardado. Se actualiza sola en cada visita con conexión.
- `manifest.webmanifest` e íconos en `public/icons/` (`scripts/iconos.mjs`): en el celular, "Agregar a la pantalla de inicio" instala la app a pantalla completa.
- `node scripts/prueba-offline.mjs <url> <carpeta>`: prueba automatizada con Chrome que carga la app, espera la caché, corta la red y verifica mapa, pines y fotos.

La ruta base del sitio es `/mapa-buenos-aires/` (GitHub Pages). Para otro hosting en la raíz: `BASE_PATH=/ npm run build`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5177/mapa-buenos-aires/
npm run build      # genera dist/ (incluye el service worker)
npm run preview    # sirve dist/ en http://localhost:4177/mapa-buenos-aires/
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
- `scripts/fotos-buscador.mjs <carpeta>`: último recurso, buscador de imágenes (DuckDuckGo). Descarga tres candidatas por lugar para revisarlas a ojo; con `--aplicar` copia la elegida (según `data/buscador.elegidas.json`) redimensionada a `public/fotos/<id>.jpg` y acredita el dominio de origen con enlace. Son fotos de terceros (prensa, guías, sitios de los locales), no libres.

Las fotos de Wikimedia y de sitios oficiales se muestran desde su origen (hotlink); las del buscador se guardan en `public/fotos/`. Revisar siempre a ojo: los buscadores devuelven logos, collages con marca de agua y lugares homónimos.

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
