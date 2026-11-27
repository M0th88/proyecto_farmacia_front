import {
  LoadingMetrics,
  LoadingPanel,
  SectionLoading,
} from "@/components/section-loading";

export default function Loading() {
  return (
    <SectionLoading title="Caja del Día">
      <LoadingMetrics
        labels={["Ventas hoy", "Tickets", "Ticket promedio", "Fecha"]}
      />
      <div className="pos-grid">
        <LoadingPanel title="Distribución de cobros" />
        <LoadingPanel title="Turno de caja" />
      </div>
    </SectionLoading>
  );
}
