import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` relativo para que el build funcione en GitHub Pages (subcarpeta /repo/) y en cualquier hosting estático.
export default defineConfig({
  plugins: [react()],
  base: './',
});
