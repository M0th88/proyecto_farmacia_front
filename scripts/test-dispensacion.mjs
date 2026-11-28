// Reglas de la dispensación asistencial: no se conecta a ninguna base de datos.
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
  dispensacionSchema,
  previsionSchema,
  problemaRecetaAsistencial,
  remesaSchema,
  textoPrevision,
  VIGENCIA_RECETA_DIAS,
} = load("../src/lib/validation/dispensacion.ts");

const hoy = "2026-11-27";
assert.equal(VIGENCIA_RECETA_DIAS, 180);
assert.equal(problemaRecetaAsistencial(hoy, hoy), null);
assert.equal(
  problemaRecetaAsistencial("2026-06-01", hoy),
  null,
  "dentro de 180 días",
);
assert.match(problemaRecetaAsistencial("2026-05-01", hoy), /más de 180 días/);
assert.match(problemaRecetaAsistencial("2026-11-28", hoy), /posterior a hoy/);

const base = {
  claveOperacion: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  pacienteRut: "11.111.111-1",
  programaId: 1,
  receta: {
    medicoRut: "12.345.678-5",
    medicoNombre: "Dra. Prueba",
    fecha: hoy,
  },
  items: [{ medicamentoId: 1, cantidad: 30 }],
};
const parse = (c = {}) => dispensacionSchema.safeParse({ ...base, ...c });
assert.ok(parse().success);
assert.match(
  parse({ pacienteRut: "11.111.111-2" }).error.issues[0].message,
  /RUT del paciente/,
);
assert.equal(parse({ items: [] }).success, false);
assert.equal(
  parse({ items: [{ medicamentoId: 1, cantidad: 1.5 }] }).success,
  false,
);
assert.equal(
  parse({ items: [{ medicamentoId: 1, cantidad: 0 }] }).success,
  false,
);
assert.ok(
  parse({
    retira: {
      rut: "12.345.678-5",
      nombre: "Hijo Prueba",
      parentesco: "Hijo/a",
    },
  }).success,
);
assert.match(
  parse({
    retira: {
      rut: "12.345.678-5",
      nombre: "Hijo Prueba",
      parentesco: "Vecino",
    },
  }).error.issues[0].message,
  /parentesco/,
);

const remesa = (c = {}) =>
  remesaSchema.safeParse({
    guia: "GD-1",
    items: [
      {
        medicamentoId: 1,
        numeroLote: "L1",
        fechaVencimiento: "2028-01-31",
        cantidad: 10,
        ubicacionId: 1,
      },
    ],
    ...c,
  });
assert.ok(remesa().success);
assert.equal(remesa().data.proveedor, "CENABAST");
assert.match(remesa({ guia: "" }).error.issues[0].message, /guía/);
assert.equal(remesa({ items: [] }).success, false);

// Previsión: el tramo se exige solo para Fonasa y se descarta en las demás.
assert.deepEqual(
  previsionSchema.parse({ prevision: "FONASA", tramoFonasa: "B" }),
  {
    prevision: "FONASA",
    tramoFonasa: "B",
  },
);
assert.match(
  previsionSchema.safeParse({ prevision: "FONASA" }).error.issues[0].message,
  /tramo Fonasa/,
);
assert.deepEqual(
  previsionSchema.parse({ prevision: "ISAPRE", tramoFonasa: "A" }),
  {
    prevision: "ISAPRE",
    tramoFonasa: "",
  },
);
assert.equal(previsionSchema.safeParse({ prevision: "OTRA" }).success, false);
assert.equal(textoPrevision("FONASA", "C"), "Fonasa tramo C");
assert.equal(textoPrevision("ISAPRE", null), "Isapre");
assert.equal(textoPrevision(null, null), "Previsión sin registrar");

console.log("Reglas de dispensación asistencial: OK");
