import { LoadingPanel, SectionLoading } from "@/components/section-loading";

export default function Loading() {
  return (
    <SectionLoading title="Proveedores">
      <div className="pos-grid">
        <LoadingPanel title="Proveedores registrados" />
        <LoadingPanel title="Ficha de proveedor" />
      </div>
    </SectionLoading>
  );
}
