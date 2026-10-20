// Genera las fotos de fondo a partir de scripts/recursos/foto-bodega-original.png
// (1983×793, trabajador de pie a la derecha, entre el 60 y el 80 % del ancho).
//
// - Hero: la foto entera EN ESPEJO, para que el trabajador quede a la
//   izquierda; la derecha del hero la ocupa el armador de dotación y lo
//   taparía. (Probado primero con sólo la mitad izquierda: sin el trabajador
//   la foto no se entendía.)
// - Banda antes del footer: la foto entera, con el trabajador a la vista.
//
// Uso: node scripts/recursos/generar-fotos-bodega.mjs
import sharp from "sharp";
import fs from "node:fs";

const ORIGEN = "scripts/recursos/foto-bodega-original.png";
fs.mkdirSync("public/fotos", { recursive: true });

const salidas = [
  { nombre: "hero-bodega", espejo: true, anchos: [1983, 1000] },
  { nombre: "banda-bodega", espejo: false, anchos: [1983, 1000] },
];

for (const s of salidas) {
  for (const ancho of s.anchos) {
    let img = sharp(ORIGEN);
    if (s.espejo) img = img.flop();
    const destino = `public/fotos/${s.nombre}-${ancho}.webp`;
    await img.resize({ width: ancho }).webp({ quality: 72 }).toFile(destino);
    console.log(destino, Math.round(fs.statSync(destino).size / 1024) + " KB");
  }
}
