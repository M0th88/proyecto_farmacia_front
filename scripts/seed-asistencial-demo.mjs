// Datos de demostración para Farmacia Asistencial (CESFAM).
//
//   node scripts/seed-asistencial-demo.mjs           -> simula (no escribe)
//   node scripts/seed-asistencial-demo.mjs --apply   -> aplica en una transacción
//
// Idempotente: solo crea lo que falta. Programas, cuotas, pacientes y lotes
// son ficticios y sirven para practicar; las cuotas son parámetros del
// simulador, no normas oficiales.
import "dotenv/config";
import pg from "pg";

const aplicar = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL_ASISTENCIAL;
if (!connectionString)
  throw new Error("Falta DATABASE_URL_ASISTENCIAL en .env.");

const UBICACIONES = [
  ["Bodega CESFAM", "BODEGA"],
  ["Botiquín de dispensación", "VITRINA"],
];
// [código, nombre, principio activo, concentración, forma]
const MEDICAMENTOS = [
  ["ASIS-001", "Losartán", "Losartán potásico", "50 mg", "Comprimido"],
  ["ASIS-002", "Enalapril", "Enalapril maleato", "10 mg", "Comprimido"],
  ["ASIS-003", "Amlodipino", "Amlodipino", "5 mg", "Comprimido"],
  [
    "ASIS-004",
    "Ácido acetilsalicílico",
    "Ácido acetilsalicílico",
    "100 mg",
    "Comprimido",
  ],
  ["ASIS-005", "Metformina", "Metformina clorhidrato", "850 mg", "Comprimido"],
  ["ASIS-006", "Atorvastatina", "Atorvastatina", "20 mg", "Comprimido"],
  ["ASIS-007", "Levotiroxina", "Levotiroxina sódica", "100 mcg", "Comprimido"],
  ["ASIS-008", "Salbutamol", "Salbutamol", "100 mcg/dosis", "Inhalador"],
  ["ASIS-009", "Paracetamol", "Paracetamol", "500 mg", "Comprimido"],
];
// [código, nombre, tipo, [[código medicamento, cuota mensual], ...]]
const PROGRAMAS = [
  [
    "PSCV-HTA",
    "Hipertensión arterial (PSCV)",
    "GES",
    [
      ["ASIS-001", 60],
      ["ASIS-002", 60],
      ["ASIS-003", 30],
      ["ASIS-004", 30],
    ],
  ],
  [
    "PSCV-DM2",
    "Diabetes mellitus tipo 2 (PSCV)",
    "GES",
    [
      ["ASIS-005", 90],
      ["ASIS-006", 30],
      ["ASIS-004", 30],
    ],
  ],
  ["HIPOTIROIDISMO", "Hipotiroidismo", "GES", [["ASIS-007", 30]]],
  ["ERA", "Asma y EPOC (sala ERA)", "GES", [["ASIS-008", 2]]],
  [
    "DOLOR-CRONICO",
    "Dolor crónico del adulto mayor",
    "CRONICO",
    [["ASIS-009", 60]],
  ],
];
// [nombre, año de nacimiento, programas]
const PACIENTES = [
  ["Rosa Elena Catrileo Huenchumán", 1952, ["PSCV-HTA", "PSCV-DM2"]],
  ["Luis Alberto Painemal Ñancupil", 1948, ["PSCV-HTA", "DOLOR-CRONICO"]],
  ["María Inés Sepúlveda Lagos", 1960, ["HIPOTIROIDISMO"]],
  ["José Miguel Antilef Curín", 1975, ["PSCV-DM2"]],
  ["Carmen Gloria Riquelme Vidal", 1958, ["PSCV-HTA", "HIPOTIROIDISMO"]],
  ["Pedro Pablo Millanao Lienlaf", 2012, ["ERA"]],
  ["Ana Luisa Fernández Toledo", 1944, ["DOLOR-CRONICO", "PSCV-HTA"]],
  ["Héctor Manuel Quintana Ortiz", 1966, ["PSCV-DM2", "ERA"]],
];
const GUIA = "GD-CENABAST-2026-0001";

function rut(n) {
  const cuerpo = String(16_000_000 + n);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const dv = 11 - (suma % 11);
  const d = dv === 11 ? "0" : dv === 10 ? "K" : String(dv);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${d}`;
}

const client = new pg.Client({ connectionString });
await client.connect();
const q = (sql, p) => client.query(sql, p);
const resumen = [];
try {
  await q("BEGIN ISOLATION LEVEL SERIALIZABLE");

  const ubic = {};
  for (const [nombre, tipo] of UBICACIONES) {
    let id = (
      await q(`SELECT id FROM "UbicacionInventario" WHERE nombre = $1`, [
        nombre,
      ])
    ).rows[0]?.id;
    if (!id) {
      id = (
        await q(
          `INSERT INTO "UbicacionInventario" (nombre, tipo, "creadoEn") VALUES ($1, $2, NOW()) RETURNING id`,
          [nombre, tipo],
        )
      ).rows[0].id;
      resumen.push(`Ubicación «${nombre}» creada`);
    }
    ubic[tipo] = id;
  }

  const med = {};
  let nuevosMed = 0;
  for (const [codigo, nombre, principio, conc, forma] of MEDICAMENTOS) {
    const r = await q(
      `INSERT INTO "Medicamento" ("codigoCatalogo", nombre, "principioActivo", concentracion,
         "formaFarmaceutica", "condicionVenta", "stockMinimo", "fuenteCatalogo", activo, "creadoEn", "actualizadoEn")
       VALUES ($1, $2, $3, $4, $5, 'RECETA_SIMPLE', 100, 'demo-asistencial', true, NOW(), NOW())
       ON CONFLICT ("codigoCatalogo") DO NOTHING RETURNING id`,
      [codigo, nombre, principio, conc, forma],
    );
    nuevosMed += r.rowCount;
    med[codigo] = (
      await q(`SELECT id FROM "Medicamento" WHERE "codigoCatalogo" = $1`, [
        codigo,
      ])
    ).rows[0].id;
  }
  resumen.push(`${nuevosMed} medicamentos del arsenal creados`);

  const prog = {};
  let nuevosProg = 0;
  for (const [codigo, nombre, tipo, meds] of PROGRAMAS) {
    const r = await q(
      `INSERT INTO "ProgramaSalud" (codigo, nombre, tipo, activo, "creadoEn")
       VALUES ($1, $2, $3, true, NOW()) ON CONFLICT (codigo) DO NOTHING RETURNING id`,
      [codigo, nombre, tipo],
    );
    nuevosProg += r.rowCount;
    prog[codigo] = (
      await q(`SELECT id FROM "ProgramaSalud" WHERE codigo = $1`, [codigo])
    ).rows[0].id;
    for (const [m, cuota] of meds)
      await q(
        `INSERT INTO "ProgramaMedicamento" ("programaId", "medicamentoId", "cuotaMensual")
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [prog[codigo], med[m], cuota],
      );
  }
  resumen.push(`${nuevosProg} programas de salud creados`);

  let nuevosPac = 0;
  for (const [i, [nombre, anio, programas]] of PACIENTES.entries()) {
    const r = await q(
      `INSERT INTO "Paciente" (rut, nombre, "fechaNacimiento", "creadoEn", "actualizadoEn")
       VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (rut) DO NOTHING RETURNING id`,
      [rut(i + 1), nombre, `${anio}-0${(i % 9) + 1}-15`],
    );
    nuevosPac += r.rowCount;
    const pid = (
      await q(`SELECT id FROM "Paciente" WHERE rut = $1`, [rut(i + 1)])
    ).rows[0].id;
    for (const p of programas)
      await q(
        `INSERT INTO "InscripcionPrograma" ("pacienteId", "programaId", desde, activo, "creadoEn")
         VALUES ($1, $2, CURRENT_DATE - 365, true, NOW()) ON CONFLICT DO NOTHING`,
        [pid, prog[p]],
      );
  }
  resumen.push(`${nuevosPac} pacientes inscritos creados`);

  const remesa = await q(
    `INSERT INTO "Remesa" (guia, proveedor, "recibidaEn", observaciones)
     VALUES ($1, 'CENABAST', NOW(), 'Remesa inicial de demostración')
     ON CONFLICT (proveedor, guia) DO NOTHING RETURNING id`,
    [GUIA],
  );
  if (remesa.rowCount) {
    const rid = remesa.rows[0].id;
    for (const [i, [codigo]] of MEDICAMENTOS.entries()) {
      const lotes = [
        { sufijo: "A", dias: 240 + i * 30, bodega: 600, botiquin: 150 },
        ...(i % 3 === 0
          ? [{ sufijo: "B", dias: 25 + i, bodega: 0, botiquin: 40 }]
          : []),
      ];
      for (const l of lotes) {
        const lote = (
          await q(
            `INSERT INTO "Lote" ("numeroLote", "medicamentoId", "fechaVencimiento", "creadoEn")
             VALUES ($1, $2, CURRENT_DATE + $3::int, NOW())
             ON CONFLICT ("medicamentoId", "numeroLote") DO UPDATE SET "numeroLote" = EXCLUDED."numeroLote"
             RETURNING id`,
            [`CNB-${codigo.slice(5)}-${l.sufijo}`, med[codigo], l.dias],
          )
        ).rows[0].id;
        for (const [tipo, cantidad] of [
          ["BODEGA", l.bodega],
          ["VITRINA", l.botiquin],
        ]) {
          if (!cantidad) continue;
          await q(
            `INSERT INTO "Stock" (cantidad, "loteId", "ubicacionId") VALUES ($1, $2, $3)
             ON CONFLICT ("loteId", "ubicacionId") DO UPDATE SET cantidad = "Stock".cantidad + EXCLUDED.cantidad`,
            [cantidad, lote, ubic[tipo]],
          );
          await q(
            `INSERT INTO "RemesaDetalle" ("remesaId", "loteId", "ubicacionId", cantidad) VALUES ($1, $2, $3, $4)`,
            [rid, lote, ubic[tipo], cantidad],
          );
          await q(
            `INSERT INTO "MovimientoStock" (tipo, cantidad, motivo, "loteId", "creadoEn")
             VALUES ('ENTRADA', $1, $2, $3, NOW())`,
            [cantidad, `Remesa CENABAST guía ${GUIA}`, lote],
          );
        }
      }
    }
    resumen.push(
      `Remesa CENABAST ${GUIA} recibida con lotes en bodega y botiquín`,
    );
  }

  if (aplicar) {
    await q("COMMIT");
    console.log("Datos asistenciales aplicados:");
  } else {
    await q("ROLLBACK");
    console.log("Simulación (no se guardó nada). Usa --apply para aplicar:");
  }
  for (const l of resumen) console.log(`  · ${l}`);
} catch (e) {
  await q("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await client.end();
}
