import { LoadingPanel, SectionLoading } from "@/components/section-loading";

export default function Loading() {
  return (
    <SectionLoading title="POS">
      <div className="pos-grid">
        <LoadingPanel title="Medicamentos" />
        <LoadingPanel title="Venta actual" />
      </div>
    </SectionLoading>
  );
}
