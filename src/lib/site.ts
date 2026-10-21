// Constantes del sitio, usadas por el layout maestro y los componentes JSON-LD.
//
// ⚖️ TODO LO QUE ES DE +CONTROL VIVE ACÁ. El código salió del sitio de Wincol
// (octubre 2026) y la lección que trae es que un ID ajeno olvidado en un rincón
// no falla: manda datos en silencio a la cuenta equivocada. Por eso los IDs de
// medición, el tenant de Arkco y los dominios están en este archivo y en ningún
// otro, y lo que todavía no existe va en `null` — apagado, no prestado.
//
// 🔶 PENDIENTE = dato que falta confirmar con el cliente antes de publicar.
export const SITE = {
  nombre: "+Control",
  razonSocial: "Multiservicios Más Control S.A.S.",
  descripcion: "Dotación, EPP y seguridad industrial para empresas.",
  // Dominio comprado en Namecheap (21/10/2026), apuntado a Vercel. De acá salen los canónicos, el sitemap, el
  // og:url y el JSON-LD.
  url: "https://www.multiserviciosmascontrol.com",
  // Dominios que pueden reportar a las plataformas de publicidad (ver
  // dominio.ts). Un preview de Vercel o `npm run dev` nunca mide.
  dominios: ["multiserviciosmascontrol.com"],
  // Dominios viejos que redirigen con 301 al principal (ver middleware.ts).
  dominiosViejos: [] as string[],

  logo: "/logo-color.svg", // usado como "logo" en el JSON-LD de Organization
  logoColor: "/logo-color.svg", // sobre fondos claros
  logoNegativo: "/logo-negativo.svg", // sobre Azul Mando

  // ☎️ EL TELÉFONO PARA LLAMAR. Sale en header, footer y contacto detrás de `tel:`.
  telefono: "321 392 0075",
  telefonoTel: "+573213920075",

  // 💬 EL WHATSAPP QUE ATIENDE ARKCO360 — sólo dígitos y con indicativo.
  // Separado del de llamar a propósito: en Wincol compartieron constante y los
  // pedidos del carrito terminaron en una línea sin bot.
  // Hoy es el mismo número de llamar (confirmado por el cliente, 21/10/2026).
  whatsapp: "573213920075",

  // Correo y dirección tomados del portafolio de servicios del cliente (2026).
  email: "mascontrol.sas.comercial@gmail.com",
  direccion: "Calle 64 #9A-14 Of. 102, Ed. Lebreles, Bogotá",
  envioGratisDesde: 300000,
  redes: {
    // Si es null se muestra como "próximamente" en el footer, no como link.
    instagram: null as string | null,
    facebook: null as string | null,
    linkedin: null as string | null,
    tiktok: null as string | null,
  },

  // 🧠 Arkco360: buscador por intención y widget del asesor.
  // 🔶 PENDIENTE: el tenant `mascontrol` hay que crearlo del lado de Arkco
  // (en su propio repo, no desde acá). Mientras no exista, el buscador cae al
  // propio sin que el comprador lo note.
  arkco: {
    api: "https://social-icons-platform-production.up.railway.app",
    tenant: "mascontrol",
    widget: true,
  },

  // 📊 Medición. `null` = apagado. NO poner acá los IDs de Wincol: esas cuentas
  // optimizan con lo que les llega.
  medicion: {
    // 🔶 PENDIENTE
    gtm: null as string | null,
    googleAds: null as string | null,
    conversionWhatsApp: null as string | null,
    conversionCarrito: null as string | null,
    conversionCompra: null as string | null,
    metaPixel: null as string | null,
    metaVerificacionDominio: null as string | null,
  },

  // Prefijo del código de atribución que viaja en el mensaje: MC-G-7K2M.
  prefijoRef: "MC",
} as const;
