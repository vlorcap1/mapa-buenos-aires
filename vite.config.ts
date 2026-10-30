import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Ruta base: en GitHub Pages el sitio vive en /mapa-buenos-aires/. Para otro hosting: BASE_PATH=/ npm run build
const base = process.env.BASE_PATH ?? '/mapa-buenos-aires/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // Todo lo que la app necesita sin conexión, salvo tiles.bin, que el service worker guarda aparte (es grande y se lee por rangos).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,pbf,json,jpg,webp}'],
        globIgnores: ['**/tiles.bin'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      manifest: {
        name: 'Turista en Buenos Aires',
        short_name: 'Turista BA',
        description: 'Mapa turístico de Buenos Aires con GPS que funciona sin conexión: atracciones, museos, parques, cafés, bares y restaurantes.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf8f1',
        theme_color: '#14213d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
