import { isPharmacy } from "@/lib/auth/pharmacies";
import { getPharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import {
  esTipoReporte,
  generarReporte,
  rangoReporte,
  TIPOS_REPORTE,
} from "@/lib/private/reportes";
import { reportePdf, reporteXlsx } from "@/lib/private/reportes-export";

type Params = { params: Promise<{ farmacia: string; tipo: string }> };

export async function GET(request: Request, { params }: Params) {
  const { farmacia, tipo } = await params;
  if (!isPharmacy(farmacia) || !esTipoReporte(tipo))
    return new Response(null, { status: 404 });

  const user = await getPharmacyUser(farmacia);
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const permitido =
    user.rol.nombre === "Administrador" ||
    TIPOS_REPORTE[tipo].permisos.some((p) => user.rol.permisos.includes(p));
  if (!permitido)
    return Response.json(
      { error: "Tu rol no tiene acceso a este reporte." },
      { status: 403 },
    );

  const url = new URL(request.url);
  const formato = url.searchParams.get("formato") ?? "xlsx";
  if (formato !== "xlsx" && formato !== "pdf")
    return Response.json(
      { error: "Formato no admitido. Usa xlsx o pdf." },
      { status: 400 },
    );
  const rango = rangoReporte(
    url.searchParams.get("desde"),
    url.searchParams.get("hasta"),
  );
  if ("error" in rango)
    return Response.json({ error: rango.error }, { status: 400 });

  try {
    const reporte = await generarReporte(
      pharmacyDb(farmacia),
      tipo,
      farmacia,
      rango,
    );
    const archivo =
      formato === "pdf" ? reportePdf(reporte) : await reporteXlsx(reporte);
    const sufijo = TIPOS_REPORTE[tipo].usaFechas
      ? `${rango.desde}_${rango.hasta}`
      : rango.hasta;
    return new Response(new Uint8Array(archivo), {
      headers: {
        "Content-Type":
          formato === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-${tipo}-${farmacia}-${sufijo}.${formato}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error al generar reporte", error);
    return Response.json(
      { error: "No se pudo generar el reporte." },
      { status: 500 },
    );
  }
}
