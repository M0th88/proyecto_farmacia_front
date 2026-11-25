"use client";

import {
  ChartColumnIncreasing,
  ChevronDown,
  House,
  PackageX,
  Settings2,
  ShoppingBag,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./app-shell.module.css";

const shortcuts = [
  { label: "Panel", href: "/privada/panel", icon: House },
  { label: "Compras", href: "/privada/compras", icon: ShoppingBag },
];

const groups = [
  {
    label: "Almacén",
    icon: Warehouse,
    links: [
      { label: "Stocks y Lotes", href: "/privada/stocks-y-lotes" },
      { label: "Otros Productos", href: "/privada/otros-productos" },
      { label: "Ubicaciones", href: "/privada/ubicaciones" },
      { label: "Cuarentena Sanitaria", href: "/privada/cuarentena-sanitaria" },
      {
        label: "Cuarentena Transitoria",
        href: "/privada/cuarentena-transitoria",
      },
    ],
  },
  {
    label: "Segregación de Productos",
    icon: PackageX,
    links: [
      { label: "Segregar Productos", href: "/privada/segregar-productos" },
      { label: "Productos Vencidos", href: "/privada/productos-vencidos" },
      { label: "Retiro de Mercado", href: "/privada/retiro-de-mercado" },
      { label: "Productos Rechazados", href: "/privada/productos-rechazados" },
      {
        label: "Devoluciones a Proveedor",
        href: "/privada/devoluciones-a-proveedor",
      },
    ],
  },
  {
    label: "Administrador",
    icon: Settings2,
    links: [
      { label: "Productos y Empaques", href: "/privada/productos-y-empaques" },
      { label: "Proveedores", href: "/privada/proveedores" },
      { label: "Usuarios", href: "/privada/usuarios" },
      { label: "Roles", href: "/privada/roles" },
      { label: "Marcas", href: "/privada/marcas" },
    ],
  },
  {
    label: "Reportes Generales",
    icon: ChartColumnIncreasing,
    links: [
      { label: "Auditoría FEFO", href: "/privada/auditoria-fefo" },
      { label: "Inventario Histórico", href: "/privada/inventario-historico" },
      { label: "Historial y Reportes", href: "/privada/historial-y-reportes" },
      { label: "Caja del Día", href: "/privada/caja-del-dia" },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    const activeLink = nav.current?.querySelector('[aria-current="page"]');
    const group = activeLink?.closest("details");
    if (group) group.open = true;
  }, [pathname]);

  return (
    <nav
      ref={nav}
      className={styles.sidebarNav}
      aria-label="Secciones de Farmacia Privada"
    >
      <ul className={styles.sidebarList}>
        {shortcuts.map(({ label, href, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={styles.sidebarLink}
              aria-current={isActive(href) ? "page" : undefined}
              onNavigate={onNavigate}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
        {groups.map(({ label, icon: Icon, links }) => (
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
                      href={href}
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
