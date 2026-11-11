import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import ts from "typescript";

// El archivo TypeScript se analiza como datos; nunca se ejecuta ni se importan sus módulos.
function readPreloaded(source) {
  const tree = ts.createSourceFile("preloadedMedications.ts", source, ts.ScriptTarget.Latest, true);
  let entries;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "PRELOADED_MEDICATIONS") {
      if (!node.initializer || !ts.isArrayLiteralExpression(node.initializer)) throw new Error("Se esperaba una lista de medicamentos.");
      entries = node.initializer.elements.map((element) => {
        if (!ts.isObjectLiteralExpression(element)) throw new Error("Entrada de medicamento inválida.");
        const record = {};
        for (const property of element.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) throw new Error("Solo se admiten campos de texto en el catálogo TypeScript.");
          const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
          if (!key) throw new Error("Nombre de campo inválido.");
          record[key] = property.initializer.text;
        }
        return record;
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!entries?.length) throw new Error("No se encontró PRELOADED_MEDICATIONS.");
  return entries;
}

const normalize = (value) => (value ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
const required = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Falta ${label}.`);
  return value.trim();
};
const optional = (value) => value == null ? null : required(value, "campo de texto");

async function loadCatalog() {
  const folder = new URL("./data/", import.meta.url);
  const catalog = JSON.parse(await readFile(new URL("base_datos_medicamentos_chile.json", folder), "utf8"));
  const preloaded = readPreloaded(await readFile(new URL("preloadedMedications.source.txt", folder), "utf8"));
  if (!Array.isArray(catalog.medicamentos) || catalog.medicamentos.length !== catalog.totalMedicamentos) throw new Error("El total del JSON no coincide con sus entradas.");
  const sourceEntries = new Map();
  for (const entry of preloaded) {
    const id = required(entry.id, "id TypeScript");
    required(entry.name, `nombre de ${id}`);
    required(entry.activeIngredient, `principio activo de ${id}`);
    if (sourceEntries.has(id)) throw new Error(`ID duplicado en TypeScript: ${id}`);
    sourceEntries.set(id, entry);
  }
  const merged = new Map();
  for (const entry of catalog.medicamentos) {
    const id = required(entry.id, "id JSON");
    if (merged.has(id)) throw new Error(`ID duplicado en JSON: ${id}`);
    const original = sourceEntries.get(id);
    const nombre = required(entry.medicamento, `nombre de ${id}`);
    const principioActivo = required(entry.principioActivo, `principio activo de ${id}`);
    if (original && (normalize(nombre) !== normalize(original.name) || normalize(principioActivo) !== normalize(original.activeIngredient))) throw new Error(`Los archivos discrepan sobre la identidad de ${id}.`);
    merged.set(id, {
      codigoCatalogo: id,
      nombre,
      principioActivo,
      concentracion: optional(entry.productoISP?.concentracionPotencia),
      formaFarmaceutica: optional(entry.productoISP?.formaFarmaceutica),
      categoria: optional(entry.clasificacion?.grupoGeneral),
      datosCatalogo: { esquema: catalog.esquema, pais: catalog.pais, fechaRevision: catalog.fechaRevision, ...entry, preloaded: original ?? null },
    });
  }
  for (const entry of preloaded) {
    if (merged.has(entry.id)) continue;
    merged.set(entry.id, {
      codigoCatalogo: entry.id, nombre: entry.name, principioActivo: entry.activeIngredient,
      concentracion: null, formaFarmaceutica: null, categoria: null,
      datosCatalogo: { preloaded: entry },
    });
  }
  const rows = [...merged.values()];
  const identities = new Set();
  for (const row of rows) {
    const key = [row.nombre, row.principioActivo, row.concentracion, row.formaFarmaceutica].map(normalize).join("|");
    if (identities.has(key)) throw new Error(`Medicamento duplicado con distintos IDs: ${row.nombre}`);
    identities.add(key);
  }
  return { rows, jsonEntries: catalog.medicamentos.length, tsEntries: preloaded.length, matched: preloaded.filter((entry) => catalog.medicamentos.some((item) => item.id === entry.id)).length };
}

async function importPrivate(rows) {
  if (!process.env.DATABASE_URL_PRIVADA) throw new Error("Falta DATABASE_URL_PRIVADA.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_PRIVADA, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(90110901)");
    const before = await client.query('SELECT COUNT(*)::int AS total FROM "Medicamento"');
    let created = 0;
    let linked = 0;
    let unchanged = 0;
    for (const row of rows) {
      const found = await client.query('SELECT * FROM "Medicamento" WHERE "codigoCatalogo" = $1', [row.codigoCatalogo]);
      if (found.rows.length) {
        if (JSON.stringify(found.rows[0].datosCatalogo) !== JSON.stringify(row.datosCatalogo)) {
          // JSONB cambia el orden de claves; la comparación se realiza dentro de PostgreSQL.
          const equal = await client.query('SELECT "datosCatalogo" = $1::jsonb AS same FROM "Medicamento" WHERE id = $2', [JSON.stringify(row.datosCatalogo), found.rows[0].id]);
          if (!equal.rows[0].same) throw new Error(`El catálogo ${row.codigoCatalogo} ya existe con datos diferentes; no se sobrescribió.`);
        }
        unchanged++;
        continue;
      }
      const candidates = await client.query('SELECT * FROM "Medicamento" WHERE "codigoCatalogo" IS NULL');
      const matches = candidates.rows.filter((item) => ["nombre", "principioActivo", "concentracion", "formaFarmaceutica"].every((field) => normalize(item[field]) === normalize(row[field])));
      if (matches.length > 1) throw new Error(`Hay varios registros existentes para ${row.nombre}; revisa los duplicados antes de importar.`);
      let categoriaId = null;
      if (row.categoria) {
        const category = await client.query('INSERT INTO "CategoriaMedicamento" (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id', [row.categoria]);
        categoriaId = category.rows[0].id;
      }
      if (matches.length) {
        await client.query('UPDATE "Medicamento" SET "codigoCatalogo" = $1, "datosCatalogo" = $2::jsonb, "categoriaId" = COALESCE("categoriaId", $3), "actualizadoEn" = NOW() WHERE id = $4', [row.codigoCatalogo, JSON.stringify(row.datosCatalogo), categoriaId, matches[0].id]);
        linked++;
      } else {
        await client.query('INSERT INTO "Medicamento" ("codigoCatalogo", "datosCatalogo", nombre, "principioActivo", concentracion, "formaFarmaceutica", "categoriaId", "actualizadoEn") VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, NOW())', [row.codigoCatalogo, JSON.stringify(row.datosCatalogo), row.nombre, row.principioActivo, row.concentracion, row.formaFarmaceutica, categoriaId]);
        created++;
      }
    }
    const after = await client.query('SELECT COUNT(*)::int AS total FROM "Medicamento"');
    const imported = await client.query('SELECT COUNT(*)::int AS total FROM "Medicamento" WHERE "codigoCatalogo" = ANY($1::text[])', [rows.map((row) => row.codigoCatalogo)]);
    if (imported.rows[0].total !== rows.length || after.rows[0].total !== before.rows[0].total + created) throw new Error("La verificación final de cantidades falló.");
    await client.query("COMMIT");
    return { base: "privada", before: before.rows[0].total, created, linked, unchanged, after: after.rows[0].total, verified: imported.rows[0].total };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--dry-run", "--apply"].includes(arg)) || args.includes("--dry-run") && args.includes("--apply")) throw new Error("Uso: node prisma/import-medications.mjs [--dry-run | --apply]");
  const { rows, ...summary } = await loadCatalog();
  console.log(JSON.stringify({ ...summary, uniqueMedications: rows.length, withoutPresentation: rows.filter((row) => !row.concentracion || !row.formaFarmaceutica).length, sourceFolder: fileURLToPath(new URL("./data/", import.meta.url)) }, null, 2));
  if (args.includes("--apply")) console.log(JSON.stringify(await importPrivate(rows), null, 2));
  else console.log("Validación completada; no se modificó la base de datos. Usa --apply para cargar Farmacia Privada.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
