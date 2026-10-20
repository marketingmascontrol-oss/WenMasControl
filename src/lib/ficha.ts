// Ficha técnica a partir de la descripción del producto.
//
// El catálogo heredado de Wincol trae casi todas las descripciones cortas como
// pares «Etiqueta: valor.» (152 de 158 al copiarlo): «Marca: Blue Dress.
// Acabado: … Calidad: …». Wincol las muestra como un párrafo corrido; acá se
// leen como lo que son, una ficha, y de ahí sale también la marca cuando el
// campo `marca` viene vacío (155 de 158).
//
// Si un texto no tiene ese formato, no se fuerza nada: vuelve entero en `resto`
// y la ficha queda vacía.

export interface DatoFicha {
  etiqueta: string;
  valor: string;
}

export interface Ficha {
  datos: DatoFicha[];
  resto: string;
}

// Una etiqueta es corta y empieza con mayúscula: «Marca», «Uso», «Material
// exterior». Más larga que eso ya es una frase con dos puntos, no un dato.
const PAR = /^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü/ ]{1,28}):\s*(.+)$/;

export function leerFicha(texto: string | null | undefined): Ficha {
  if (!texto) return { datos: [], resto: "" };

  const datos: DatoFicha[] = [];
  const resto: string[] = [];

  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia) continue;
    const m = limpia.match(PAR);
    if (m) {
      datos.push({ etiqueta: m[1].trim(), valor: m[2].trim().replace(/\.$/, "") });
    } else {
      resto.push(limpia);
    }
  }

  // Un solo «par» suelto dentro de un párrafo suele ser casualidad («Nota: …»),
  // no una ficha.
  if (datos.length < 2) return { datos: [], resto: texto.trim() };
  return { datos, resto: resto.join("\n") };
}

/** La marca del producto: el campo propio, o la que dice su ficha. */
export function marcaDe(producto: { marca: string | null; descripcion_corta: string | null }): string | null {
  if (producto.marca?.trim()) return producto.marca.trim();
  const dato = leerFicha(producto.descripcion_corta).datos.find((d) => /^marca$/i.test(d.etiqueta));
  if (!dato) return null;
  // «Blue Dress (Edición Especial)» → «Blue Dress»; «Genérico / Industrial» no es marca.
  const valor = dato.valor.replace(/\s*\(.*\)\s*$/, "").trim();
  return /gen[eé]rico/i.test(valor) ? null : valor;
}

/** «PANTALON  EN JEAN» → «Pantalón en jean»: la subcategoría como filtro legible. */
export function rotuloSubcategoria(sub: string | null): string | null {
  const limpia = sub?.replace(/\s+/g, " ").trim();
  if (!limpia) return null;
  const minus = limpia.toLocaleLowerCase("es-CO");
  return minus.charAt(0).toLocaleUpperCase("es-CO") + minus.slice(1);
}
