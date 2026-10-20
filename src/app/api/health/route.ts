import { prismaAsistencial } from "@/config/prismaAsistencial";
import { prismaPrivada } from "@/config/prismaPrivada";

export async function GET() {
  try {
    const [medicamentosPrivada, medicamentosAsistencial] = await Promise.all([
      prismaPrivada.medicamento.count(),
      prismaAsistencial.medicamento.count(),
    ]);

    return Response.json(
      {
        status: "OK",
        basesDatos: {
          privada: { estado: "conectada", medicamentos: medicamentosPrivada },
          asistencial: { estado: "conectada", medicamentos: medicamentosAsistencial },
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Falló la comprobación de las bases de farmacia:", error);
    return Response.json(
      { status: "ERROR", mensaje: "No se pudo conectar con las dos bases de datos." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

