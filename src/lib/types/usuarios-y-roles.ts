import { z } from "zod";

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

export const userProfileSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa al menos dos caracteres.").max(80),
  apellido: z.string().trim().max(80),
  rut: z.string().trim().min(6, "Ingresa un RUT válido.").max(20),
  email: z.email("Ingresa un correo válido.").max(254),
  telefono: z.string().trim().max(30),
  rolId: z.number().int().positive("Selecciona un rol."),
  activo: z.boolean(),
  password: z
    .string()
    .refine(
      (value) =>
        !value ||
        (value.length >= 12 && new TextEncoder().encode(value).length <= 72),
      "Usa al menos 12 caracteres y como máximo 72 bytes.",
    ),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
