import Link from "next/link";
import { PrivateNav } from "@/components/private-nav";
import { PrivateUsersAdmin } from "@/components/private-users-admin";

export default function UsuariosPrivados() {
  return <main className="pos-shell"><header className="pos-header"><div><Link href="/privada">← Volver al panel</Link><p>FARMACIA PRIVADA / ADMINISTRACIÓN</p><h1>Usuarios y roles</h1><span>Crea perfiles y define qué secciones puede ver cada rol.</span></div></header><PrivateNav /><PrivateUsersAdmin /></main>;
}
