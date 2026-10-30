// Capturas de pantalla de la app con el Chrome instalado, emulando un celular y escritorio.
// Uso: node scripts/captura.mjs <url> <carpeta-salida>
import { chromium } from 'playwright-core';
import path from 'node:path';

const [url = 'http://localhost:4177/', salida = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });

async function capturar(nombre, opciones, acciones = async () => {}) {
  const ctx = await browser.newContext(opciones);
  const page = await ctx.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await acciones(page);
  await page.screenshot({ path: path.join(salida, `${nombre}.png`) });
  console.log(`${nombre}: ${errores.length ? errores.join(' | ') : 'sin errores'}`);
  await ctx.close();
}

const movil = { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
await capturar('movil-mapa', movil);
await capturar('movil-detalle', movil, async (page) => {
  await page.locator('.ficha').nth(2).scrollIntoViewIfNeeded();
  await page.locator('.ficha').nth(2).click();
  await page.waitForTimeout(1200);
});
await capturar('movil-lista', movil, async (page) => {
  await page.getByRole('button', { name: /Lista/ }).click();
  await page.waitForTimeout(800);
});
await capturar('escritorio', { viewport: { width: 1400, height: 900 } });
await browser.close();
