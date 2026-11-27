import { LoadingPanel } from "@/components/section-loading";

export function EtiquetasLoading() {
  return (
    <div
      className="pos-grid"
      role="status"
      aria-label="Cargando generador de etiquetas"
    >
      <LoadingPanel title="Seleccionar productos" />
      <LoadingPanel title="Vista previa" />
    </div>
  );
}
