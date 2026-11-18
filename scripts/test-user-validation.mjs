// Validation and API tests with simulated users; no real accounts are changed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const result = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name),
    result,
    result.exports,
  );
  return result.exports;
}
const validators = load("../src/lib/validation/user-fields.ts", {
  arktype: await import("arktype"),
});
const schemas = load("../src/lib/types/usuarios-y-roles.ts", {
  "@/lib/validation/user-fields": validators,
});
const { formatRut, mobilePhoneDigits } = load("../src/lib/user-input.ts");
assert.equal(formatRut("123456785"), "12.345.678-5");
assert.equal(formatRut("12.345.678-5"), "12.345.678-5");
assert.equal(formatRut("1234567k"), "1.234.567-K");
assert.equal(formatRut(""), "");
assert.equal(formatRut("1"), "1");
assert.equal(formatRut("12"), "1-2");
assert.equal(mobilePhoneDigits("+5691"), "1");
assert.equal(mobilePhoneDigits("+56912345678"), "12345678");
assert.equal(mobilePhoneDigits("12345678"), "12345678");
assert.equal(mobilePhoneDigits("+56 9 1234 5678"), "12345678");
assert.equal(mobilePhoneDigits("1234567890"), "12345678");
assert.equal(mobilePhoneDigits(""), "");
const profile = {
  nombre: "Prueba",
  apellido: "Temporal",
  rut: "12.345.678-5",
  email: "VALIDO@EXAMPLE.CL",
  telefono: "+56 9 1234 5678",
  rolId: 2,
  activo: true,
  password: "Clave1!a",
};
const parse = (changes) =>
  schemas.userCreateProfileSchema.safeParse({ ...profile, ...changes });
assert.equal(parse({}).success, true);
assert.equal(parse({}).data.email, "valido@example.cl");
assert.equal(parse({}).data.telefono, "+56912345678");
for (const rut of [
  "",
  "12345678-5",
  "12x345x678-5",
  "12.345.678-9",
  "00.000.000-0",
])
  assert.equal(parse({ rut }).success, false, rut);
let kBody = 1000000;
while (validators.rutCheckDigit(String(kBody)) !== "K") kBody++;
const kRut = `${String(kBody).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-k`;
assert.equal(parse({ rut: kRut }).data.rut.endsWith("-K"), true);
for (const email of [
  "",
  "sin-arroba",
  "persona@",
  "a b@example.cl",
  "a@@example.cl",
])
  assert.equal(parse({ email }).success, false, email);
for (const telefono of [
  "123",
  "123456789",
  "+1 555 123 4567",
  "9abcd1234",
  "+569123456789",
])
  assert.equal(parse({ telefono }).success, false, telefono);
for (const telefono of [
  "",
  "912345678",
  "56912345678",
  "+56 (9) 1234-5678",
  "221234567",
])
  assert.equal(parse({ telefono }).success, true, telefono);
for (const password of [
  "",
  "Aa1!",
  "abcdefgh1!",
  "ABCDEFGH1!",
  "Abcdefgh!",
  "Abcdefgh1",
  `Aa1!${"a".repeat(69)}`,
  `Aa1!${"ñ".repeat(35)}`,
])
  assert.equal(parse({ password }).success, false);
assert.equal(parse({ password: `Aa1!${"a".repeat(68)}` }).success, true);
assert.equal(
  schemas.userProfileSchema.safeParse({ ...profile, password: "" }).success,
  true,
  "Editing can retain the current password.",
);
let hashes = 0;
let admin = true;
const users = [];
const api = load("../src/app/api/privada/admin/usuarios/route.ts", {
  bcrypt: {
    default: {
      hash: async () => {
        hashes++;
        return "hash-simulado";
      },
    },
  },
  "@/lib/db/prisma-privada": {
    prismaPrivada: {
      rol: { findUnique: async () => ({ id: 2 }) },
      usuario: {
        create: async ({ data }) => {
          const user = {
            id: 10,
            ...data,
            rol: { nombre: "Bodega" },
            creadoEn: new Date(),
            actualizadoEn: new Date(),
          };
          users.push(user);
          return user;
        },
        findUnique: async () => users[0],
        update: async ({ data }) => {
          Object.assign(users[0], data);
          return users[0];
        },
      },
    },
  },
  "@/lib/private/admin": {
    privateAdmin: async () => (admin ? { id: 1, rolId: 1 } : null),
    noAdmin: () => Response.json({ error: "Acceso denegado" }, { status: 403 }),
  },
  "@/lib/private/users": {
    userSelect: {},
    serializeUser: (user) => {
      const safe = { ...user };
      delete safe.password;
      return safe;
    },
  },
  "@/lib/types/usuarios-y-roles": schemas,
});
const request = (method, data) =>
  new Request("http://localhost:3000/api/privada/admin/usuarios", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
for (const changes of [
  { rut: "12.345.678-9" },
  { email: "mal" },
  { telefono: "123" },
  { password: "debil" },
  { password: "" },
])
  assert.equal(
    (await api.POST(request("POST", { ...profile, ...changes }))).status,
    400,
  );
assert.equal(users.length, 0);
assert.equal(hashes, 0);
const created = await api.POST(request("POST", profile));
assert.equal(created.status, 201);
const data = await created.json();
assert.equal(data.telefono, "+56912345678");
assert.equal(data.email, "valido@example.cl");
assert.equal("password" in data, false);
assert.equal(hashes, 1);
assert.equal(
  (await api.PATCH(request("PATCH", { id: 10, telefono: "mal" }))).status,
  400,
);
assert.equal(
  (
    await api.PATCH(
      request("PATCH", { id: 10, telefono: "221234567", password: "" }),
    )
  ).status,
  200,
);
assert.equal(hashes, 1);
assert.equal(users[0].telefono, "+56221234567");
admin = false;
assert.equal((await api.POST(request("POST", profile))).status, 403);
let ownSession = { id: 10 };
let ownWrites = 0;
const ownApi = load("../src/app/api/privada/perfil/route.ts", {
  bcrypt: {
    default: {
      hash: async () => {
        hashes++;
        return "hash-propio";
      },
    },
  },
  "@/lib/auth/session": { getPrivateUser: async () => ownSession },
  "@/lib/db/prisma-privada": {
    prismaPrivada: {
      usuario: {
        update: async ({ where, data }) => {
          assert.equal(
            where.id,
            10,
            "Only the authenticated account may be updated.",
          );
          ownWrites++;
          Object.assign(users[0], data);
          return users[0];
        },
      },
    },
  },
  "@/lib/private/users": {
    userSelect: {},
    serializeUser: (user) => {
      const safe = { ...user };
      delete safe.password;
      return safe;
    },
  },
  "@/lib/types/usuarios-y-roles": schemas,
});
for (const change of [
  { id: 99, nombre: "Ajeno" },
  { rolId: 1 },
  { rol: { nombre: "Administrador" } },
  { activo: false },
]) {
  assert.equal((await ownApi.PATCH(request("PATCH", change))).status, 400);
}
assert.equal(ownWrites, 0);
assert.equal(
  (
    await ownApi.PATCH(
      request("PATCH", {
        nombre: "Mi perfil",
        telefono: "912345678",
        password: "",
      }),
    )
  ).status,
  200,
);
assert.equal(users[0].nombre, "Mi perfil");
assert.equal(users[0].rolId, 2);
assert.equal(users[0].activo, true);
assert.equal(hashes, 1, "An empty password preserves the current hash.");
assert.equal(
  (await ownApi.PATCH(request("PATCH", { password: "Nueva1!a" }))).status,
  200,
);
assert.equal(hashes, 2);
assert.equal(
  (await ownApi.PATCH(request("PATCH", { email: "invalido" }))).status,
  400,
);
ownSession = null;
assert.equal(
  (await ownApi.PATCH(request("PATCH", { nombre: "Sin sesión" }))).status,
  401,
);
console.log(
  "Usuarios: RUT y dígito verificador, correo, teléfono chileno, requisitos de contraseña, normalización y rechazo en API verificados.",
);
