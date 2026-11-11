import { z } from "zod";

export const loginSchema = z.object({
  pharmacy: z.enum(["privada", "asistencial"]),
  identifier: z.string().trim().min(1).max(254).refine((value) =>
    z.email().safeParse(value).success || /^\d{7,8}-?[0-9kK]$/.test(value.replace(/[.\s]/g, "")),
  "Ingresa un correo o RUT válido."),
  password: z.string().min(1).max(72),
  remember: z.boolean(),
});

export type LoginState = { error?: string; identifier?: string; remember?: boolean };
