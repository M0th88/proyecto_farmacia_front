"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./app-shell.module.css";
import { LogoutButton } from "./logout-button";
import { SidebarNav } from "./sidebar-nav";

type Pharmacy = "privada" | "asistencial";
const pharmacies = {
  privada: { name: "Farmacia Privada", initials: "FP" },
  asistencial: { name: "Farmacia Asistencial", initials: "FA" },
};

function MenuIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}

export function AppShell({ selected, children, user }: { selected: Pharmacy; children: ReactNode; user?: { name: string; role: string } }) {
  const pharmacy = pharmacies[selected];
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const mobileSidebar = useRef<HTMLDialogElement>(null);
  const navTrigger = useRef<HTMLButtonElement>(null);
  const navMenu = useRef<HTMLDivElement>(null);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setMobileOpen((open) => !open);
    else setSidebarOpen((open) => !open);
  }, []);

  useEffect(() => {
    const dialog = mobileSidebar.current;
    if (mobileOpen) dialog?.showModal();
    else if (dialog?.open) dialog.close();
  }, [mobileOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", onResize);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      desktop.removeEventListener("change", onResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleSidebar]);

  useEffect(() => {
    if (!navOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navMenu.current?.contains(event.target as Node)) setNavOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setNavOpen(false); navTrigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);

  return (
    <div className={styles.shell} data-sidebar-open={sidebarOpen}>
      <aside id="pharmacy-sidebar" className={styles.sidebar} aria-label="Barra lateral" inert={!sidebarOpen}>
        <div className={styles.sidebarHeader}>{selected === "privada" && <h2 className={styles.sidebarTitle}>Paramacia Privada</h2>}</div>
        <div className={styles.sidebarBody}>{selected === "privada" && <SidebarNav />}</div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.navbar}>
          <div className={styles.navbarStart}>
            <Link href="/" aria-label="Volver a la selección de farmacia" className={styles.brand}>
              <Image src="/inacap.svg" alt="INACAP" width={567} height={153} className={styles.logo} loading="eager" />
            </Link>
            <button type="button" className={`${styles.iconButton} ${styles.desktopTrigger}`} onClick={toggleSidebar} aria-label={sidebarOpen ? "Cerrar barra lateral" : "Abrir barra lateral"} aria-expanded={sidebarOpen} aria-controls="pharmacy-sidebar" title="Mostrar u ocultar barra lateral (Ctrl+B)"><MenuIcon /></button>
            <button type="button" className={`${styles.iconButton} ${styles.mobileTrigger}`} onClick={toggleSidebar} aria-label="Abrir barra lateral" aria-expanded={mobileOpen} aria-controls="pharmacy-mobile-sidebar"><MenuIcon /></button>
          </div>
          <div ref={navMenu} className={styles.navMenu} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setNavOpen(false);
          }}>
            <button ref={navTrigger} type="button" className={styles.pharmacyButton} onClick={() => setNavOpen((open) => !open)} aria-label={`Opciones de ${pharmacy.name}`} aria-expanded={navOpen} aria-controls="pharmacy-nav-options">
              <span className={styles.profile}><span className={styles.pharmacyName}>{user?.name ?? pharmacy.name}</span><span className={styles.role}>{user?.role ?? pharmacy.name}</span></span>
              <span className={styles.avatar} aria-hidden="true">{user ? user.name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("") : pharmacy.initials}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={navOpen ? styles.chevronOpen : undefined}><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {navOpen && <nav id="pharmacy-nav-options" aria-label="Opciones de farmacia" className={styles.dropdown}><p className={styles.dropdownIdentity}>{user?.name ?? pharmacy.name}<small>{user?.role ?? pharmacy.name}</small></p><Link href="/" onClick={() => setNavOpen(false)}>Cambiar de farmacia</Link><LogoutButton pharmacy={selected} /></nav>}
          </div>
        </header>
        <main className={styles.main} aria-label={`Área de trabajo de ${pharmacy.name}`}>{children}</main>
      </div>
      <dialog id="pharmacy-mobile-sidebar" ref={mobileSidebar} className={styles.mobileSidebar} aria-label="Barra lateral" onCancel={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX > bounds.right || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientY < bounds.top) setMobileOpen(false);
        }
      }}>
        <div className={styles.mobileSidebarHeader}>
          <span>{selected === "privada" ? "Paramacia Privada" : pharmacy.name}</span>
          <button type="button" className={styles.iconButton} aria-label="Cerrar barra lateral" onClick={() => setMobileOpen(false)} autoFocus><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>
        <div className={styles.sidebarBody}>{selected === "privada" && <SidebarNav onNavigate={() => setMobileOpen(false)} />}</div>
      </dialog>
    </div>
  );
}
