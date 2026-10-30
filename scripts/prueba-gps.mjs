// Prueba del GPS: abre la app con una ubicación simulada (dentro y fuera de Buenos Aires) y captura el resultado.
// Uso: node scripts/prueba-gps.mjs <url> <carpeta-capturas>
import { chromium } from 'playwright-core';
import path from 'node:path';

const [url = 'http://localhost:4177/mapa-buenos-aires/', salida = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function caso(nombre, geo) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: geo, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => ({
    puntoAzul: !!document.querySelector('.yo__punto'),
    etiqueta: document.querySelector('.yo__etiqueta')?.textContent,
    toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '),
    distanciasEnFichas: document.querySelectorAll('.ficha__dist').length,
  }));
  console.log(`${nombre}: ${JSON.stringify(info)}${errores.length ? ' ERRORES: ' + errores.join(' | ') : ''}`);
  await page.screenshot({ path: path.join(salida, `gps-${nombre}.png`) });
  await ctx.close();
}

await caso('en-plaza-de-mayo', { latitude: -34.6083, longitude: -58.3722, accuracy: 25 });
await caso('en-santiago-de-chile', { latitude: -33.4489, longitude: -70.6693, accuracy: 40 });
await browser.close();
