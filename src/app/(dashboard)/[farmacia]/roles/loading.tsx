import styles from "@/components/admin-table.module.css";
import { TableSkeleton } from "@/components/data-table";

export default function RolesLoading() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Roles</h1>
      <TableSkeleton
        headers={[
          "ID",
          "Rol",
          "Descripción",
          "Vistas permitidas",
          "Usuarios",
          "Acciones",
        ]}
      />
    </section>
  );
}
