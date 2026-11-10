import Link from "next/link";
export default function SinAcceso() { return <main className="pos-shell"><section className="pos-panel private-denied"><h1>Sin permiso para esta sección</h1><p>Tu perfil no tiene acceso a esta vista. Solicita el permiso al administrador.</p><Link className="pos-action-link" href="/privada">Volver al panel →</Link></section></main>; }
