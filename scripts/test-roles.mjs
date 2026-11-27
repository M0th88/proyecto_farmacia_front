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
let sessionUser = null;
const redirect = (path) => {
  throw new Error(path);
};
const { requirePharmacySection } = load(
  "../src/lib/auth/pharmacy-permissions.ts",
  {
    "server-only": {},
    "next/navigation": { redirect },
    "@/lib/private/permissions": permissions,
    "./session": {
      requirePharmacyUser: async (pharmacy) =>
        sessionUser ?? redirect(`/login/${pharmacy}`),
    },
  },
);
const routeDependencies = {
  "@/lib/auth/pharmacy-route": {
    pharmacyRoute: (handler) => (request) =>
      handler(request, "privada", {
        medicamento: { findMany: async () => [] },
        venta: { findMany: async () => [] },
      }),
  },
  "@/lib/auth/session": { getPharmacyUser: async () => sessionUser },
  "@/lib/private/permissions": permissions,
};
const catalog = load(
  "../src/app/api/[farmacia]/catalogo/route.ts",
  routeDependencies,
);
const sales = load("../src/app/api/[farmacia]/ventas/route.ts", {
  ...routeDependencies,
  "@/generated/privada/client": {},
  "@/lib/validation/punto-de-venta": load(
    "../src/lib/validation/punto-de-venta.ts",
    {
      "@/lib/user-input": load("../src/lib/user-input.ts"),
      "@/lib/validation/user-fields": load(
        "../src/lib/validation/user-fields.ts",
      ),
    },
  ),
});
async function salesStatus(method) {
  const response = await sales[method](
    new Request("http://localhost:3000/api/privada/ventas", { method }),
  );
  return response.status;
}
assert.equal((await catalog.GET()).status, 401);
assert.equal(await salesStatus("GET"), 401);

sessionUser = {
  rol: {
    nombre: "Bodega",
    permisos: ["inicio", "catalogo", "inventario", "proveedores", "compras"],
  },
};
for (const pharmacy of ["privada", "asistencial"]) {
  await requirePharmacySection(pharmacy, "/stocks-y-lotes");
  await requirePharmacySection(pharmacy, "/compras");
  await assert.rejects(
    requirePharmacySection(pharmacy, "/punto-de-venta"),
    new RegExp(`/${pharmacy}/sin-acceso`),
  );
  await assert.rejects(
    requirePharmacySection(pharmacy, "/caja-del-dia"),
    new RegExp(`/${pharmacy}/sin-acceso`),
  );
}
assert.equal((await catalog.GET()).status, 403);
assert.equal(await salesStatus("GET"), 403);
assert.equal(await salesStatus("POST"), 403);

sessionUser.rol = {
  nombre: "Cajero",
  permisos: ["inicio", "pos", "caja", "ventas"],
};
await requirePharmacySection("privada", "/punto-de-venta");
await requirePharmacySection("privada", "/caja-del-dia");
await assert.rejects(
  requirePharmacySection("privada", "/stocks-y-lotes"),
  /sin-acceso/,
);
assert.equal((await catalog.GET()).status, 200);
assert.equal(await salesStatus("GET"), 200);
assert.equal(await salesStatus("POST"), 400);

sessionUser.rol = { nombre: "Vendedor", permisos: ["pos"] };
assert.equal(await salesStatus("GET"), 403);
assert.equal(await salesStatus("POST"), 400);
sessionUser.rol.permisos = ["indicadores", "roles"];
await requirePharmacySection("privada", "/historial-y-reportes");
await assert.rejects(requirePharmacySection("privada", "/roles"), /sin-acceso/);
assert.equal(await salesStatus("POST"), 403);

sessionUser.rol = { nombre: "Administrador", permisos: [] };
await requirePharmacySection("privada", "/roles");
assert.equal(await salesStatus("GET"), 200);

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
    permisos: [],
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
const route = load("../src/app/api/[farmacia]/admin/roles/route.ts", {
  "@/lib/auth/pharmacy-route": {
    pharmacyRoute: (handler) => (request) =>
      handler(request, "privada", { rol: db }),
  },
  "@/lib/db/prisma-privada": { prismaPrivada: { rol: db } },
  "@/lib/private/admin": {
    pharmacyAdmin: async () => admin,
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
assert.deepEqual(
  (await api("GET")).data.find(({ id }) => id === 1).permisos,
  permissions.ALL_PRIVATE_PERMISSIONS,
);
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
  "Roles: permisos de vistas y API, filtros, paginación, creación, edición y eliminación verificados.",
);
