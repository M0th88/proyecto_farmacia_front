import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ColumnaReporte, FilaReporte, Reporte } from "./reportes";

const ROJO_INACAP = "C8102E";
const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

function texto(col: ColumnaReporte, valor: FilaReporte[string]) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number")
    return col.formato === "pesos" ? pesos.format(valor) : entero.format(valor);
  return valor;
}

export async function reporteXlsx(reporte: Reporte) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Sistema de Farmacias";
  libro.created = new Date();
  const hoja = libro.addWorksheet(reporte.titulo.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  const n = reporte.columnas.length;

  hoja.mergeCells(1, 1, 1, n);
  hoja.getCell(1, 1).value = reporte.titulo;
  hoja.getCell(1, 1).font = { bold: true, size: 14 };
  hoja.mergeCells(2, 1, 2, n);
  hoja.getCell(2, 1).value = reporte.subtitulo;
  hoja.getCell(2, 1).font = { italic: true, color: { argb: "FF555555" } };

  hoja.columns = reporte.columnas.map((c) => ({
    key: c.clave,
    width: c.ancho ?? 16,
  }));
  const cabecera = hoja.getRow(4);
  reporte.columnas.forEach((c, i) => {
    const celda = cabecera.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${ROJO_INACAP}` },
    };
    celda.alignment = { vertical: "middle", wrapText: true };
  });
  cabecera.height = 20;

  const agregar = (fila: FilaReporte, negrita = false) => {
    const r = hoja.addRow(
      Object.fromEntries(reporte.columnas.map((c) => [c.clave, fila[c.clave]])),
    );
    reporte.columnas.forEach((c, i) => {
      const celda = r.getCell(i + 1);
      if (c.formato === "pesos") celda.numFmt = '"$"#,##0';
      if (c.formato === "entero") celda.numFmt = "#,##0";
      if (negrita) celda.font = { bold: true };
    });
    return r;
  };
  for (const fila of reporte.filas) agregar(fila);
  if (reporte.totales && reporte.filas.length) {
    const r = agregar(reporte.totales, true);
    r.eachCell((celda) => {
      celda.border = { top: { style: "thin" } };
    });
  }
  if (!reporte.filas.length) hoja.addRow(["Sin registros para el período."]);
  hoja.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: n },
  };

  return Buffer.from(await libro.xlsx.writeBuffer());
}

export function reportePdf(reporte: Reporte) {
  const anchoTotal = reporte.columnas.reduce((s, c) => s + (c.ancho ?? 16), 0);
  const doc = new jsPDF({
    orientation: anchoTotal > 110 ? "landscape" : "portrait",
    unit: "mm",
    format: "letter",
  });
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFillColor(`#${ROJO_INACAP}`);
  doc.rect(0, 0, ancho, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(reporte.titulo, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(reporte.subtitulo, 14, 22);
  doc.setTextColor(0);

  const numericas = new Set(
    reporte.columnas.flatMap((c, i) => (c.formato ? [i] : [])),
  );
  autoTable(doc, {
    startY: 27,
    head: [reporte.columnas.map((c) => c.titulo)],
    body: reporte.filas.length
      ? reporte.filas.map((f) =>
          reporte.columnas.map((c) => texto(c, f[c.clave])),
        )
      : [
          [
            {
              content: "Sin registros para el período.",
              colSpan: reporte.columnas.length,
            },
          ],
        ],
    foot:
      reporte.totales && reporte.filas.length
        ? [
            reporte.columnas.map((c) =>
              texto(c, reporte.totales?.[c.clave] ?? null),
            ),
          ]
        : undefined,
    showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: `#${ROJO_INACAP}`, textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: (data) => {
      if (numericas.has(data.column.index)) data.cell.styles.halign = "right";
    },
    didDrawPage: () => {
      const alto = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `Generado el ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })} · Simulación académica`,
        14,
        alto - 8,
      );
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber}`,
        ancho - 14,
        alto - 8,
        { align: "right" },
      );
      doc.setTextColor(0);
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
