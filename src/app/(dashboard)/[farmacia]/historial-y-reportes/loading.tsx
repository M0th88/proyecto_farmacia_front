import {
  LoadingMetrics,
  LoadingPanel,
  SectionLoading,
} from "@/components/section-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SectionLoading title="Historial y Reportes">
      <LoadingMetrics
        labels={[
          "Ventas 14 días",
          "Tickets",
          "Ticket promedio",
          "Días con ventas",
        ]}
      />
      <div className="pos-grid" style={{ marginBottom: 20 }}>
        <LoadingPanel title="Operaciones recientes" />
        <LoadingPanel title="Resumen visible" />
      </div>
      <LoadingPanel title="Ventas por día">
        <Skeleton style={{ height: 220 }} />
      </LoadingPanel>
    </SectionLoading>
  );
}
