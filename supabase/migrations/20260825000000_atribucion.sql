-- Atribución de campañas pagas y captación de cotizaciones.
--
-- Contexto: el cierre de venta ocurre en WhatsApp (lo atiende Arkco360), fuera
-- del sitio. Sin estas dos tablas no hay forma de saber qué campaña generó qué
-- venta, y las plataformas terminan optimizando a clics baratos en vez de a
-- compradores mayoristas.
--
-- Mismo patrón que resenas y solicitudes_proveedor: RLS activo y sin policies.
-- Nadie escribe con la anon key; se inserta desde el servidor (endpoint de API
-- y Astro Actions) con service_role, y el panel admin lee igual.

-- ---------------------------------------------------------------------------
-- atribucion: una fila por intención de conversión (clic a WhatsApp, envío de
-- formulario). No es una fila por visita — eso sería un write por pageview y no
-- aportaría nada: solo interesan los momentos en que alguien decidió hablar.
-- ---------------------------------------------------------------------------
create table if not exists atribucion (
  id             uuid primary key default gen_random_uuid(),

  -- Código corto (WC-7K2M) que viaja dentro del mensaje de WhatsApp. Es la
  -- llave que el asesor ve en el chat y con la que después se cruza la venta.
  codigo         text not null,

  -- Nombre del evento de la capa de datos: whatsapp_pedido, whatsapp_consulta,
  -- generate_lead. Ver EVENTOS en src/lib/analytics.ts.
  evento         text not null,

  -- gclid / gbraid / wbraid / fbclid / li_fat_id / msclkid + UTM, tal como
  -- llegaron en la URL. De acá sale el identificador para subir la conversión
  -- sin conexión a Google Ads y a la API de conversiones de Meta.
  params         jsonb not null default '{}'::jsonb,

  landing        text,
  referrer       text,
  origen         text,          -- "pdp" | "carrito" | "drawer" | "cotizar" | …
  user_agent     text,

  -- Valor del carrito al momento del clic. Es una estimación, no una venta:
  -- la venta real se registra abajo cuando el asesor la cierra.
  valor_estimado numeric(12, 2),
  items          jsonb,

  -- Lo que completa el asesor/admin cuando la conversación termina en venta.
  -- Recién con esto cargado se puede subir la conversión con su valor real.
  venta_cerrada  boolean not null default false,
  venta_valor    numeric(12, 2),
  venta_fecha    timestamptz,
  subida_a_ads   boolean not null default false,
  notas          text,

  created_at     timestamptz not null default now()
);

-- El asesor busca por el código que lee en el chat: tiene que ser instantáneo.
create index if not exists idx_atribucion_codigo on atribucion (codigo);

-- Cola de trabajo del admin: ventas cerradas que todavía no se subieron a las
-- plataformas. Es la consulta que va a correr el panel todas las semanas.
create index if not exists idx_atribucion_pendientes_subida
  on atribucion (venta_fecha) where venta_cerrada and not subida_a_ads;

-- Reportes por fecha en el panel.
create index if not exists idx_atribucion_created_at on atribucion (created_at desc);

alter table atribucion enable row level security;

-- ---------------------------------------------------------------------------
-- cotizaciones: el formulario de /cotizar. Es la única vía por la que un
-- comprador puede dejar su solicitud fuera del horario de atención — hoy el
-- sitio no tiene ninguna.
-- ---------------------------------------------------------------------------
create table if not exists cotizaciones (
  id            uuid primary key default gen_random_uuid(),
  empresa       text not null,
  nombre        text not null,
  telefono      text not null,
  email         text,
  empleados     text,           -- rango, no número exacto: pedir precisión cuesta conversiones
  mensaje       text,

  -- Mismo código que la tabla de atribución, para poder unir la cotización con
  -- la campaña que la trajo.
  codigo        text,

  -- Ley 1581 de 2012: hay que poder demostrar cuándo y para qué se autorizó el
  -- tratamiento, no solo que se autorizó.
  autorizacion_datos boolean not null default false,
  autorizacion_ts    timestamptz,

  contactado    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_cotizaciones_pendientes
  on cotizaciones (created_at desc) where not contactado;

create index if not exists idx_cotizaciones_codigo on cotizaciones (codigo);

alter table cotizaciones enable row level security;
