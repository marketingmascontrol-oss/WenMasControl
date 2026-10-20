export function formatearPrecio(precio: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(precio);
}

// Los nombres del catálogo heredado vienen en MAYÚSCULAS («BOTA ARGYLL SAFETY
// CINTA AMARILLA»). En tarjetas y fichas se muestran en formato título, que
// se lee más rápido y se ve menos gritado. Se respetan las siglas y medidas
// (PVC, N95, 3M, 60X90, C/P) y los conectores van en minúscula.
const CONECTORES = new Set(["de", "del", "en", "con", "para", "y", "o", "la", "el", "los", "las", "a", "al", "por", "sin", "x"]);

export function nombreLegible(nombre: string): string {
  // Si casi todo viene en minúscula, alguien lo escribió así a propósito. Los
  // que tienen una minúscula suelta («GUANTE i38», «CAMISA JEAN Economica»)
  // siguen siendo nombres en mayúsculas.
  const letras = nombre.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const mayusculas = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length;
  if (!letras || mayusculas / letras.length < 0.7) return nombre;

  return nombre
    .split(/(\s+)/)
    .map((original, i) => {
      if (!original.trim()) return original;
      // «i38»: una minúscula pegada a un número la puso el fabricante.
      if (/^[a-z]\d+$/.test(original)) return original;
      const palabra = original.toLocaleLowerCase("es-CO");
      // Siglas y medidas: con dígitos o barras, o de 2–3 letras que no son conectores.
      if (/[\d/]/.test(palabra) || (palabra.length <= 3 && !CONECTORES.has(palabra) && /^[a-zñ]+$/.test(palabra))) {
        return original.toLocaleUpperCase("es-CO");
      }
      if (i > 0 && CONECTORES.has(palabra)) return palabra;
      // La primera letra, aunque la palabra empiece con un paréntesis: «(Tyveck)».
      return palabra.replace(/[a-záéíóúñü]/, (l) => l.toLocaleUpperCase("es-CO"));
    })
    .join("");
}
