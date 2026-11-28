/** Aviso para módulos que solo existen en Farmacia Asistencial. */
export function SoloAsistencial({ titulo }: { titulo: string }) {
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>{titulo}</h1>
          <span>
            Módulo de la red pública: disponible en Farmacia Asistencial
            (CESFAM).
          </span>
        </div>
      </header>
    </section>
  );
}

export function SinPermiso({ texto }: { texto: string }) {
  return (
    <section className="pos-shell">
      <p className="pos-empty" role="alert">
        {texto}
      </p>
    </section>
  );
}
