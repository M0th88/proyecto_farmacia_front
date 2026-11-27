// Reglas de recetas del POS: no se conecta a ninguna base de datos.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path) {
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
    (name) =>
      name === "@/lib/validation/user-fields"
        ? load("../src/lib/validation/user-fields.ts")
        : require(name),
    result,
    result.exports,
  );
  return result.exports;
}

const {
  esControlado,
  problemaReceta,
  recetaCubre,
  recetaRequerida,
  recetaSchema,
} = load("../src/lib/validation/recetas.ts");

const hoy = "2026-11-26";
const base = {
  tipo: "CHEQUE",
  origen: "FISICA",
  folio: "CH-0001",
  pacienteRut: "11.111.111-1",
  pacienteNombre: "Paciente Prueba",
  medicoRut: "12.345.678-5",
  medicoNombre: "Médica Prueba",
  fechaEmision: "2026-11-20",
  vigenteHasta: "2026-12-15",
};
const parse = (cambios = {}) => recetaSchema.safeParse({ ...base, ...cambios });

// Receta exigida por el carrito: gana la más estricta.
assert.equal(recetaRequerida(["VENTA_DIRECTA"]), null);
assert.equal(recetaRequerida(["VENTA_DIRECTA", "RECETA_SIMPLE"]), "SIMPLE");
assert.equal(
  recetaRequerida(["RECETA_SIMPLE", "RECETA_CHEQUE", "RECETA_RETENIDA"]),
  "CHEQUE",
);
assert.equal(recetaRequerida(["SIN_CLASIFICAR"]), null);
assert.ok(recetaCubre("CHEQUE", "SIMPLE"));
assert.ok(recetaCubre("RETENIDA", "RETENIDA"));
assert.ok(!recetaCubre("SIMPLE", "RETENIDA"));
assert.ok(esControlado("RECETA_CHEQUE") && esControlado("RECETA_RETENIDA"));
assert.ok(!esControlado("RECETA_SIMPLE"));

// Esquema: RUT con dígito verificador, folio obligatorio, vigencia máxima.
assert.ok(parse().success);
assert.equal(
  parse({ pacienteRut: "11.111.111-1" }).data.pacienteRut,
  "11.111.111-1",
);
assert.equal(parse({ medicoRut: "12.345.678-k" }).success, false);
assert.match(
  parse({ pacienteRut: "11.111.111-2" }).error.issues[0].message,
  /RUT del paciente.*dígito verificador/,
);
assert.match(parse({ folio: "" }).error.issues[0].message, /exigen folio/);
assert.ok(parse({ tipo: "SIMPLE", folio: "" }).success);
assert.match(
  parse({ vigenteHasta: "2026-11-19" }).error.issues[0].message,
  /antes de la emisión/,
);
assert.match(
  parse({ vigenteHasta: "2027-01-30" }).error.issues[0].message,
  /vigencia máxima de 30 días/,
);
assert.ok(
  parse({
    tipo: "SIMPLE",
    fechaEmision: "2026-06-01",
    vigenteHasta: "2026-11-27",
  }).success,
);
assert.equal(parse({ pacienteNombre: "A" }).success, false);

// Validación contra el día y lo que exige el carrito.
const ok = parse().data;
assert.equal(problemaReceta(undefined, null, hoy), null);
assert.match(problemaReceta(undefined, "SIMPLE", hoy), /exigen receta simple/);
assert.match(
  problemaReceta(parse({ tipo: "SIMPLE" }).data, "CHEQUE", hoy),
  /no basta/,
);
assert.equal(problemaReceta(ok, "CHEQUE", hoy), null);
assert.equal(problemaReceta(ok, "SIMPLE", hoy), null);
assert.match(
  problemaReceta(
    parse({ fechaEmision: "2026-11-27", vigenteHasta: "2026-12-01" }).data,
    "CHEQUE",
    hoy,
  ),
  /posterior a hoy/,
);
assert.match(
  problemaReceta(
    parse({ fechaEmision: "2026-10-01", vigenteHasta: "2026-10-31" }).data,
    "CHEQUE",
    hoy,
  ),
  /vencida/,
);
assert.equal(
  problemaReceta(parse({ vigenteHasta: hoy }).data, "CHEQUE", hoy),
  null,
  "la receta es válida durante todo su último día",
);
assert.match(
  problemaReceta(parse({ medicoRut: base.pacienteRut }).data, "CHEQUE", hoy),
  /médico no puede ser el paciente/,
);

console.log("Reglas de recetas: OK");
