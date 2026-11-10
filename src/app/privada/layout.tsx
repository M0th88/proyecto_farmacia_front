import Image from "next/image";
import Link from "next/link";

export default function PrivadaLayout({ children }: { children: React.ReactNode }) {
  return <div className="private-module"><div className="private-brand-bar"><Link href="/privada" aria-label="Ir al panel de farmacia privada"><Image src="/inacap-logo.png" alt="INACAP 60 años" width={260} height={58} priority /></Link></div>{children}</div>;
}
