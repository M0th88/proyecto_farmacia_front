"use client";
import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type Pharmacy, pharmacies } from "@/lib/auth/pharmacies";
import { PRIVATE_SECTIONS } from "@/lib/private/permissions";
import styles from "./app-shell.module.css";
import { AppSidebarTrigger } from "./app-sidebar-trigger";
import { LogoutButton } from "./logout-button";
export type DashboardUser = { name: string; role: string };

type Props = {
  selected: Pharmacy;
  user?: DashboardUser;
  sidebarOpen: boolean;
  mobileOpen: boolean;
  toggleSidebar: () => void;
};
export function AppNavbar({
  selected,
  user,
  sidebarOpen,
  mobileOpen,
  toggleSidebar,
}: Props) {
  const pharmacy = pharmacies[selected];
  const pathname = usePathname();
  const puntoDeVenta = PRIVATE_SECTIONS.find(
    (section) => section.key === "pos",
  );
  const [navOpen, setNavOpen] = useState(false);
  const navTrigger = useRef<HTMLButtonElement>(null);
  const navMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!navOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navMenu.current?.contains(event.target as Node)) setNavOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        navTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);
  return (
    <header className={styles.navbar}>
      <div className={styles.navbarStart}>
        <Link
          href="/"
          aria-label="Volver a la selección de farmacia"
          className={styles.brand}
        >
          <Image
            src="/inacap.svg"
            alt="INACAP"
            width={567}
            height={153}
            className={styles.logo}
            loading="eager"
          />
        </Link>
        <AppSidebarTrigger
          sidebarOpen={sidebarOpen}
          mobileOpen={mobileOpen}
          toggleSidebar={toggleSidebar}
        />
      </div>
      <div className={styles.navbarEnd}>
        {selected === "privada" && puntoDeVenta && (
          <Link
            href={puntoDeVenta.href}
            className={styles.posLink}
            aria-current={pathname === puntoDeVenta.href ? "page" : undefined}
          >
            <ShoppingCart size={18} aria-hidden="true" />
            <span>POS</span>
          </Link>
        )}
        <div
          ref={navMenu}
          className={styles.navMenu}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setNavOpen(false);
          }}
        >
          <button
            ref={navTrigger}
            type="button"
            className={styles.pharmacyButton}
            onClick={() => setNavOpen((open) => !open)}
            aria-label={`Opciones de ${pharmacy.name}`}
            aria-expanded={navOpen}
            aria-controls="pharmacy-nav-options"
          >
            <span className={styles.profile}>
              <span className={styles.pharmacyName}>
                {user?.name ?? pharmacy.name}
              </span>
              <span className={styles.role}>{user?.role ?? pharmacy.name}</span>
            </span>
            <span className={styles.avatar} aria-hidden="true">
              {user
                ? user.name
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                : selected === "privada"
                  ? "FP"
                  : "FA"}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className={navOpen ? styles.chevronOpen : undefined}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {navOpen && (
            <nav
              id="pharmacy-nav-options"
              aria-label="Opciones de farmacia"
              className={styles.dropdown}
            >
              <p className={styles.dropdownIdentity}>
                {user?.name ?? pharmacy.name}
                <small>{user?.role ?? pharmacy.name}</small>
              </p>
              <Link href="/" onClick={() => setNavOpen(false)}>
                Cambiar de farmacia
              </Link>
              <LogoutButton pharmacy={selected} />
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
