"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PRIVATE_SECTIONS,
  type PrivatePermission,
} from "@/lib/private/permissions";
import styles from "./app-shell.module.css";

const icons: Record<PrivatePermission, string> = {
  inicio: "m3 10 9-7 9 7v10H3Z M9 20v-7h6v7",
  pos: "M3 4h2l3 12h11l2-8H6 M9 21h.01 M18 21h.01",
  catalogo: "M9 3h6l6 6v6l-6 6H9l-6-6V9Z M8 12h8 M12 8v8",
  inventario: "m3 7 9-4 9 4v10l-9 4-9-4Z M3 7l9 4 9-4 M12 11v10",
  proveedores:
    "M3 7h11v10H3Z M14 10h4l3 4v3h-7 M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  compras: "M5 7h14l2 14H3Z M8 7V5a4 4 0 0 1 8 0v2",
  caja: "M4 3h16v18H4Z M8 7h8 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M8 18h1 M15 18h1",
  ventas: "M3 12a9 9 0 1 0 3-7 M3 3v6h6 M12 7v5l3 2",
  indicadores: "M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-9",
  usuarios:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav
      className={styles.sidebarNav}
      aria-label="Secciones de Farmacia Privada"
    >
      <ul className={styles.sidebarList}>
        {PRIVATE_SECTIONS.filter((section) => section.key !== "pos").map(
          (section) => {
            const active =
              section.href === "/privada/panel"
                ? pathname === section.href
                : pathname === section.href ||
                  pathname.startsWith(`${section.href}/`);
            return (
              <li key={section.key}>
                <Link
                  href={section.href}
                  className={styles.sidebarLink}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={icons[section.key]} />
                  </svg>
                  <span>{section.label}</span>
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}
