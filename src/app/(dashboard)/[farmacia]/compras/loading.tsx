import { LoadingPanel, SectionLoading } from "@/components/section-loading";

export default function Loading() {
  return (
    <SectionLoading title="Compras">
      <div className="pos-grid">
        <LoadingPanel title="Seguimiento" />
        <LoadingPanel title="De pedido a bodega" />
      </div>
    </SectionLoading>
  );
}
