import { SectionLoading } from "@/components/section-loading";
import { EtiquetasLoading } from "./_components/etiquetas-loading";

export default function Loading() {
  return (
    <SectionLoading title="Etiquetas de productos">
      <EtiquetasLoading />
    </SectionLoading>
  );
}
