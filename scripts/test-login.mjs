// Prueba HTTP del formulario real de Next. Credenciales por stdin, nunca en el repositorio.
import assert from "node:assert/strict";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { identifier, rut, password } = JSON.parse(input);
assert.ok(identifier && rut && password, "Entrega identifier, rut y password por stdin.");
const base = process.env.LOGIN_TEST_URL ?? "http://localhost:3000";
const decode = (text) => text.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x27;", "'");
function formFields(html) {
  const fields = new FormData();
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w$:-]+)="([^"]*)"/g)].map((item) => [item[1], decode(item[2])]));
    if (attributes.type === "hidden" && attributes.name) fields.set(attributes.name, attributes.value ?? "");
  }
  return fields;
}
async function submit(url, html, values, cookie = "") {
  const form = formFields(html);
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return fetch(base + url, { method: "POST", headers: { origin: base, referer: base + url, ...(cookie ? { cookie } : {}) }, body: form, redirect: "manual" });
}
async function login(pharmacy, value, remember = false, suppliedPassword = password) {
  const url = `/login/${pharmacy}`;
  const html = await (await fetch(base + url)).text();
  assert.match(html, /name="identifier"/);
  const result = await submit(`/api/auth/${pharmacy}`, html, { identifier: value, password: suppliedPassword, ...(remember ? { remember: "on" } : {}) });
  if (suppliedPassword !== password) {
    assert.equal(result.headers.get("set-cookie"), null);
    assert.equal(result.status, 401);
    assert.match((await result.json()).error, /incorrectos/);
    return;
  }
  assert.equal(result.status, 200, `Falló login de ${pharmacy}`);
  assert.equal((await result.json()).redirectTo, `/${pharmacy}`);
  const header = result.headers.getSetCookie().find((item) => item.startsWith(`farmacia_${pharmacy}_session=`));
  assert.ok(header);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=lax/i);
  assert.equal(/Max-Age=/i.test(header), remember);
  return header.split(";")[0];
}

for (const pharmacy of ["privada", "asistencial"]) {
  const denied = await (await fetch(`${base}/${pharmacy}`)).text();
  assert.match(denied, new RegExp(`/login/${pharmacy}`));
}
for (const route of ["catalogo", "ventas"]) {
  assert.equal((await fetch(`${base}/api/privada/${route}`)).status, 401);
}
assert.equal((await fetch(`${base}/api/auth/privada`, { method: "POST" })).status, 403);
assert.equal((await fetch(`${base}/api/auth/asistencial`, { method: "DELETE", headers: { origin: "https://otro-sitio.example" } })).status, 403);
assert.equal((await fetch(`${base}/api/privada/catalogo`, { headers: { cookie: "farmacia_privada_session=invalid-token" } })).status, 401);
assert.equal((await fetch(`${base}/api/privada/ventas`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 401);
await login("privada", identifier, false, "incorrect-password-for-test");
await login("asistencial", identifier, false, "incorrect-password-for-test");
const privateCookie = await login("privada", identifier.toUpperCase());
const assistCookie = await login("asistencial", rut, true);
const privateHtml = await (await fetch(`${base}/privada`, { headers: { cookie: privateCookie } })).text();
assert.match(privateHtml, /private-dashboard-card/);
const assistHtml = await (await fetch(`${base}/asistencial`, { headers: { cookie: assistCookie } })).text();
assert.match(assistHtml, /pharmacy-sidebar/);
assert.equal((await fetch(`${base}/api/privada/catalogo`, { headers: { cookie: privateCookie } })).status, 200);
assert.equal((await fetch(`${base}/api/privada/admin/roles`, { headers: { cookie: privateCookie } })).status, 200);
assert.equal((await fetch(`${base}/api/privada/catalogo`, { headers: { cookie: assistCookie } })).status, 401);
const spoofedCookie = privateCookie.replace("farmacia_privada_session=", "farmacia_asistencial_session=");
const spoofedHtml = await (await fetch(`${base}/asistencial`, { headers: { cookie: spoofedCookie } })).text();
assert.match(spoofedHtml, /\/login\/asistencial/);
assert.doesNotMatch(spoofedHtml, /id="pharmacy-sidebar"/);
await login("privada", rut.replace(/[.\s-]/g, ""));
await login("privada", rut);
await login("asistencial", identifier);
assert.match(privateHtml, /Opciones de Farmacia Privada/);
const combinedCookies = `${privateCookie}; ${assistCookie}`;
for (const pharmacy of ["privada", "asistencial"]) {
  const logout = await fetch(`${base}/api/auth/${pharmacy}`, { method: "DELETE", headers: { origin: base, cookie: combinedCookies } });
  assert.equal(logout.status, 200);
  const removed = logout.headers.getSetCookie().find((item) => item.startsWith(`farmacia_${pharmacy}_session=`));
  assert.ok(removed && /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(removed));
  const other = pharmacy === "privada" ? "asistencial" : "privada";
  assert.ok(!logout.headers.getSetCookie().some((item) => item.startsWith(`farmacia_${other}_session=`)));
}
console.log("OK: correo y RUT, errores, cookies persistentes, acceso protegido, administración, separación entre farmacias y cierre de sesión.");
