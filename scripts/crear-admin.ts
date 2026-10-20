/**
 * Crea (o actualiza la contraseña de) un usuario del panel /admin.
 *
 * Entrar al panel pide DOS cosas: un usuario en Supabase Auth y que su correo
 * esté en ADMIN_EMAILS (ver src/lib/admin-auth.ts). Este script hace lo
 * primero y avisa si falta lo segundo, que es el olvido típico: el usuario
 * existe, la contraseña es correcta y el panel igual lo rechaza.
 *
 * Uso:
 *   npm run crear-admin -- correo@empresa.com 'contraseña-larga'
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Uso: npm run crear-admin -- correo@empresa.com 'contraseña'");
  process.exit(1);
}
if (password.length < 10) {
  console.error("La contraseña debe tener al menos 10 caracteres.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");

const supabase = createClient(url, clave, { auth: { persistSession: false } });

const { data: lista, error: errorLista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (errorLista) throw errorLista;
const existente = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existente) {
  const { error } = await supabase.auth.admin.updateUserById(existente.id, { password });
  if (error) throw error;
  console.log(`✓ Contraseña actualizada para ${email}`);
} else {
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log(`✓ Usuario creado: ${email}`);
}

const permitidos = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
if (!permitidos.includes(email.toLowerCase())) {
  console.warn(`⚠️ ${email} NO está en ADMIN_EMAILS: el panel lo va a rechazar.`);
  console.warn("   Agrégalo en .env y en las variables de entorno de Vercel.");
}
