import "dotenv/config";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcrypt";
import pg from "pg";

async function hiddenPassword() {
  if (!stdin.isTTY)
    throw new Error("Ejecuta este comando en una terminal interactiva.");
  stdout.write("Contraseña del administrador (mínimo 12 caracteres): ");
  return await new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (chunk) => {
      const key = chunk.toString();
      if (key === "\u0003") {
        stdin.setRawMode(false);
        stdin.off("data", onData);
        reject(new Error("Cancelado."));
        return;
      }
      if (key === "\r" || key === "\n") {
        stdin.setRawMode(false);
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (key === "\u007f" || key === "\b") value = value.slice(0, -1);
      else if (key >= " " && key.length === 1) value += key;
    };
    stdin.on("data", onData);
  });
}

const rl = createInterface({ input: stdin, output: stdout });
const nombre = (await rl.question("Nombre: ")).trim();
const rut = (await rl.question("RUT: ")).trim();
const email = (await rl.question("Correo: ")).trim().toLowerCase();
rl.close();
const password = await hiddenPassword();
if (!nombre || !rut || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12)
  throw new Error(
    "Completa nombre, RUT, correo válido y contraseña de 12 caracteres o más.",
  );
if (!process.env.DATABASE_URL_PRIVADA)
  throw new Error("Falta DATABASE_URL_PRIVADA.");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_PRIVADA,
});
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(67981341)");
  const count = await client.query(
    'SELECT count(*)::int AS total FROM "Usuario" u JOIN "Rol" r ON r.id = u."rolId" WHERE r.nombre = $1',
    ["Administrador"],
  );
  if (count.rows[0].total > 0)
    throw new Error(
      "Ya existe un administrador. Crea perfiles desde la aplicación.",
    );
  const role = await client.query('SELECT id FROM "Rol" WHERE nombre = $1', [
    "Administrador",
  ]);
  if (!role.rows.length)
    throw new Error(
      "Aplica primero la migración de roles: npm run prisma:deploy:privada",
    );
  const hash = await bcrypt.hash(password, 12);
  await client.query(
    'INSERT INTO "Usuario" (rut,nombre,email,password,activo,"rolId","creadoEn","actualizadoEn") VALUES ($1,$2,$3,$4,true,$5,NOW(),NOW())',
    [rut, nombre, email, hash, role.rows[0].id],
  );
  await client.query("COMMIT");
  stdout.write(
    "Administrador privado creado. Podrá acceder cuando se integre el login.\n",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
