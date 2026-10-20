import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { crearClienteServidor } from "../lib/supabase-server";
import { supabaseAdmin } from "../lib/supabase-admin";
import { requerirAdmin } from "../lib/admin-auth";
import { slugify } from "../lib/slug";
import { convertirYSubirImagen } from "../lib/imagenes";

export const server = {
  iniciarSesion: defineAction({
    accept: "form",
    input: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
    handler: async (input, context) => {
      const supabase = crearClienteServidor(context.cookies, context.request.headers);
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Email o contraseña incorrectos.",
        });
      }
    },
  }),

  cerrarSesion: defineAction({
    accept: "form",
    handler: async (_input, context) => {
      const supabase = crearClienteServidor(context.cookies, context.request.headers);
      await supabase.auth.signOut();
    },
  }),

  guardarProducto: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().uuid().optional(),
      sku: z.string().min(1, "El SKU es obligatorio"),
      nombre: z.string().min(1, "El nombre es obligatorio"),
      marca: z.string().max(80).optional(),
      precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
      categoria_id: z.string().optional(),
      descripcion_corta: z.string().optional(),
      descripcion_larga: z.string().optional(),
      activo: z.string().optional(), // "on" si el checkbox está marcado
      en_promocion: z.string().optional(), // "on" si el checkbox está marcado
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);

      // stock no se recibe: es la suma de producto_variantes, mantenida por
      // trigger (ver supabase/schema.sql) — se gestiona desde la sección
      // "Variantes" del admin, no desde este formulario.
      const payload = {
        sku: input.sku.trim(),
        nombre: input.nombre.trim(),
        slug: slugify(input.nombre),
        marca: (input.marca ?? "").trim() || null,
        precio: input.precio,
        categoria_id: input.categoria_id || null,
        descripcion_corta: (input.descripcion_corta ?? "").trim(),
        descripcion_larga: (input.descripcion_larga ?? "").trim(),
        activo: input.activo === "on",
        en_promocion: input.en_promocion === "on",
      };

      if (input.id) {
        const { error } = await supabaseAdmin.from("productos").update(payload).eq("id", input.id);
        if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
        return { id: input.id };
      }

      const { data, error } = await supabaseAdmin
        .from("productos")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
      return { id: data.id as string };
    },
  }),

  // 🪟 LA VITRINA (/admin/vitrina): prender y apagar sin entrar a editar.
  // Un solo campo por llamada y una lista de ids, para que el mismo camino sirva
  // al interruptor de una fila y a «ocultar los 14 seleccionados».
  // Sólo estos tres campos: precio o nombre no se tocan en masa desde acá.
  cambiarVitrina: defineAction({
    accept: "json",
    input: z.object({
      ids: z.array(z.string().uuid()).min(1).max(1000),
      campo: z.enum(["activo", "en_promocion", "destacado"]),
      valor: z.boolean(),
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error, count } = await supabaseAdmin
        .from("productos")
        .update({ [input.campo]: input.valor }, { count: "exact" })
        .in("id", input.ids);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
      return { actualizados: count ?? input.ids.length };
    },
  }),

  // Apagar una categoría la saca del menú y se lleva sus productos (lo resuelve
  // la política de lectura, ver la migración 20261020000000_vitrina.sql). Los
  // productos conservan su propio interruptor: al volver a prenderla, aparecen
  // exactamente los que estaban visibles antes.
  cambiarCategoriaActiva: defineAction({
    accept: "json",
    input: z.object({ id: z.string().uuid(), activa: z.boolean() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin
        .from("categorias")
        .update({ activa: input.activa })
        .eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  eliminarProducto: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      // Baja lógica, no hard-delete: la policy pública ya filtra activo=true.
      const { error } = await supabaseAdmin
        .from("productos")
        .update({ activo: false })
        .eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  // Borrado real e irreversible (a diferencia de eliminarProducto, que solo
  // oculta). Imágenes, variantes y reseñas del producto se van solas por
  // ON DELETE CASCADE (ver supabase/schema.sql) — no archivos en Storage.
  eliminarProductoDefinitivo: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("productos").delete().eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  subirImagenProducto: defineAction({
    accept: "form",
    input: z.object({
      producto_id: z.string().uuid(),
      sku: z.string().min(1),
      orden: z.coerce.number().int().min(0),
      archivo: z.instanceof(File),
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);

      const buffer = Buffer.from(await input.archivo.arrayBuffer());
      const url = await convertirYSubirImagen(
        supabaseAdmin,
        buffer,
        `${input.sku}/${input.orden}-${Date.now()}`
      );

      const { error } = await supabaseAdmin.from("producto_imagenes").insert({
        producto_id: input.producto_id,
        url,
        alt: null,
        orden: input.orden,
        es_principal: input.orden === 0,
      });
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
      return { url };
    },
  }),

  eliminarImagenProducto: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("producto_imagenes").delete().eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  // Talla/color con su propio stock. productos.stock se recalcula solo vía
  // trigger (ver supabase/schema.sql), así que acá no se toca esa columna.
  guardarVariante: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().uuid().optional(),
      producto_id: z.string().uuid(),
      talla: z.string().min(1, "La talla es obligatoria"),
      color: z.string().min(1, "El color es obligatorio"),
      stock: z.coerce.number().int().min(0, "El stock no puede ser negativo"),
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);

      const payload = {
        producto_id: input.producto_id,
        talla: input.talla.trim(),
        color: input.color.trim(),
        stock: input.stock,
      };

      if (input.id) {
        const { error } = await supabaseAdmin
          .from("producto_variantes")
          .update(payload)
          .eq("id", input.id);
        if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
        return { id: input.id };
      }

      const { data, error } = await supabaseAdmin
        .from("producto_variantes")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
      return { id: data.id as string };
    },
  }),

  eliminarVariante: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("producto_variantes").delete().eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  guardarCategoria: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().uuid().optional(),
      nombre: z.string().min(1, "El nombre es obligatorio"),
      marca: z.string().max(80).optional(),
      // Portada opcional: al crear una categoría, evita el paso aparte de
      // "subir portada" que antes solo existía para categorías ya creadas.
      archivo: z.instanceof(File).optional(),
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const slug = slugify(input.nombre);
      const payload = { nombre: input.nombre.trim(), slug };

      let imagenUrl: string | undefined;
      if (input.archivo && input.archivo.size > 0) {
        const buffer = Buffer.from(await input.archivo.arrayBuffer());
        imagenUrl = await convertirYSubirImagen(supabaseAdmin, buffer, `categorias/${slug}-${Date.now()}`);
      }

      if (input.id) {
        const { error } = await supabaseAdmin
          .from("categorias")
          .update({ ...payload, ...(imagenUrl ? { imagen_url: imagenUrl } : {}) })
          .eq("id", input.id);
        if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
        return { id: input.id };
      }

      const { data, error } = await supabaseAdmin
        .from("categorias")
        .insert({ ...payload, ...(imagenUrl ? { imagen_url: imagenUrl } : {}) })
        .select("id")
        .single();
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
      return { id: data.id as string };
    },
  }),

  subirImagenCategoria: defineAction({
    accept: "form",
    input: z.object({
      categoria_id: z.string().uuid(),
      slug: z.string().min(1),
      archivo: z.instanceof(File),
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);

      const buffer = Buffer.from(await input.archivo.arrayBuffer());
      const url = await convertirYSubirImagen(supabaseAdmin, buffer, `categorias/${input.slug}-${Date.now()}`);

      const { error } = await supabaseAdmin
        .from("categorias")
        .update({ imagen_url: url })
        .eq("id", input.categoria_id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
      return { url };
    },
  }),

  eliminarCategoria: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);

      const { count, error: errorConteo } = await supabaseAdmin
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", input.id);
      if (errorConteo) throw new ActionError({ code: "BAD_REQUEST", message: errorConteo.message });
      if (count && count > 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `No se puede borrar: ${count} producto(s) usan esta categoría.`,
        });
      }

      const { error } = await supabaseAdmin.from("categorias").delete().eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  // Pública (sin requerirAdmin): cualquier visitante puede dejar una reseña,
  // pero queda "aprobada: false" hasta que el admin la revise — así no aparece
  // en el sitio en vivo sin moderación.
  crearResena: defineAction({
    accept: "form",
    input: z.object({
      producto_id: z.string().uuid(),
      autor_nombre: z.string().min(1, "Tu nombre es obligatorio").max(80),
      calificacion: z.coerce.number().int().min(1).max(5),
      comentario: z.string().max(1000).optional(),
    }),
    handler: async (input) => {
      const { error } = await supabaseAdmin.from("resenas").insert({
        producto_id: input.producto_id,
        autor_nombre: input.autor_nombre.trim(),
        calificacion: input.calificacion,
        comentario: (input.comentario ?? "").trim() || null,
        aprobada: false,
      });
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  // Para que el admin cargue reseñas propias (demo/muestra social) ya aprobadas.
  agregarResenaAdmin: defineAction({
    accept: "form",
    input: z.object({
      producto_id: z.string().uuid(),
      autor_nombre: z.string().min(1, "El nombre es obligatorio").max(80),
      calificacion: z.coerce.number().int().min(1).max(5),
      comentario: z.string().max(1000).optional(),
    }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("resenas").insert({
        producto_id: input.producto_id,
        autor_nombre: input.autor_nombre.trim(),
        calificacion: input.calificacion,
        comentario: (input.comentario ?? "").trim() || null,
        aprobada: true,
      });
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  aprobarResena: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("resenas").update({ aprobada: true }).eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  eliminarResena: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("resenas").delete().eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  // Pública (sin requerirAdmin): cualquier empresa puede postularse como
  // proveedor desde /proveedores. El admin la revisa y marca "contactado"
  // desde /admin/proveedores — mismo patrón que crearResena.
  crearSolicitudProveedor: defineAction({
    accept: "form",
    input: z.object({
      empresa: z.string().min(1, "El nombre de la empresa es obligatorio").max(150),
      contacto_nombre: z.string().min(1, "El nombre de contacto es obligatorio").max(100),
      email: z.string().email("Ingresa un email válido"),
      telefono: z.string().min(1, "El teléfono es obligatorio").max(30),
      categoria_productos: z.string().min(1, "Cuéntanos qué productos ofreces").max(150),
      mensaje: z.string().max(1000).optional(),
    }),
    handler: async (input) => {
      const { error } = await supabaseAdmin.from("solicitudes_proveedor").insert({
        empresa: input.empresa.trim(),
        contacto_nombre: input.contacto_nombre.trim(),
        email: input.email.trim(),
        telefono: input.telefono.trim(),
        categoria_productos: input.categoria_productos.trim(),
        mensaje: (input.mensaje ?? "").trim() || null,
        contactado: false,
      });
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  marcarProveedorContactado: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin
        .from("solicitudes_proveedor")
        .update({ contactado: true })
        .eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),

  eliminarSolicitudProveedor: defineAction({
    accept: "form",
    input: z.object({ id: z.string().uuid() }),
    handler: async (input, context) => {
      await requerirAdmin(context);
      const { error } = await supabaseAdmin.from("solicitudes_proveedor").delete().eq("id", input.id);
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });
    },
  }),
};
