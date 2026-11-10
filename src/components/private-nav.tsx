"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIVATE_SECTIONS } from "@/lib/private-permissions";

export function PrivateNav() {
  const pathname = usePathname();
  return <nav className="private-nav" aria-label="Farmacia privada">
    {PRIVATE_SECTIONS.map(s => <Link key={s.href} href={s.href} aria-current={pathname === s.href ? "page" : undefined}>{s.label}</Link>)}
  </nav>;
}
