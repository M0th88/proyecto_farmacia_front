# Contrato para integrar el login privado

La pantalla y la ruta de inicio de sesión pertenecen al trabajo de la otra desarrolladora. Este módulo no implementa ese login.

## Datos existentes

- Los usuarios están en `farmacia_privada."Usuario"` y tienen `email`, `password` (hash bcrypt), `activo` y `rolId`.
- Los roles están en `farmacia_privada."Rol"`; la columna `permisos` contiene claves de vista. Las claves válidas se definen en `src/lib/private-permissions.ts`.
- Solo el rol de nombre `Administrador` puede llamar las API de creación y edición de perfiles y roles.

## Sesión esperada por la administración de perfiles

Al autenticar al usuario privado, el login debe crear una cookie HTTP-only llamada `farmacia_privada_session` con un JWT firmado con `JWT_SECRET` (32 caracteres o más). El JWT debe tener:

- `sub`: ID numérico del usuario como texto.
- `iss`: `farmacia-privada`.
- `aud`: `farmacia-privada`.
- Expiración definida por el login.

La cookie debe usar `Secure` en producción, `SameSite=Lax` y `Path=/`. El adaptador de lectura está en `src/lib/private-auth.ts`; si el login usa otra librería o formato de sesión, basta reemplazar `currentPrivateUser()` para que devuelva el usuario activo con su rol. No cambiar las API ni la lista de permisos.

Antes de activar acceso real, la desarrolladora del login debe conectar la sesión al layout, filtrar la navegación por `rol.permisos` y proteger cada página y API privada. Actualmente la pantalla de roles solo permite guardar cuando la API confirma una sesión administradora; las demás vistas conservan el acceso previo del prototipo.

Para crear el primer administrador local, después de aplicar migraciones: `npm run admin:create:privada`. El script solicita nombre, RUT, correo y contraseña en la terminal. No hay credenciales predeterminadas.
