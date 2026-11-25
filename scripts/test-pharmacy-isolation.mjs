import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, deps = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  );
  const mod = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => (Object.hasOwn(deps, name) ? deps[name] : require(name)),
    mod,
    mod.exports,
  );
  return mod.exports;
}

process.env.JWT_SECRET = "test-only-pharmacy-session-secret-42";
process.env.SUPERADMIN_EMAIL = "admin@example.test";
process.env.SUPERADMIN_RUT = "12.345.678-5";
const pharmacyNames = load("../src/lib/auth/pharmacies.ts");
const password = "Test-Only-Password!";
const hash = bcrypt.hashSync(password, 4);
const admin = {
  id: 10,
  rut: "12345678-5",
  email: "admin@example.test",
  activo: true,
  password: hash,
  rol: { nombre: "Administrador" },
};
const shared = {
  ...admin,
  id: 3,
  rut: "11.111.111-1",
  email: "legacy@example.test",
};
const catalogs = {
  privada: [
    admin,
    shared,
    { ...admin, id: 2, email: "privada@example.test", rut: "22222222-2" },
  ],
  asistencial: [
    { ...admin, id: 8, rut: "12.345.678-5" },
    shared,
    { ...admin, id: 2, email: "asistencial@example.test", rut: "33333333-3" },
  ],
};
function matches(user, where) {
  if (where.OR) return where.OR.some((item) => matches(user, item));
  if (where.id) return user.id === where.id;
  return Object.entries(where).every(
    ([field, filter]) =>
      user[field].toLowerCase() === filter.equals.toLowerCase(),
  );
}
const clients = Object.fromEntries(
  Object.entries(catalogs).map(([pharmacy, users]) => [
    pharmacy,
    {
      usuario: {
        findUnique: async ({ where }) =>
          users.find((user) => matches(user, where)),
        findFirst: async ({ where }) =>
          users.find((user) => matches(user, where)),
      },
      rows: [],
    },
  ]),
);
const db = { pharmacyDb: (pharmacy) => clients[pharmacy] };
const identities = load("../src/lib/auth/identity.ts", {
  "server-only": {},
  "@/lib/db/pharmacy-db": db,
});
assert.equal(identities.isSuperAdmin(admin), true);
assert.equal(
  identities.isSuperAdmin({ ...admin, email: "otro@example.test" }),
  false,
);
assert.equal(
  identities.isSuperAdmin({ ...admin, rol: { nombre: "Cajero" } }),
  false,
);
assert.equal(
  await identities.identityExistsInOtherPharmacy("privada", shared),
  true,
);

const deps = {
  "server-only": {},
  "@/lib/db/pharmacy-db": db,
  "./identity": identities,
  "./pharmacies": pharmacyNames,
};
const { checkCredentials } = load("../src/lib/auth/credentials.ts", deps);
assert.deepEqual(
  await checkCredentials("privada", "admin@example.test", password),
  { userId: 10 },
);
assert.deepEqual(
  await checkCredentials("asistencial", "12345678-5", password),
  { userId: 8 },
);
assert.ok(
  (await checkCredentials("asistencial", "admin@example.test", "wrong")).error,
);
assert.ok(
  (await checkCredentials("asistencial", "privada@example.test", password))
    .error,
);
assert.ok(
  (await checkCredentials("privada", "asistencial@example.test", password))
    .error,
);
assert.deepEqual(
  await checkCredentials("asistencial", "asistencial@example.test", password),
  { userId: 2 },
);
assert.ok(
  (await checkCredentials("asistencial", "legacy@example.test", password))
    .error,
);
assert.deepEqual(
  await checkCredentials("privada", "legacy@example.test", password),
  { userId: 3 },
);

const cookies = new Map();
const session = load("../src/lib/auth/session.ts", {
  ...deps,
  react: { cache: (fn) => fn },
  "next/headers": { cookies: async () => cookies },
  "next/server": { connection: async () => {} },
  jsonwebtoken: jwt,
});
const privateToken = session.createSessionToken("privada", 2, false);
cookies.set("farmacia_privada_session", { value: privateToken });
cookies.set("farmacia_asistencial_session", { value: privateToken });
assert.equal(
  (await session.getPharmacyUser("privada")).email,
  "privada@example.test",
);
assert.equal(await session.getPharmacyUser("asistencial"), null);
cookies.set("farmacia_asistencial_session", {
  value: session.createSessionToken("asistencial", 3, false),
});
assert.equal(await session.getPharmacyUser("asistencial"), null);

const { pharmacyRoute } = load("../src/lib/auth/pharmacy-route.ts", deps);
const handler = pharmacyRoute(async (request, pharmacy, client) => {
  client.rows.push(await request.text());
  return Response.json({ pharmacy }, { status: 201 });
});
const request = new Request("http://localhost:3000/api/asistencial/productos", {
  method: "POST",
  body: "asistencial",
});
assert.equal(
  (
    await handler(request, {
      params: Promise.resolve({ farmacia: "asistencial" }),
    })
  ).status,
  201,
);
assert.equal(
  (await handler(request, { params: Promise.resolve({ farmacia: "otra" }) }))
    .status,
  404,
);
assert.deepEqual(clients.privada.rows, []);
assert.deepEqual(clients.asistencial.rows, ["asistencial"]);
console.log(
  "Farmacias: identidades, sesiones y operaciones aisladas verificadas.",
);
