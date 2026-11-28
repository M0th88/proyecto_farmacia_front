import { z } from "zod";
import {
  abrirTurno,
  cerrarTurno,
  registrarMovimientoCaja,
} from "@/lib/private/abastecimiento";
import {
  aperturaCajaSchema,
  cierreCajaSchema,
  movimientoCajaSchema,
} from "@/lib/validation/abastecimiento";
import { ruta } from "../_gestion";

const accion = z.discriminatedUnion("accion", [
  aperturaCajaSchema.extend({ accion: z.literal("ABRIR") }),
  movimientoCajaSchema.extend({ accion: z.literal("MOVIMIENTO") }),
  cierreCajaSchema.extend({ accion: z.literal("CERRAR") }),
]);

export const POST = ruta("caja", accion, async (input, user) => {
  if (input.accion === "ABRIR") {
    const t = await abrirTurno(user.id, input.montoInicial);
    return Response.json({ id: t.id }, { status: 201 });
  }
  if (input.accion === "MOVIMIENTO") {
    const m = await registrarMovimientoCaja(user.id, {
      tipo: input.tipo,
      monto: input.monto,
      motivo: input.motivo,
    });
    return Response.json({ id: m.id }, { status: 201 });
  }
  return Response.json(await cerrarTurno(user.id, input));
});
