import Link from "next/link";
import { PrivateUsersAdmin } from "@/app/(dashboard)/privada/_components/private-users-admin";

export default function UsuariosPrivados() {
  return <section className="pos-shell"><header className="pos-header"><div><Link href="/privada">← Volver al panel</Link><p>FARMACIA PRIVADA / ADMINISTRACIÓN</p><h1>Usuarios y roles</h1><span>Crea perfiles y define qué secciones puede ver cada rol.</span></div></header><PrivateUsersAdmin /></section>;
}
