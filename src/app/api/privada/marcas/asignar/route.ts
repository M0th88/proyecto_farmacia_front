import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { asignarMarcaSchema } from "@/lib/validation/abastecimiento";
import { ruta } from "../../_gestion";

/** Asigna (o quita, con marcaId null) la marca de un producto. */
export const POST = ruta(
  "catalogo",
  asignarMarcaSchema,
  async ({ medicamentoId, marcaId }) => {
    await db.medicamento.update({
      where: { id: medicamentoId },
      data: { marcaId },
    });
    return Response.json({ medicamentoId, marcaId });
  },
);
