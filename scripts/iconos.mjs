// Genera los íconos de la app (PWA) a partir de un pin SVG: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
import fs from 'node:fs';
import sharp from 'sharp';

fs.mkdirSync('public/icons', { recursive: true });
const pin = (margen) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${margen ? 0 : 22}" fill="#14213d"/>
  <g transform="translate(${margen ? 22 : 16} ${margen ? 18 : 12}) scale(${margen ? 1.9 : 2.3})">
    <path d="M15 38c-.6 0-1.1-.3-1.4-.8C11.3 33.4 2 21.2 2 14.5 2 7.1 7.8 1 15 1s13 6.1 13 13.5c0 6.7-9.3 18.9-11.6 22.7-.3.5-.8.8-1.4.8Z" fill="#e6b85c" stroke="#fbf8f1" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="15" cy="14.5" r="6" fill="#fbf8f1"/>
  </g>
</svg>`;
await sharp(Buffer.from(pin(false))).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(pin(false))).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(pin(true))).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png');
await sharp(Buffer.from(pin(false))).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
console.log('íconos generados en public/icons/');
