export function EmptyPrivateSection({ title }: { title: string }) {
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <h1>{title}</h1>
      </header>
    </section>
  );
}
