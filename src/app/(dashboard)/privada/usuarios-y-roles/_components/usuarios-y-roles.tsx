"use client";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  PRIVATE_SECTIONS,
  type PrivatePermission,
} from "@/lib/private/permissions";
import type { Role, User } from "@/lib/types/usuarios-y-roles";
import { rolesQueryKey, usersQueryKey } from "../actions";

const plantillas = [
  ["Administrador", "Todas las vistas y gestión de perfiles"],
  ["Químico farmacéutico", "Supervisión de productos y operación"],
  ["Vendedor", "Mostrador, productos e inventario"],
  ["Cajero", "Mostrador, caja e historial"],
  ["Bodega", "Productos, lotes y compras"],
  ["Compras", "Proveedores, órdenes e inventario"],
];

export function UsuariosRoles() {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [nombreRol, setNombreRol] = useState("");
  const [descripcionRol, setDescripcionRol] = useState("");
  const [permisos, setPermisos] = useState<PrivatePermission[]>(["inicio"]);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState("");
  const cargar = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([
        fetch("/api/privada/admin/roles", { cache: "no-store" }),
        fetch("/api/privada/admin/usuarios", { cache: "no-store" }),
      ]);
      if (!r.ok || !u.ok) {
        setEnabled(false);
        return;
      }
      const rs = (await r.json()) as Role[];
      const us = (await u.json()) as User[];
      setRoles(rs);
      setUsers(us);
      setEnabled(true);
      setRolId((v) => v || String(rs[0]?.id ?? ""));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKey }),
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);
  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);
  function cambiarPermiso(key: PrivatePermission) {
    setPermisos((v) =>
      v.includes(key) ? v.filter((x) => x !== key) : [...v, key],
    );
  }
  async function crearRol(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const r = await fetch("/api/privada/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: nombreRol,
        descripcion: descripcionRol,
        permisos,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMessage(data.error ?? "No se pudo crear el rol.");
      return;
    }
    setNombreRol("");
    setDescripcionRol("");
    setPermisos(["inicio"]);
    setMessage("Rol creado.");
    await cargar();
  }
  async function crearUsuario(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const r = await fetch("/api/privada/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        apellido,
        rut,
        email,
        password,
        rolId: Number(rolId),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMessage(data.error ?? "No se pudo crear el perfil.");
      return;
    }
    setNombre("");
    setApellido("");
    setRut("");
    setEmail("");
    setPassword("");
    setMessage("Perfil creado.");
    await cargar();
  }
  async function guardarRol(role: Role) {
    const r = await fetch("/api/privada/admin/roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: role.id, permisos: role.permisos }),
    });
    const data = await r.json();
    setMessage(
      r.ok
        ? "Permisos guardados."
        : (data.error ?? "No se pudieron guardar los permisos."),
    );
    if (r.ok) await cargar();
  }
  async function actualizarUsuario(
    user: User,
    cambio: { activo?: boolean; rolId?: number },
  ) {
    const r = await fetch("/api/privada/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, ...cambio }),
    });
    const data = await r.json();
    setMessage(
      r.ok
        ? "Perfil actualizado."
        : (data.error ?? "No se pudo actualizar el perfil."),
    );
    if (r.ok) await cargar();
  }
  return (
    <div className="profile-admin">
      {!enabled && (
        <div className="pos-message" role="status">
          {loading
            ? "Cargando perfiles…"
            : "No se pudo cargar la gestión de perfiles. Comprueba tu sesión administradora y vuelve a intentar."}
        </div>
      )}
      {message && (
        <div className="pos-message" role="status">
          {message}
          <button type="button" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      <section className="pos-panel">
        <div className="pos-title">
          <div>
            <small>ROLES</small>
            <h2>Permisos por vista</h2>
          </div>
        </div>
        <div className="role-template-grid">
          {plantillas.map(([name, description]) => (
            <div key={name}>
              <b>{name}</b>
              <p>{description}</p>
            </div>
          ))}
        </div>
        <form className="profile-form" onSubmit={crearRol}>
          <h3>Crear un rol</h3>
          <div className="profile-form-row">
            <label>
              Nombre del rol
              <input
                value={nombreRol}
                onChange={(e) => setNombreRol(e.target.value)}
                required
                disabled={!enabled}
              />
            </label>
            <label>
              Descripción
              <input
                value={descripcionRol}
                onChange={(e) => setDescripcionRol(e.target.value)}
                disabled={!enabled}
              />
            </label>
          </div>
          <fieldset disabled={!enabled}>
            <legend>Vistas permitidas</legend>
            <div className="permission-grid">
              {PRIVATE_SECTIONS.filter((s) => s.key !== "usuarios").map((s) => (
                <label key={s.key}>
                  <input
                    type="checkbox"
                    checked={permisos.includes(s.key)}
                    onChange={() => cambiarPermiso(s.key)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            disabled={!enabled || !nombreRol || !permisos.length}
            type="submit"
          >
            Crear rol
          </button>
        </form>
        {enabled && (
          <div className="role-list">
            <h3>Roles existentes</h3>
            {roles.map((role) => (
              <div className="role-row" key={role.id}>
                <div>
                  <b>{role.nombre}</b>
                  <small>{role._count.usuarios} usuarios</small>
                </div>
                <div className="permission-grid">
                  {PRIVATE_SECTIONS.map((s) => (
                    <label key={s.key}>
                      <input
                        type="checkbox"
                        disabled={
                          role.nombre === "Administrador" ||
                          s.key === "usuarios"
                        }
                        checked={role.permisos.includes(s.key)}
                        onChange={() =>
                          setRoles((v) =>
                            v.map((x) =>
                              x.id === role.id
                                ? {
                                    ...x,
                                    permisos: x.permisos.includes(s.key)
                                      ? x.permisos.filter((p) => p !== s.key)
                                      : [...x.permisos, s.key],
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
                {role.nombre !== "Administrador" && (
                  <button type="button" onClick={() => void guardarRol(role)}>
                    Guardar permisos
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="pos-panel">
        <div className="pos-title">
          <div>
            <small>PERFILES</small>
            <h2>Crear usuario</h2>
          </div>
        </div>
        <form className="profile-form" onSubmit={crearUsuario}>
          <div className="profile-form-row">
            <label>
              Nombre
              <input
                required
                disabled={!enabled}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label>
              Apellido
              <input
                disabled={!enabled}
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </label>
            <label>
              RUT
              <input
                required
                disabled={!enabled}
                value={rut}
                onChange={(e) => setRut(e.target.value)}
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                required
                disabled={!enabled}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Contraseña inicial
              <input
                type="password"
                minLength={12}
                required
                disabled={!enabled}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Rol
              <select
                required
                disabled={!enabled}
                value={rolId}
                onChange={(e) => setRolId(e.target.value)}
              >
                {roles.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button disabled={!enabled} type="submit">
            Crear perfil
          </button>
        </form>
        {enabled && (
          <div className="profile-list">
            <h3>Perfiles registrados</h3>
            {users.map((user) => (
              <div className="profile-user-row" key={user.id}>
                <div>
                  <b>
                    {user.nombre} {user.apellido}
                  </b>
                  <small>
                    {user.email} · {user.rut}
                  </small>
                </div>
                <select
                  value={user.rolId}
                  onChange={(e) =>
                    void actualizarUsuario(user, {
                      rolId: Number(e.target.value),
                    })
                  }
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    void actualizarUsuario(user, { activo: !user.activo })
                  }
                >
                  {user.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
