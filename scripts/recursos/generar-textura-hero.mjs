// Genera public/textura-hero.webp: la textura del hero (y de la banda de
// cotizar). Cuadrícula técnica tipo plano + grano + un barrido plata en
// diagonal, en Azul Mando. Se genera en vez de usar una foto de banco: es
// propia, pesa poco y no compite con el LCP en el celular.
// Uso: node scripts/recursos/generar-textura-hero.mjs
import sharp from "sharp";

const W = 1920, H = 1080;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <pattern id="fina" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#C9CDD6" stroke-opacity="0.09" stroke-width="1"/>
    </pattern>
    <pattern id="gruesa" width="120" height="120" patternUnits="userSpaceOnUse">
      <rect width="120" height="120" fill="url(#fina)"/>
      <path d="M120 0H0V120" fill="none" stroke="#C9CDD6" stroke-opacity="0.20" stroke-width="1"/>
      <path d="M0 0l6 0M0 0l0 6" stroke="#C9CDD6" stroke-opacity="0.45" stroke-width="1.5"/>
    </pattern>
    <radialGradient id="foco" cx="0.72" cy="0.38" r="0.75">
      <stop offset="0" stop-color="#2B3157"/>
      <stop offset="0.55" stop-color="#181C37"/>
      <stop offset="1" stop-color="#0E1022"/>
    </radialGradient>
    <linearGradient id="barrido" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0.30" stop-color="#C9CDD6" stop-opacity="0"/>
      <stop offset="0.50" stop-color="#C9CDD6" stop-opacity="0.16"/>
      <stop offset="0.70" stop-color="#C9CDD6" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="mascara" cx="0.6" cy="0.45" r="0.8">
      <stop offset="0" stop-color="#fff"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.15"/>
    </radialGradient>
    <mask id="m"><rect width="${W}" height="${H}" fill="url(#mascara)"/></mask>
    <filter id="grano">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.12"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#foco)"/>
  <rect width="${W}" height="${H}" fill="url(#gruesa)" mask="url(#m)"/>
  <rect width="${W}" height="${H}" fill="url(#barrido)"/>
  <rect width="${W}" height="${H}" filter="url(#grano)"/>
</svg>`;

await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile("public/textura-hero.webp");
const { size } = await import("node:fs").then((fs) => fs.statSync("public/textura-hero.webp"));
console.log(`public/textura-hero.webp · ${Math.round(size / 1024)} KB`);
