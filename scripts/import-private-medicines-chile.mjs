import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const records = JSON.parse(await readFile(new URL("../prisma/data/medicamentos-chile.json", import.meta.url), "utf8"));
if (!Array.isArray(records) || records.length !== 45 || new Set(records.map(r => r.codigoCatalogo)).size !== records.length) {
  throw new Error("El catálogo integrado debe contener 45 códigos únicos.");
}
if (!process.env.DATABASE_URL_PRIVADA) throw new Error("Falta DATABASE_URL_PRIVADA en .env.");

const columns = [
  "grupoGeneral", "subgrupoFarmacologico", "mecanismoResumido", "atcArchivo",
  "productoIspEjemplo", "nombreFantasia", "laboratorioTitular", "registroIsp",
  "estadoIsp", "fuenteIsp", "observaciones", "condicionVentaIsp",
  "concentracionEjemplo", "formaFarmaceuticaEjemplo", "viaAdministracion",
  "tipoAlmacenamiento", "condicionAlmacenamiento",
];
const blank = value => typeof value !== "string" || !value.trim() || /^(Pendiente de verificaci[oó]n|Por definir|Sin nombre de fantas[ií]a identificado)$/i.test(value.trim()) ? null : value.trim();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_PRIVADA });
await client.connect();
try {
  await client.query("BEGIN");
  let created = 0;
  for (const record of records) {
    if (!/^MED-\d{3}$/.test(record.codigoCatalogo) || !blank(record.nombre)) throw new Error(`Fila inválida: ${record.codigoCatalogo}`);
    const atc = /^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(record.codigoAtc ?? "") ? record.codigoAtc : null;
    const result = await client.query(
      `INSERT INTO "Medicamento" ("codigoCatalogo", "nombre", "principioActivo", "codigoAtc", "fuenteCatalogo", "creadoEn", "actualizadoEn")
       VALUES ($1, $2, $3, $4, 'planilla-chile', NOW(), NOW())
       ON CONFLICT ("codigoCatalogo") DO UPDATE SET
         "nombre" = EXCLUDED."nombre", "principioActivo" = EXCLUDED."principioActivo",
         "codigoAtc" = COALESCE(EXCLUDED."codigoAtc", "Medicamento"."codigoAtc"), "actualizadoEn" = NOW()
       RETURNING id, (xmax = 0) AS created`,
      [record.codigoCatalogo, record.nombre.trim(), blank(record.principioActivo), atc],
    );
    if (result.rows[0].created) created++;
    const values = columns.map(key => blank(record[key]));
    const names = columns.map(key => `"${key}"`).join(", ");
    const params = columns.map((_, index) => `$${index + 2}`).join(", ");
    const updates = columns.map(key => `"${key}" = EXCLUDED."${key}"`).join(", ");
    await client.query(
      `INSERT INTO "FichaMedicamentoChile" ("medicamentoId", ${names}, "actualizadoEn")
       VALUES ($1, ${params}, NOW())
       ON CONFLICT ("medicamentoId") DO UPDATE SET ${updates}, "actualizadoEn" = NOW()`,
      [result.rows[0].id, ...values],
    );
  }
  await client.query("COMMIT");
  console.log(`${records.length} fichas importadas; ${created} medicamentos nuevos. Precios, stock, códigos de barras y condiciones de venta del POS no se modificaron.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
