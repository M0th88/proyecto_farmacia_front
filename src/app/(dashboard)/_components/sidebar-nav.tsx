"use client";

import {
  ChartColumnIncreasing,
  ChevronDown,
  HeartPulse,
  House,
  PackageX,
  Settings2,
  ShoppingBag,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { type Pharmacy, pharmacies } from "@/lib/auth/pharmacies";
import styles from "./app-shell.module.css";

const shortcuts = [
  { label: "Panel", href: "/panel", icon: House },
  { label: "Compras", href: "/compras", icon: ShoppingBag },
];

type NavLink = { label: string; href: string; solo?: Pharmacy };
type NavGroup = {
  label: string;
  icon: typeof House;
  links: NavLink[];
  solo?: Pharmacy;
};

const groups: NavGroup[] = [
  {
    label: "Dispensación CESFAM",
    icon: HeartPulse,
    solo: "asistencial",
    links: [
      { label: "Dispensación", href: "/dispensacion" },
      { label: "Pacientes", href: "/pacientes" },
      { label: "Programas de Salud", href: "/programas" },
      { label: "Remesas CENABAST", href: "/remesas" },
    ],
  },
  {
    label: "Almacén",
    icon: Warehouse,
    links: [
      { label: "Stocks y Lotes", href: "/stocks-y-lotes" },
      { label: "Otros Productos", href: "/otros-productos" },
      { label: "Sucursales", href: "/sucursales" },
      { label: "Ubicaciones", href: "/ubicaciones" },
      { label: "Cuarentena Sanitaria", href: "/cuarentena-sanitaria" },
      {
        label: "Cuarentena Transitoria",
        href: "/cuarentena-transitoria",
      },
    ],
  },
  {
    label: "Segregación de Productos",
    icon: PackageX,
    links: [
      { label: "Segregar Productos", href: "/segregar-productos" },
      { label: "Productos Vencidos", href: "/productos-vencidos" },
      { label: "Retiro de Mercado", href: "/retiro-de-mercado" },
      { label: "Productos Rechazados", href: "/productos-rechazados" },
      {
        label: "Devoluciones a Proveedor",
        href: "/devoluciones-a-proveedor",
      },
    ],
  },
  {
    label: "Administrador",
    icon: Settings2,
    links: [
      { label: "Productos y Empaques", href: "/productos-y-empaques" },
      { label: "Proveedores", href: "/proveedores" },
      { label: "Convenios", href: "/convenios", solo: "privada" },
      { label: "Usuarios", href: "/usuarios" },
      { label: "Roles", href: "/roles" },
      { label: "Marcas", href: "/marcas" },
    ],
  },
  {
    label: "Reportes Generales",
    icon: ChartColumnIncreasing,
    links: [
      { label: "Auditoría FEFO", href: "/auditoria-fefo" },
      { label: "Inventario Histórico", href: "/inventario-historico" },
      { label: "Historial y Reportes", href: "/historial-y-reportes" },
      { label: "Caja del Día", href: "/caja-del-dia" },
      { label: "Recetas", href: "/recetas", solo: "privada" },
      {
        label: "Libro de Controlados",
        href: "/libro-controlados",
        solo: "privada",
      },
    ],
  },
];

export function SidebarNav({
  pharmacy,
  onNavigate,
}: {
  pharmacy: Pharmacy;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const isActive = (href: string) => {
    const path = `/${pharmacy}${href}`;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  useEffect(() => {
    const activeLink = nav.current?.querySelector('[aria-current="page"]');
    const group = activeLink?.closest("details");
    if (group) group.open = true;
  }, [pathname]);

  return (
    <nav
      ref={nav}
      className={styles.sidebarNav}
      aria-label={`Secciones de ${pharmacies[pharmacy].name}`}
    >
      <ul className={styles.sidebarList}>
        {shortcuts.map(({ label, href, icon: Icon }) => (
          <li key={href}>
            <Link
              href={`/${pharmacy}${href}`}
              className={styles.sidebarLink}
              aria-current={isActive(href) ? "page" : undefined}
              onNavigate={onNavigate}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
        {groups
          .filter((g) => !g.solo || g.solo === pharmacy)
          .map((g) => ({
            ...g,
            links: g.links.filter((l) => !l.solo || l.solo === pharmacy),
          }))
          .map(({ label, icon: Icon, links }) => (
            <li key={label} className={styles.sidebarGroup}>
              <details open>
                <summary
                  className={styles.sidebarGroupToggle}
                  data-active={links.some(({ href }) => isActive(href))}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronDown
                    size={15}
                    className={styles.sidebarChevron}
                    aria-hidden="true"
                  />
                </summary>
                <ul className={styles.sidebarGroupList}>
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={`/${pharmacy}${href}`}
                        className={styles.sidebarLink}
                        aria-current={isActive(href) ? "page" : undefined}
                        onNavigate={onNavigate}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
      </ul>
    </nav>
  );
}
