"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import styles from "./logout-button.module.css";

export function LogoutButton({ pharmacy }: { pharmacy: Pharmacy }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await logoutAction(pharmacy);
      router.replace(`/login/${pharmacy}`);
      router.refresh();
    } catch { setError(true); }
    finally { setPending(false); }
  }
  return <form onSubmit={onSubmit} className={styles.form}><button type="submit" className={styles.button} disabled={pending}>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</button>{error && <p role="alert">No se pudo cerrar sesión. Intenta nuevamente.</p>}</form>;
}
