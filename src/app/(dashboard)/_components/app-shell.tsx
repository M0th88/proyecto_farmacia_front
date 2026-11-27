"use client";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type Pharmacy, pharmacies } from "@/lib/auth/pharmacies";
import type { PrivatePermission } from "@/lib/private/permissions";
import { AppNavbar, type DashboardUser } from "./app-navbar";
import styles from "./app-shell.module.css";
import { AppSidebar } from "./app-sidebar";

type Props = {
  selected: Pharmacy;
  children: ReactNode;
  user?: DashboardUser;
  permissions: PrivatePermission[];
};
export function AppShell({ selected, children, user, permissions }: Props) {
  const pharmacy = pharmacies[selected];
  const pathname = usePathname();
  const {
    data: currentPermissions,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["session-permissions", selected],
    queryFn: async ({ signal }): Promise<PrivatePermission[]> => {
      const response = await fetch(`/api/${selected}/perfil`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok)
        throw new Error("No se pudieron actualizar los permisos.");
      return response.json();
    },
    initialData: permissions,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);
  const visiblePermissions = isError ? [] : currentPermissions;
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
      <AppNavbar
        selected={selected}
        canUsePos={visiblePermissions.includes("pos")}
        user={user}
        sidebarOpen={sidebarOpen}
        mobileOpen={mobileOpen}
        toggleSidebar={toggleSidebar}
      />
      <AppSidebar
        selected={selected}
        permissions={visiblePermissions}
        sidebarOpen={sidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className={styles.workspace}>
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
