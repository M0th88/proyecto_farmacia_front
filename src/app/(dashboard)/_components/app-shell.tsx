"use client";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type Pharmacy, pharmacies } from "@/lib/auth/pharmacies";
import { AppNavbar, type DashboardUser } from "./app-navbar";
import styles from "./app-shell.module.css";
import { AppSidebar } from "./app-sidebar";

type Props = { selected: Pharmacy; children: ReactNode; user?: DashboardUser };
export function AppShell({ selected, children, user }: Props) {
  const pharmacy = pharmacies[selected];
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches)
      setMobileOpen((open) => !open);
    else setSidebarOpen((open) => !open);
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => {
      if (desktop.matches) setMobileOpen(false);
    };
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
  return (
    <div className={styles.shell} data-sidebar-open={sidebarOpen}>
      <AppSidebar
        selected={selected}
        sidebarOpen={sidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className={styles.workspace}>
        <AppNavbar
          selected={selected}
          user={user}
          sidebarOpen={sidebarOpen}
          mobileOpen={mobileOpen}
          toggleSidebar={toggleSidebar}
        />
        <main
          className={styles.main}
          aria-label={`Área de trabajo de ${pharmacy.name}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
