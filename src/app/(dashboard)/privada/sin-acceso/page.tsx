import Link from "next/link";
export default function SinAccesoPage() {
  return (
    <section className="pos-shell">
      <section className="pos-panel private-denied">
        <h1>Sin permiso para esta sección</h1>
        <p>
          Tu perfil no tiene acceso a esta vista. Solicita el permiso al
          administrador.
        </p>
        <Link className="pos-action-link" href="/privada/panel">
          Volver al panel →
        </Link>
      </section>
    </section>
  );
}
