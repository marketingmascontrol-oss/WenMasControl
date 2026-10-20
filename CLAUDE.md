# WEB +CONTROL — memoria operativa del proyecto
> Creado el 20/10/2026. Dueño: Ruben (Social Icons S.A.S.). Cliente: Multiservicios Más Control S.A.S.

## Qué es
Tienda B2B de dotación y EPP de **+Control**. Astro 5 (server) + Supabase + Vercel.
**Nació como copia del sitio de Wincol** (`~/SocialIcons/Wincol/websiteWincol`)
con las mismas capacidades y otra cara: catálogo con variantes, carrito que
termina en WhatsApp (sin pasarela), buscador por intención de Arkco360, widget
del asesor, código de atribución en cada mensaje, feeds de Google y Meta, y el
panel `/admin`.

## 🔴 Dos clientes, dos de todo
- **Base propia.** Supabase de +Control, NO la de Wincol. El catálogo se copió
  una vez con `npm run copiar-wincol`; desde ahí cada uno va por su lado.
- **Medición propia.** Todos los IDs (GTM, Google Ads, píxel de Meta,
  verificación de dominio) viven en `src/lib/site.ts → SITE.medicion` y en
  `null` están **apagados**. Nunca poner los de Wincol: esas cuentas optimizan
  con lo que les llega, y un dato ajeno no da error, ensucia en silencio.
- **Arkco propio.** Tenant `mascontrol` (`SITE.arkco`). Se crea del lado de
  Arkco360, en su repo. Mientras no exista, el buscador cae solo al propio.
- Código de atribución: `MC-G-7K2M` (prefijo en `SITE.prefijoRef`), cookies `mc_ref`/`mc_attr`.

## 🪟 La vitrina — `/admin/vitrina`
El cliente prende y apaga lo que se muestra: producto (`activo`), promoción
(`en_promocion`), home (`destacado`) y categoría entera (`categorias.activa`).
**La regla vive en la política RLS** (`supabase/migrations/20261020000000_vitrina.sql`),
no en las consultas: todo lo público lee con la anon key, así que lo apagado
desaparece a la vez del sitio, el buscador, los feeds y `/api/*` que consulta Arkco.
⚠️ No filtrar visibilidad «a mano» en consultas nuevas creyendo que hace falta,
ni leer lo público con service role: eso saltaría la regla.

## 🎨 Identidad
Manual en `../manual-mascontrol/` (y el PDF al lado). Tokens en `src/styles/global.css`:
la escala `brand-*` es el **Azul Mando #181C37**; el **Rojo Señal #DE0A16** va
aparte (`senal`) y sólo como acento, <10% de la pieza, nunca de fondo ni
formando una cruz (Ley 875 de 2004). Inter Tight. La franja plata (`.franja-plata`)
es borde inferior, nunca relleno. Logos: `public/logo-color.svg`, `logo-negativo.svg`,
`simbolo-*.svg` — se usan los originales, no se redibujan.
Textura de fondo (hero, banda de cotizar, casilla del mosaico): `public/textura-hero.webp`,
generada con `node scripts/recursos/generar-textura-hero.mjs` — se cambia ahí, no a mano.
Los nombres del catálogo vienen en MAYÚSCULAS: en pantalla pasan por `nombreLegible()` (`lib/formato.ts`).

## Lo que +Control tiene y Wincol no (para que no vuelvan a parecerse)
- **Pedido por tallas** en la ficha (`pdp/PedidoPorTallas.astro`): todas las
  tallas con su stock y cantidades de una, en vez de talla → color → agregar.
- **Ficha técnica** leída de la descripción «Etiqueta: valor» (`lib/ficha.ts`);
  la marca sale de ahí cuando `productos.marca` está vacío.
- **Filtros en la categoría** (tipo, marca, en bodega, orden), en el navegador.
- **Armador de dotación por oficio** en el hero (`lib/kits.ts`): kits definidos
  por SKU, se arman con lo visible en la Vitrina (anon key) y se cotizan por
  WhatsApp para N trabajadores. ⚠️ No hay arnés en el catálogo heredado.
- Todo lo que entra al carrito pasa por `lib/agregar-medido.ts` (agrega + mide).
- **Encabezado de una sola barra** con el menú «Catálogo» desplegable con fotos
  (no la fila de categorías de Wincol) y el botón «Su pedido» con el valor.
- **Panel del pedido** agrupado por producto con sus tallas, barra de envío
  gratis y datos de empresa opcionales (empresa, NIT, ciudad) que se suman al
  mensaje de WhatsApp después del total. Las líneas «• Nx … (SKU: …)» del
  mensaje NO cambiaron: el bot las lee.
- ⚠️ `sub_categoria` viene sucia del catálogo de Wincol (p. ej. «CAPUCHON» en
  guantes y tapones): por eso sólo se usa como filtro, no como rótulo visible.

## Heredado de Wincol que sigue valiendo
Leer el `CLAUDE.md` de Wincol para el porqué de: las cinco puertas a WhatsApp
(todas deben llevar el código, las del servidor sin depender del JS), que el
píxel y Ads NO van también en GTM, `content_ids` = SKU, y que ventas/leads viven
en Arkco360 y no se construyen pantallas para eso acá.

## Pendientes antes de publicar (marcados 🔶 en `site.ts`)
Dominio, teléfono, WhatsApp del bot, correo, redes, IDs de medición, tenant de
Arkco, imagen OG 1200×630, SKUs con «WINCOL» y fotos con el logo de Wincol en el catálogo.
