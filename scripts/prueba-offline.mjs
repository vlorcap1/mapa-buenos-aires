// Prueba de uso sin conexión: carga la app con red, espera a que el service worker guarde todo,
// corta la red, recarga y verifica que el mapa, los pines y las fotos sigan funcionando.
// Uso: node scripts/prueba-offline.mjs <url> <carpeta-capturas>
import { chromium } from 'playwright-core';
import path from 'node:path';

const [url = 'http://localhost:4177/mapa-buenos-aires/', salida = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
console.log('1. carga con red: ok');

// Esperar a que el SW esté activo y el paquete de mosaicos guardado.
// (waitForFunction con una función async resolvería de inmediato porque una promesa es "verdadera": se sondea a mano)
let guardado = false;
for (let i = 0; i < 120 && !guardado; i++) {
  guardado = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active || reg.active.state !== 'activated' || !navigator.serviceWorker.controller) return false; // activo y controlando esta página
    const cache = await caches.open('mapa-tiles-v1');
    return !!(await cache.match(new URL('mapa/tiles.bin', reg.scope).href));
  });
  if (!guardado) await page.waitForTimeout(1000);
}
console.log(`2. service worker activo y mosaicos en caché: ${guardado ? 'ok' : 'NO'}`);
const claves = await page.evaluate(async () => {
  const nombres = await caches.keys();
  const out = {};
  for (const n of nombres) out[n] = (await (await caches.open(n)).keys()).length;
  return out;
});
console.log('   cachés:', JSON.stringify(claves));

console.log('   controlador:', await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? 'ninguno'));

// Sin red: recargar y comprobar.
await ctx.setOffline(true);
for (const rel of ['', 'index.html', 'mapa/tiles.idx.json']) {
  const r = await page.evaluate(async (u) => { try { const res = await fetch(u); return `${res.status} ${res.headers.get('content-type') ?? ''}`; } catch (e) { return `ERROR ${e.message}`; } }, url + rel);
  console.log(`   fetch sin red ${rel || '/'} → ${r}`);
}
const rango = await page.evaluate(async (u) => { try { const res = await fetch(u + 'mapa/tiles.bin', { headers: { Range: 'bytes=0-9' } }); return `${res.status} ${res.headers.get('content-range')} ${(await res.arrayBuffer()).byteLength} bytes`; } catch (e) { return `ERROR ${e.message}`; } }, url);
console.log(`   fetch sin red tiles.bin (rango 0-9) → ${rango}`);
await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('   carga sin red:', e.message.split('\n')[0]));
await page.waitForTimeout(6000);
const resultado = await page.evaluate(() => {
  const pines = document.querySelectorAll('.pin').length;
  const canvas = document.querySelector('.maplibregl-canvas');
  let pintado = false;
  if (canvas) {
    // el mapa pintó algo si el lienzo no es de un solo color
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const px = new Uint8Array(4 * 400);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 10, Math.floor(gl.drawingBufferHeight / 2) - 10, 20, 20, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const primero = px.slice(0, 3).join(',');
      for (let i = 0; i < px.length; i += 4) if (px.slice(i, i + 3).join(',') !== primero) { pintado = true; break; }
    }
  }
  const fotos = [...document.querySelectorAll('.ficha__foto img')].slice(0, 5);
  const fotosOk = fotos.filter((i) => i.complete && i.naturalWidth > 0).length;
  const etiquetas = document.querySelectorAll('.maplibregl-canvas').length;
  return { pines, canvas: !!canvas, pintado, fotos: `${fotosOk}/${fotos.length}`, lienzos: etiquetas };
});
console.log('3. sin red →', JSON.stringify(resultado));
await page.screenshot({ path: path.join(salida, 'offline-mapa.png') });
await page.locator('.ficha').first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(salida, 'offline-detalle.png') });
console.log(errores.length ? `errores de consola: ${errores.slice(0, 5).join(' | ')}` : 'sin errores de consola');
await browser.close();
