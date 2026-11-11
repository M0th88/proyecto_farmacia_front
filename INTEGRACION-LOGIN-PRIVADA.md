# Contrato para integrar el login privado

El login está implementado para ambas farmacias. Desde la portada, cada botón rojo abre `/login/privada` o `/login/asistencial`; después de autenticar se ingresa al módulo correspondiente.

## Organización del login

- `src/app/login/[pharmacy]/page.tsx`: valida la farmacia y redirige si ya hay sesión.
- `src/app/login/_components/login-card.tsx`: formulario compartido con el diseño de referencia INACAP.
- `src/app/login/loginSchema.ts`: validación con Zod.
- `src/app/login/actions.ts`: llamadas del formulario a la API de autenticación.
- `src/app/api/auth/[pharmacy]/route.ts`: POST para iniciar sesión y DELETE para cerrarla; valida el origen de las solicitudes.
- `src/lib/auth/credentials.ts`: búsqueda por correo o RUT y comparación bcrypt.
- `src/lib/auth/session.ts`: firma, lectura y validación de sesiones; consulta el usuario activo en cada petición.

Se mantiene la separación de formulario, esquema, operaciones de acceso y servicios de servidor de APPCONSTANCIAS, usando las dependencias bcrypt/JWT ya presentes. La escritura de cookies usa `NextResponse` en Route Handlers para evitar el fallo de cookies observado en Server Actions en Next 16.4.6 con Cache Components.

## Datos existentes

- Los usuarios están en `farmacia_privada."Usuario"` y tienen `email`, `password` (hash bcrypt), `activo` y `rolId`.
- Los roles están en `farmacia_privada."Rol"`; la columna `permisos` contiene claves de vista. Las claves válidas se definen en `src/lib/private/permissions.ts`.
- Solo el rol de nombre `Administrador` puede llamar las API de creación y edición de perfiles y roles.

## Sesión esperada por la administración de perfiles

Al autenticar al usuario privado, el login debe crear una cookie HTTP-only llamada `farmacia_privada_session` con un JWT firmado con `JWT_SECRET` (32 caracteres o más). El JWT debe tener:

- `sub`: ID numérico del usuario como texto.
- `iss`: `farmacia-privada`.
- `aud`: `farmacia-privada`.
- Expiración definida por el login.

La cookie debe usar `Secure` en producción, `SameSite=Lax` y `Path=/`. El adaptador de lectura está en `src/lib/private/auth.ts`; si el login usa otra librería o formato de sesión, basta reemplazar `currentPrivateUser()` para que devuelva el usuario activo con su rol. No cambiar las API ni la lista de permisos.

Los layouts de ambas farmacias exigen sesión; las páginas privadas que consultan datos también la comprueban antes de acceder a Prisma. Las API de catálogo y ventas exigen sesión privada y la administración de perfiles conserva la comprobación del rol `Administrador`. La navegación aún muestra todas las secciones; la autorización detallada por cada clave de `rol.permisos` queda como ampliación del módulo.

La farmacia asistencial usa su propia base y cookie `farmacia_asistencial_session`, con emisor y audiencia `farmacia-asistencial`. Las cookies no son intercambiables. Los lectores de sesión solo devuelven los datos de perfil y rol, sin el hash de contraseña.

Sin marcar «Mantener la sesión iniciada», la cookie dura la sesión del navegador y el token vence a las 8 horas. Al marcarla, dura 30 días. El cierre elimina únicamente la cookie de la farmacia elegida. `JWT_SECRET` debe ser único, aleatorio y de al menos 32 caracteres; se configura en `.env` y no se publica.

Se aceptan correos sin distinguir mayúsculas y RUT con o sin puntos y guion. El acceso se limita temporalmente después de cinco intentos fallidos por identificador y farmacia. Este contador es local al proceso; si se despliega con varias instancias debe moverse a un almacenamiento compartido.

«Recuperar clave» muestra cómo solicitar ayuda al administrador; no envía correos ni modifica contraseñas. La recuperación por correo requiere configurar el proveedor y el flujo de tokens antes de habilitarla.

`scripts/test-login.mjs` prueba el formulario/API por HTTP. Recibe `identifier`, `rut` y `password` como JSON por stdin; no guarda credenciales. Opcionalmente `LOGIN_TEST_URL` permite cambiar la URL local de prueba. Comprueba acceso por correo/RUT, cookies, aislamiento entre farmacias, bloqueo sin sesión y cierre de sesión.

Para crear el primer administrador local, después de aplicar migraciones: `npm run admin:create:privada`. El script solicita nombre, RUT, correo y contraseña en la terminal. No hay credenciales predeterminadas.
