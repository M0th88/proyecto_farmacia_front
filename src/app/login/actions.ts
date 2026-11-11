import type { Pharmacy } from "@/lib/auth/pharmacies";

export async function loginAction(
  pharmacy: Pharmacy,
  form: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const response = await fetch(`/api/auth/${pharmacy}`, {
    method: "POST",
    body: form,
  });
  return response.json();
}

export async function logoutAction(pharmacy: Pharmacy) {
  const response = await fetch(`/api/auth/${pharmacy}`, { method: "DELETE" });
  if (!response.ok) throw new Error("No se pudo cerrar sesión.");
}
