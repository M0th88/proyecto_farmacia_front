"use client";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { type Pharmacy, pharmacies } from "@/lib/auth/pharmacies";
import styles from "./app-shell.module.css";
import { SidebarNav } from "./sidebar-nav";

type Props = {
  selected: Pharmacy;
  sidebarOpen: boolean;
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
};
export function AppSidebar({
  selected,
  sidebarOpen,
  mobileOpen,
  setMobileOpen,
}: Props) {
  const pharmacy = pharmacies[selected];
  const mobileSidebar = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = mobileSidebar.current;
    if (mobileOpen) dialog?.showModal();
    else if (dialog?.open) dialog.close();
  }, [mobileOpen]);
  return (
    <>
      <aside
        id="pharmacy-sidebar"
        className={styles.sidebar}
        aria-label="Barra lateral"
        inert={!sidebarOpen}
      >
        <div className={styles.sidebarHeader}>
          {selected === "privada" && (
            <h2 className={styles.sidebarTitle}>{pharmacy.name}</h2>
          )}
        </div>
        <div className={styles.sidebarBody}>
          {selected === "privada" && <SidebarNav />}
        </div>
      </aside>
      <dialog
        id="pharmacy-mobile-sidebar"
        ref={mobileSidebar}
        className={styles.mobileSidebar}
        aria-label="Barra lateral"
        onCancel={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX > bounds.right ||
              event.clientY > bounds.bottom ||
              event.clientX < bounds.left ||
              event.clientY < bounds.top
            )
              setMobileOpen(false);
          }
        }}
      >
        <div className={styles.mobileSidebarHeader}>
          <span>{pharmacy.name}</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Cerrar barra lateral"
            onClick={() => setMobileOpen(false)}
            autoFocus
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.sidebarBody}>
          {selected === "privada" && (
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          )}
        </div>
      </dialog>
    </>
  );
}
