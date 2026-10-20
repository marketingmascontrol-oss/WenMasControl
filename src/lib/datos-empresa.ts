import type { DatosEmpresa } from "./whatsapp";

// Empresa, NIT y ciudad que el comprador escribe en el pedido. Se recuerdan en
// este navegador para el próximo pedido; es una comodidad, no un registro: si
// el almacenamiento está bloqueado, el pedido sale igual sin esos datos.
const CLAVE = "mc:empresa";

export function leerDatosEmpresa(): DatosEmpresa {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as DatosEmpresa) : {};
  } catch {
    return {};
  }
}

export function guardarDatosEmpresa(datos: DatosEmpresa): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    /* sin almacenamiento: se pierde la comodidad, no el pedido */
  }
}
