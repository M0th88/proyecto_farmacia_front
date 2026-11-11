"use client";
import styles from "./app-shell.module.css";

function MenuIcon() {
  return (
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
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
type Props = {
  sidebarOpen: boolean;
  mobileOpen: boolean;
  toggleSidebar: () => void;
};
export function AppSidebarTrigger({
  sidebarOpen,
  mobileOpen,
  toggleSidebar,
}: Props) {
  return (
    <>
      <button
        type="button"
        className={`${styles.iconButton} ${styles.desktopTrigger}`}
        onClick={toggleSidebar}
        aria-label={
          sidebarOpen ? "Cerrar barra lateral" : "Abrir barra lateral"
        }
        aria-expanded={sidebarOpen}
        aria-controls="pharmacy-sidebar"
        title="Mostrar u ocultar barra lateral (Ctrl+B)"
      >
        <MenuIcon />
      </button>
      <button
        type="button"
        className={`${styles.iconButton} ${styles.mobileTrigger}`}
        onClick={toggleSidebar}
        aria-label="Abrir barra lateral"
        aria-expanded={mobileOpen}
        aria-controls="pharmacy-mobile-sidebar"
      >
        <MenuIcon />
      </button>
    </>
  );
}
