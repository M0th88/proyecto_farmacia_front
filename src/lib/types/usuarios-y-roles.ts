import { z } from "zod";
import {
  emailError,
  normalizePhone,
  passwordError,
  phoneError,
  rutError,
} from "@/lib/validation/user-fields";

export type Role = {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  _count: { usuarios: number };
};

export type User = {
  id: number;
  rut: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string;
  activo: boolean;
  rolId: number;
  rol: { nombre: string };
  creadoEn: string;
  actualizadoEn: string;
};

const validatedText = (validate: (value: string) => string | null) =>
  z
    .string()
    .trim()
    .superRefine((value, context) => {
      const message = validate(value);
      if (message) context.addIssue({ code: "custom", message });
    });
export const userProfileSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa al menos dos caracteres.").max(80),
  apellido: z.string().trim().max(80),
  rut: validatedText(rutError)
    .max(12)
    .transform((value) => value.toUpperCase()),
  email: validatedText(emailError)
    .max(254)
    .transform((value) => value.toLowerCase()),
  telefono: validatedText(phoneError)
    .max(30)
    .transform((value) => {
      const phone = normalizePhone(value);
      if (!phone) return "";
      return phone.startsWith("+56")
        ? phone
        : phone.startsWith("56")
          ? `+${phone}`
          : `+56${phone}`;
    }),
  rolId: z.number().int().positive("Selecciona un rol."),
  activo: z.boolean(),
  password: z.string().superRefine((value, context) => {
    if (!value) return;
    const message = passwordError(value);
    if (message) context.addIssue({ code: "custom", message });
  }),
});
export const userCreateProfileSchema = userProfileSchema.extend({
  password: userProfileSchema.shape.password.refine(
    (value) => !!value,
    "Debe ingresar una contraseña",
  ),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
export const ownProfileSchema = userProfileSchema
  .pick({
    nombre: true,
    apellido: true,
    rut: true,
    email: true,
    telefono: true,
    password: true,
  })
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "No hay cambios para guardar.",
  );
export type OwnProfile = z.infer<typeof ownProfileSchema>;
