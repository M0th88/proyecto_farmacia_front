// Route tests with an isolated in-memory database; no real accounts are changed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}
const permissions = load("../src/lib/private/permissions.ts");
const { roleProfileSchema } = load("../src/lib/types/roles.ts", {
  "@/lib/private/permissions": permissions,
});
const requiredFields = roleProfileSchema.safeParse({
  nombre: "",
  descripcion: "   ",
  permisos: ["inicio"],
});
assert.equal(requiredFields.success, false);
assert.deepEqual(
  requiredFields.error.issues.map((issue) => issue.message),
  ["Debe ingresar un nombre", "Debe ingresar una descripción"],
);
let admin = true;
let nextId = 4;
const rows = [
  {
    id: 1,
    nombre: "Administrador",
    descripcion: "Administración",
    permisos: permissions.ALL_PRIVATE_PERMISSIONS,
    _count: { usuarios: 1 },
  },
  {
    id: 2,
    nombre: "Bodega",
    descripcion: "Recepción",
    permisos: ["inventario"],
    _count: { usuarios: 2 },
  },
  {
    id: 3,
    nombre: "Vendedor",
    descripcion: "Mostrador",
    permisos: ["catalogo", "pos"],
    _count: { usuarios: 0 },
  },
];
const db = {
  findMany: async () => structuredClone(rows),
  findUnique: async ({ where }) =>
    structuredClone(rows.find((row) => row.id === where.id) ?? null),
  create: async ({ data }) => {
    if (rows.some((row) => row.nombre === data.nombre))
      throw new Error("duplicate");
    const row = { id: nextId++, ...data, _count: { usuarios: 0 } };
    rows.push(row);
    return structuredClone(row);
  },
  update: async ({ where, data }) => {
    if (rows.some((row) => row.id !== where.id && row.nombre === data.nombre))
      throw new Error("duplicate");
    const row = rows.find((item) => item.id === where.id);
    Object.assign(
      row,
      Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ),
    );
    return structuredClone(row);
  },
  delete: async ({ where }) => {
    rows.splice(
      rows.findIndex((row) => row.id === where.id),
      1,
    );
  },
};
const route = load("../src/app/api/privada/admin/roles/route.ts", {
  "@/lib/db/prisma-privada": { prismaPrivada: { rol: db } },
  "@/lib/private/admin": {
    privateAdmin: async () => admin,
    noAdmin: () => Response.json({ error: "Forbidden" }, { status: 403 }),
  },
  "@/lib/private/permissions": permissions,
});
async function api(method, body, query = "") {
  const response = await route[method](
    new Request(`http://localhost:3000/api/privada/admin/roles${query}`, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    }),
  );
  return { status: response.status, data: await response.json() };
}

admin = false;
for (const method of ["GET", "POST", "PATCH", "DELETE"])
  assert.equal(
    (await api(method, method === "GET" ? undefined : { id: 3 })).status,
    403,
  );
admin = true;
assert.equal((await api("GET")).data.length, 3);
const page = await api(
  "GET",
  undefined,
  "?page=0&pageSize=2&sort=usuarios&direction=desc",
);
assert.deepEqual(
  page.data.data.map((row) => row.id),
  [2, 1],
);
assert.equal(page.data.nextPage, 1);
assert.equal(
  (await api("GET", undefined, "?page=1&pageSize=2")).data.nextPage,
  null,
);
assert.equal(
  (await api("GET", undefined, "?page=0&search=recepcion")).data.totalRows,
  1,
);
assert.ok(
  (await api("GET", undefined, "?page=0&search=productos")).data.data.some(
    (row) => row.id === 3,
  ),
);
assert.equal((await api("GET", undefined, "?page=-1")).status, 400);
assert.equal(
  (await api("GET", undefined, "?page=0&search=sin-coincidencias")).data
    .totalRows,
  0,
);
for (const permission of ["usuarios", "roles"]) {
  assert.equal(
    (await api("POST", { nombre: "Prueba", permisos: [permission] })).status,
    400,
  );
  assert.equal(
    (await api("PATCH", { id: 3, permisos: [permission] })).status,
    400,
  );
}
assert.equal(
  (await api("POST", { nombre: "Administrador", permisos: ["inicio"] })).status,
  400,
);
assert.equal(
  (await api("POST", { nombre: "Prueba", permisos: [] })).status,
  400,
);
const created = await api("POST", {
  nombre: "Comprador",
  descripcion: "a".repeat(500),
  permisos: ["compras", "compras"],
});
assert.equal(created.status, 201);
for (const descripcion of [undefined, "", "   "]) {
  assert.equal(
    (
      await api("POST", {
        nombre: "Sin descripción",
        descripcion,
        permisos: ["inicio"],
      })
    ).status,
    400,
  );
}
assert.equal(
  (
    await api("PATCH", {
      id: created.data.id,
      descripcion: "   ",
      permisos: ["inicio"],
    })
  ).status,
  400,
);
assert.equal(created.data.descripcion.length, 500);
assert.equal(
  (
    await api("POST", {
      nombre: "Descripción larga",
      descripcion: "a".repeat(501),
      permisos: ["inicio"],
    })
  ).status,
  400,
);
assert.equal(
  (
    await api("PATCH", {
      id: created.data.id,
      descripcion: "a".repeat(501),
      permisos: ["inicio"],
    })
  ).status,
  400,
);
assert.deepEqual(created.data.permisos, ["compras"]);
assert.equal(
  (
    await api("POST", {
      nombre: "Comprador",
      descripcion: "Duplicado",
      permisos: ["inicio"],
    })
  ).status,
  409,
);
const updated = await api("PATCH", {
  id: created.data.id,
  nombre: "Abastecimiento",
  descripcion: "Stock",
  permisos: ["inventario"],
});
assert.equal(updated.status, 200);
assert.equal(updated.data.nombre, "Abastecimiento");
assert.equal(updated.data.descripcion, "Stock");
assert.equal((await api("PATCH", { id: 1, permisos: ["inicio"] })).status, 400);
assert.equal(
  (await api("PATCH", { id: 3, nombre: "Bodega", permisos: ["inicio"] }))
    .status,
  409,
);
assert.equal((await api("DELETE", { id: 1 })).status, 409);
assert.equal((await api("DELETE", { id: 2 })).status, 409);
const inUseRole = await api("PATCH", {
  id: 2,
  descripcion: "Recepción actualizada",
  permisos: ["inventario", "compras"],
});
assert.equal(inUseRole.status, 200);
assert.equal(inUseRole.data._count.usuarios, 2);
assert.deepEqual(inUseRole.data.permisos, ["inventario", "compras"]);
assert.equal((await api("DELETE", { id: 2 })).status, 409);
assert.equal((await api("DELETE", { id: 999 })).status, 404);
assert.equal((await api("DELETE", { id: created.data.id })).status, 200);
assert.equal(rows.length, 3);
console.log(
  "Roles: acceso, filtros, paginación, creación, edición y eliminación verificados.",
);
