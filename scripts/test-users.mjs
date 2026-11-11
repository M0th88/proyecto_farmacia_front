// Pruebas HTTP de usuarios. Solo crea y elimina perfiles temporales propios.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const credentials = JSON.parse(input);
const base = process.env.LOGIN_TEST_URL ?? "http://localhost:3000";
const endpoint = "/api/privada/admin/usuarios";
const fixtures = new Set();
let adminCookie;
const nonce = Date.now().toString(36);
const fixturePassword = randomBytes(18).toString("base64url");

async function login(pharmacy, identifier, password) {
  const form = new FormData();
  form.set("identifier", identifier);
  form.set("password", password);
  const response = await fetch(`${base}/api/auth/${pharmacy}`, {
    method: "POST",
    headers: { origin: base },
    body: form,
  });
  return {
    response,
    cookie: response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`farmacia_${pharmacy}_session=`))
      ?.split(";")[0],
  };
}
async function api(method, path = endpoint, body, cookie = adminCookie) {
  const response = await fetch(base + path, {
    method,
    headers: {
      origin: base,
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, data: await response.json() };
}
function assertSafe(value) {
  if (!value || typeof value !== "object") return;
  assert.ok(
    !Object.hasOwn(value, "password"),
    "Se expuso el hash de contraseña.",
  );
  for (const child of Object.values(value)) assertSafe(child);
}

try {
  const signedIn = await login(
    "privada",
    credentials.identifier,
    credentials.password,
  );
  assert.equal(signedIn.response.status, 200);
  adminCookie = signedIn.cookie;
  const initial = await api("GET");
  assert.equal(initial.response.status, 200);
  assert.ok(Array.isArray(initial.data));
  assertSafe(initial.data);
  const baseline = initial.data.length;
  const admin = initial.data.find(
    (user) => user.email.toLowerCase() === credentials.identifier.toLowerCase(),
  );
  assert.ok(admin);
  for (const method of ["GET", "POST", "PATCH", "DELETE"])
    assert.equal(
      (await api(method, endpoint, method === "GET" ? undefined : {}, ""))
        .response.status,
      403,
    );
  const assist = await login(
    "asistencial",
    credentials.identifier,
    credentials.password,
  );
  assert.equal(
    (await api("GET", endpoint, undefined, assist.cookie)).response.status,
    403,
  );
  const roles = (await api("GET", "/api/privada/admin/roles")).data;
  const role = roles.find((item) => item.nombre !== "Administrador");
  assert.ok(role);
  for (const [index, name] of ["AA", "ZZ"].entries()) {
    const result = await api("POST", endpoint, {
      nombre: `${name} Tabla-${nonce}`,
      apellido: "Temporal",
      rut: `TEST-${nonce}-${index}`,
      email: `tabla-${nonce}-${index}@example.invalid`,
      telefono: `0000000${index}`,
      rolId: role.id,
      activo: true,
      password: fixturePassword,
    });
    assert.equal(result.response.status, 201);
    fixtures.add(result.data.id);
    assert.equal(result.data.telefono, `0000000${index}`);
    assert.ok(result.data.creadoEn && result.data.actualizadoEn);
    assertSafe(result.data);
  }
  const ids = [...fixtures];
  const query = new URLSearchParams({
    page: "0",
    pageSize: "1",
    search: `Tabla-${nonce}`,
    sort: "nombre",
    direction: "asc",
  });
  const first = await api("GET", `${endpoint}?${query}`);
  assert.equal(first.data.totalRows, 2);
  assert.equal(first.data.data.length, 1);
  assert.equal(first.data.nextPage, 1);
  assert.ok(first.data.data[0].nombre.startsWith("AA"));
  query.set("page", "1");
  const second = await api("GET", `${endpoint}?${query}`);
  assert.ok(second.data.data[0].nombre.startsWith("ZZ"));
  assert.equal(second.data.nextPage, null);
  query.set("page", "0");
  query.set("direction", "desc");
  assert.ok(
    (await api("GET", `${endpoint}?${query}`)).data.data[0].nombre.startsWith(
      "ZZ",
    ),
  );
  assert.equal((await api("GET", `${endpoint}?page=-1`)).response.status, 400);
  assert.equal(
    (await api("GET", `${endpoint}?page=0&sort=password`)).response.status,
    400,
  );
  assert.equal(
    (await api("PATCH", endpoint, { id: admin.id, activo: false })).response
      .status,
    400,
  );
  assert.equal(
    (await api("PATCH", endpoint, { id: admin.id, rolId: role.id })).response
      .status,
    400,
  );
  assert.equal(
    (await api("DELETE", endpoint, { id: admin.id })).response.status,
    400,
  );
  const updatedEmail = `tabla-${nonce}-editado@example.invalid`;
  const changed = await api("PATCH", endpoint, {
    id: ids[0],
    nombre: `AA Tabla-${nonce}`,
    apellido: "Editado",
    telefono: "123456789",
    email: updatedEmail,
    password: "",
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.data.apellido, "Editado");
  assert.equal(changed.data.telefono, "123456789");
  assertSafe(changed.data);
  const fixtureLogin = await login("privada", updatedEmail, fixturePassword);
  assert.equal(fixtureLogin.response.status, 200);
  assert.equal(
    (await api("GET", endpoint, undefined, fixtureLogin.cookie)).response
      .status,
    403,
  );
  const newPassword = randomBytes(18).toString("base64url");
  assert.equal(
    (await api("PATCH", endpoint, { id: ids[0], password: newPassword }))
      .response.status,
    200,
  );
  assert.equal(
    (await login("privada", updatedEmail, fixturePassword)).response.status,
    401,
  );
  assert.equal(
    (await login("privada", updatedEmail, newPassword)).response.status,
    200,
  );
  assert.equal(
    (await api("PATCH", endpoint, { id: ids[0], activo: false })).response
      .status,
    200,
  );
  assert.equal(
    (await login("privada", updatedEmail, newPassword)).response.status,
    401,
  );
  assert.equal(
    (await api("PATCH", endpoint, { id: ids[0], activo: true })).response
      .status,
    200,
  );
  const edit = await fetch(
    `${base}/privada/usuarios-y-roles/editar?usuario=${ids[0]}`,
    { headers: { cookie: adminCookie } },
  );
  assert.equal(edit.status, 200);
  const editHtml = await edit.text();
  assert.ok(editHtml.includes("Editar usuario:"));
  assert.ok(
    editHtml.includes("Permisos por vista") &&
      editHtml.includes("Crear un rol"),
    "No se conservó la gestión original.",
  );
  const table = await fetch(`${base}/privada/usuarios-y-roles`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(table.status, 200);
  const tableHtml = await table.text();
  assert.ok(
    tableHtml.includes("Usuarios y roles") && tableHtml.includes("Acciones"),
  );
  assert.ok(
    !tableHtml.includes("Permisos por vista"),
    "La gestión original sigue montada en la tabla.",
  );
  assert.equal(
    (await api("DELETE", endpoint, { id: ids[1] })).response.status,
    200,
  );
  fixtures.delete(ids[1]);
  console.log(
    "OK: tabla paginada, búsqueda, ordenación, alta y edición, teléfono y fechas, contraseña, estado, permisos, protección del administrador y gestión anterior conservada.",
  );
  for (const id of fixtures)
    assert.equal((await api("DELETE", endpoint, { id })).response.status, 200);
  fixtures.clear();
  assert.equal((await api("GET")).data.length, baseline);
} finally {
  for (const id of fixtures) {
    const result = await api("DELETE", endpoint, { id }).catch(() => null);
    if (!result?.response.ok)
      console.error(`No se pudo retirar el perfil temporal ${id}.`);
  }
}
