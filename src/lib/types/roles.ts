import { z } from "zod";
import { ALL_PRIVATE_PERMISSIONS } from "@/lib/private/permissions";

export const roleProfileSchema = z.object({
  nombre: z.string().trim().min(2, "Debe ingresar un nombre").max(60),
  descripcion: z
    .string()
    .max(500, "La descripción admite máximo 500 caracteres.")
    .trim()
    .min(1, "Debe ingresar una descripción"),
  permisos: z
    .array(z.enum(ALL_PRIVATE_PERMISSIONS))
    .min(1, "Selecciona al menos una vista."),
});
export type RoleProfile = z.infer<typeof roleProfileSchema>;
