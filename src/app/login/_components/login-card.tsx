"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type Pharmacy, pharmacies } from "@/lib/auth/pharmacies";
import { loginAction } from "../actions";
import type { LoginState } from "../loginSchema";
import styles from "./login-card.module.css";

export function LoginCard({ pharmacy }: { pharmacy: Pharmacy }) {
  const [state, setState] = useState<LoginState>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setState({});
    try {
      const result = await loginAction(pharmacy, form);
      if (!result.success) {
        setState({ error: result.error ?? "No se pudo iniciar sesión." });
        return;
      }
      router.replace(`/${pharmacy}`);
      router.refresh();
    } catch {
      setState({ error: "No se pudo conectar. Intenta nuevamente." });
    } finally {
      setPending(false);
    }
  }
  return (
    <main className={styles.page}>
      <section
        className={styles.card}
        aria-label={`Inicio de sesión de ${pharmacies[pharmacy].name}`}
      >
        <div className={styles.brand}>
          <Image
            src="/inacap.svg"
            alt="INACAP"
            width={567}
            height={153}
            loading="eager"
            className={styles.logo}
          />
          <span className={styles.slogan}>
            APRENDER
            <br />
            HACIENDO
          </span>
        </div>
        <h1 className={styles.pharmacy}>{pharmacies[pharmacy].name}</h1>
        <form
          method="post"
          action={`/api/auth/${pharmacy}`}
          onSubmit={onSubmit}
          className={styles.form}
          aria-busy={pending}
        >
          <input type="hidden" name="pharmacy" value={pharmacy} />
          <label className={styles.intro} htmlFor="identifier">
            Ingresa tu correo electrónico o tu RUT:
          </label>
          <input
            className={styles.input}
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="Correo electrónico o RUT (Ej: 12345678-k)"
            defaultValue={state.identifier ?? ""}
            required
            maxLength={254}
            disabled={pending}
            aria-describedby={state.error ? "login-error" : undefined}
          />
          <label className={styles.srOnly} htmlFor="password">
            Contraseña
          </label>
          <div className={styles.passwordField}>
            <input
              className={styles.input}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Contraseña"
              required
              maxLength={72}
              disabled={pending}
              aria-describedby={state.error ? "login-error" : undefined}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={pending}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
              aria-controls="password"
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
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="m3 3 18 18" />}
              </svg>
            </button>
          </div>
          <label className={styles.remember}>
            <input
              type="checkbox"
              name="remember"
              defaultChecked={state.remember ?? false}
              disabled={pending}
            />
            Mantener la sesión iniciada
          </label>
          {state.error && (
            <p id="login-error" className={styles.error} role="alert">
              {state.error}
            </p>
          )}
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>
        </form>
        <details className={styles.recovery}>
          <summary>
            Recuperar clave. Click <span>aquí</span>.
          </summary>
          <p>
            Para restablecer tu contraseña, solicita ayuda al administrador del
            sistema. La recuperación por correo aún no está habilitada.
          </p>
        </details>
        <Link href="/" className={styles.back}>
          ← Volver a la selección de farmacia
        </Link>
      </section>
    </main>
  );
}
