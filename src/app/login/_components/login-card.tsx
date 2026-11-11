"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { pharmacies, type Pharmacy } from "@/lib/auth/pharmacies";
import { loginAction } from "../actions";
import type { LoginState } from "../loginSchema";
import styles from "./login-card.module.css";

export function LoginCard({ pharmacy }: { pharmacy: Pharmacy }) {
  const [state, setState] = useState<LoginState>({});
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setState({});
    try {
      const result = await loginAction(pharmacy, form);
      if (!result.success) { setState({ error: result.error ?? "No se pudo iniciar sesión." }); return; }
      router.replace(`/${pharmacy}`);
      router.refresh();
    } catch {
      setState({ error: "No se pudo conectar. Intenta nuevamente." });
    } finally { setPending(false); }
  }
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label={`Inicio de sesión de ${pharmacies[pharmacy].name}`}>
        <div className={styles.brand}>
          <Image src="/inacap.svg" alt="INACAP" width={567} height={153} loading="eager" className={styles.logo} />
          <span className={styles.slogan}>APRENDER<br />HACIENDO</span>
        </div>
        <h1 className={styles.pharmacy}>{pharmacies[pharmacy].name}</h1>
        <form method="post" action={`/api/auth/${pharmacy}`} onSubmit={onSubmit} className={styles.form} aria-busy={pending}>
          <input type="hidden" name="pharmacy" value={pharmacy} />
          <label className={styles.intro} htmlFor="identifier">Ingresa tu correo electrónico o tu RUT:</label>
          <input className={styles.input} id="identifier" name="identifier" type="text" autoComplete="username" placeholder="Correo electrónico o RUT (Ej: 12345678-k)" defaultValue={state.identifier ?? ""} required maxLength={254} disabled={pending} aria-describedby={state.error ? "login-error" : undefined} />
          <label className={styles.srOnly} htmlFor="password">Contraseña</label>
          <input className={styles.input} id="password" name="password" type="password" autoComplete="current-password" placeholder="Contraseña" required maxLength={72} disabled={pending} aria-describedby={state.error ? "login-error" : undefined} />
          <label className={styles.remember}><input type="checkbox" name="remember" defaultChecked={state.remember ?? false} disabled={pending} />Mantener la sesión iniciada</label>
          {state.error && <p id="login-error" className={styles.error} role="alert">{state.error}</p>}
          <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Iniciando sesión…" : "Iniciar sesión"}</button>
        </form>
        <details className={styles.recovery}>
          <summary>Recuperar clave. Click <span>aquí</span>.</summary>
          <p>Para restablecer tu contraseña, solicita ayuda al administrador del sistema. La recuperación por correo aún no está habilitada.</p>
        </details>
        <Link href="/" className={styles.back}>← Volver a la selección de farmacia</Link>
      </section>
    </main>
  );
}
