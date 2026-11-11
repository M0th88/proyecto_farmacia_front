"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./example-dashboard.module.css";

const css = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

type Health = {
  status: string;
  basesDatos: {
    privada: { estado: string; medicamentos: number };
    asistencial: { estado: string; medicamentos: number };
  };
};

const modules = {
  privada: {
    name: "Farmacia privada",
    description: "Ventas, inventario y atención al público.",
    mark: "P",
    color: "violet",
    href: "/privada/panel",
    areas: [
      "Medicamentos",
      "Inventario",
      "Ventas y caja",
      "Recetas y convenios",
    ],
  },
  asistencial: {
    name: "Farmacia asistencial",
    description: "Pacientes, tratamientos y dispensación asistida.",
    mark: "A",
    color: "orange",
    href: "/asistencial",
    areas: [
      "Medicamentos",
      "Pacientes",
      "Dispensaciones",
      "Programas y remesas",
    ],
  },
} as const;
type ModuleKey = keyof typeof modules;

export function ExampleDashboard({ selected }: { selected?: ModuleKey }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      let timer: number | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = window.setTimeout(
            () => reject(new Error("Tiempo de espera agotado")),
            6000,
          );
        });
        const response = await Promise.race([
          fetch("/api/health", { cache: "no-store" }),
          timeout,
        ]);
        if (!response.ok) throw new Error("API no disponible");
        const result = (await response.json()) as Health;
        if (active) setHealth(result);
      } catch {
        if (active) setHealth(null);
      } finally {
        if (timer !== undefined) window.clearTimeout(timer);
        if (active) setChecking(false);
      }
    };
    void checkHealth();
    return () => {
      active = false;
    };
  }, []);
  const title = selected ? modules[selected].name : "Vista general";
  return (
    <div className={css("shell example")}>
      <aside className={css("sidebar")}>
        <Link href="/" className={css("brand")}>
          <span className={css("brand-icon")}>f</span>
          <span>
            <b>
              farma<span>+</span>
            </b>
            <small>GESTIÓN DE FARMACIA</small>
          </span>
        </Link>
        <p className={css("side-label")}>ESPACIOS DE TRABAJO</p>
        <nav aria-label="Módulos">
          <Link
            className={css(!selected ? "nav-item active" : "nav-item")}
            href="/"
          >
            <span>⌂</span>Vista general
          </Link>
          {(Object.keys(modules) as ModuleKey[]).map((key) => (
            <Link
              key={key}
              className={css(selected === key ? "nav-item active" : "nav-item")}
              href={modules[key].href}
            >
              <span className={css(modules[key].color)}>
                {modules[key].mark}
              </span>
              {modules[key].name}
            </Link>
          ))}
        </nav>
        <div className={css("side-bottom")}>
          <div className={css("help")}>
            <span>✦</span>
            <b>Todo en orden</b>
            <p>Tu espacio está listo para comenzar.</p>
          </div>
          <div className={css("user")}>
            <span className={css("avatar")}>SF</span>
            <span>
              <b>Equipo farmacia</b>
              <small>Administrador</small>
            </span>
          </div>
        </div>
      </aside>
      <main className={css("main")}>
        <header className={css("topbar")}>
          <div className={css("crumb")}>
            Inicio <span>/</span> <b>{title}</b>
          </div>
          <div
            className={css(
              "status " + (checking ? "wait" : health ? "good" : "bad"),
            )}
          >
            <i />
            {checking
              ? "Conectando"
              : health
                ? "Sistema conectado"
                : "API sin conexión"}
          </div>
        </header>
        {selected ? (
          <section className={css("hero module " + modules[selected].color)}>
            <span className={css("eyebrow")}>MÓDULO DE FARMACIA</span>
            <h1>{modules[selected].name}</h1>
            <p>{modules[selected].description}</p>
            <Link href="/" className={css("back")}>
              ← Volver al panel
            </Link>
            <span className={css("hero-mark")}>{modules[selected].mark}</span>
          </section>
        ) : (
          <section className={css("hero welcome")}>
            <div>
              <span className={css("eyebrow")}>PANEL DE GESTIÓN</span>
              <h1>
                Tu farmacia, <em>en buenas manos.</em>
              </h1>
              <p>Elige un espacio para comenzar a trabajar.</p>
            </div>
            <div className={css("pill-art")} aria-hidden="true">
              ✳　◒　✦
            </div>
          </section>
        )}
        <section className={css("stats")}>
          <article>
            <small>Estado del sistema</small>
            <strong className={css("state")}>
              {checking
                ? "Verificando…"
                : health
                  ? "Operativo"
                  : "Sin conexión"}
            </strong>
            <label>
              {health
                ? "Aplicación y bases conectadas"
                : "Revisa que la aplicación y Docker estén iniciados"}
            </label>
          </article>
          <article>
            <small>Catálogo privado</small>
            <strong>{health?.basesDatos.privada.medicamentos ?? "—"}</strong>
            <label>Medicamentos registrados</label>
          </article>
          <article>
            <small>Catálogo asistencial</small>
            <strong>
              {health?.basesDatos.asistencial.medicamentos ?? "—"}
            </strong>
            <label>Medicamentos registrados</label>
          </article>
          <article>
            <small>Catálogo total</small>
            <strong>
              {health
                ? health.basesDatos.privada.medicamentos +
                  health.basesDatos.asistencial.medicamentos
                : "—"}
            </strong>
            <label>En las dos bases de datos</label>
          </article>
        </section>
        {selected ? (
          <section className={css("content")}>
            <div className={css("section-heading")}>
              <div>
                <span className={css("eyebrow")}>GESTIÓN DIARIA</span>
                <h2>Áreas de trabajo</h2>
              </div>
            </div>
            <div className={css("area-grid")}>
              {modules[selected].areas.map((area) => (
                <div className={css("area")} key={area}>
                  {area}
                  <span>Próximamente</span>
                </div>
              ))}
            </div>
            <p className={css("db-note")}>
              Base de datos:{" "}
              <b>
                {selected === "privada"
                  ? "farmacia_privada"
                  : "farmacia_asistencial"}
              </b>
            </p>
          </section>
        ) : (
          <section className={css("content")}>
            <div className={css("section-heading")}>
              <div>
                <span className={css("eyebrow")}>GESTIÓN DIARIA</span>
                <h2>Elige tu módulo</h2>
                <p>Cada espacio mantiene su propia información y operación.</p>
              </div>
              <span className={css("count")}>
                02 <small>módulos</small>
              </span>
            </div>
            <div className={css("cards")}>
              {(Object.keys(modules) as ModuleKey[]).map((key) => {
                const item = modules[key];
                return (
                  <Link
                    className={css("module-card " + item.color)}
                    href={item.href}
                    key={key}
                  >
                    <div className={css("card-head")}>
                      <span className={css("card-mark")}>{item.mark}</span>
                      <span className={css("arrow")}>↗</span>
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className={css("areas")}>
                      {item.areas.map((area) => (
                        <span key={area}>
                          <i />
                          {area}
                        </span>
                      ))}
                    </div>
                    <div className={css("card-footer")}>
                      Entrar al módulo <b>→</b>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        <footer>
          farma+ <span>•</span> Sistema de gestión{" "}
          <small>Una experiencia más simple para cuidar mejor.</small>
        </footer>
      </main>
    </div>
  );
}
