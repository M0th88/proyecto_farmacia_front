import { NextRequest, NextResponse } from "next/server";
import { checkCredentials } from "@/lib/auth/credentials";
import { createSessionToken } from "@/lib/auth/session";
import { isPharmacy, pharmacies } from "@/lib/auth/pharmacies";
import { loginSchema } from "@/app/login/loginSchema";

type Context = { params: Promise<{ pharmacy: string }> };
const sameOrigin = (request: NextRequest) => request.headers.get("origin") === request.nextUrl.origin;

export async function POST(request: NextRequest, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  const { pharmacy } = await params;
  if (!isPharmacy(pharmacy)) return NextResponse.json({ error: "Farmacia no válida." }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const parsed = loginSchema.safeParse({ pharmacy, identifier: form?.get("identifier"), password: form?.get("password"), remember: form?.get("remember") === "on" });
  if (!parsed.success) return NextResponse.json({ error: "Ingresa un correo o RUT válido y tu contraseña." }, { status: 400 });
  try {
    const { identifier, password, remember } = parsed.data;
    const result = await checkCredentials(pharmacy, identifier, password);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 401 });
    const response = NextResponse.json({ success: true, redirectTo: `/${pharmacy}` }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(pharmacies[pharmacy].cookie, createSessionToken(pharmacy, result.userId, remember), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
      ...(remember ? { maxAge: 30 * 24 * 60 * 60 } : {}),
    });
    return response;
  } catch (error) {
    console.error("No se pudo iniciar sesión:", error instanceof Error ? error.message : "Error desconocido");
    return NextResponse.json({ error: "No se pudo iniciar sesión. Intenta nuevamente en unos momentos." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  const { pharmacy } = await params;
  if (!isPharmacy(pharmacy)) return NextResponse.json({ error: "Farmacia no válida." }, { status: 404 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(pharmacies[pharmacy].cookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
