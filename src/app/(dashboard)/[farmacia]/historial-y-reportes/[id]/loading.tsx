import { LoadingPanel, SectionLoading } from "@/components/section-loading";

export default function Loading() {
  return (
    <SectionLoading title="Detalle de venta">
      <LoadingPanel title="Detalle de productos" />
    </SectionLoading>
  );
}
