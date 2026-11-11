# Sistema de Farmacias — aplicación Next.js

El frontend y las rutas API viven en este mismo proyecto. Next.js atiende las páginas y el backend mediante Route Handlers; Prisma se conecta a farmacia_privada y farmacia_asistencial en PostgreSQL Docker.

## Inicio

Desde la raíz del proyecto, en PowerShell:

    npm ci
    npm run db:up
    npm run db:deploy
    npm run dev

Abre http://localhost:3000. La comprobación de ambas bases está disponible en http://localhost:3000/api/health.

Para reproducir los datos de demostración de farmacia privada en una instalación nueva, después de `db:deploy` ejecuta:

    npm run demo:precios:privada
    npm run demo:pos:privada

La migración agrega los 40 nombres de medicamentos. El primer comando asigna precios **ficticios** a los que aún no tengan precio. El segundo crea tres productos `DEMO-POS-001` a `DEMO-POS-003` con precio, lote vigente y stock para ensayar ventas. Los scripts no duplican ni reemplazan datos existentes. Las ventas y otros cambios hechos directamente en PostgreSQL local no se suben a GitHub.

La planilla integrada de Chile está reproducida en `prisma/data/medicamentos-chile.json`. Después de aplicar las migraciones, importa sus 45 fichas con:

    npm run import:medicamentos:chile

La importación crea los 5 medicamentos faltantes y actualiza las fichas de los 40 existentes. El ejemplo de registro ISP, concentración y condición de venta queda en `FichaMedicamentoChile`, separado de la ficha genérica. No cambia el código de barras, precio, stock ni la condición de venta usada por el POS. Los campos pendientes de verificación quedan vacíos.

## Bases de datos y Prisma

Las dos bases usan configuraciones, esquemas, migraciones y clientes independientes:

- farmacia_privada: prisma.privada.config.ts y prisma/privada/
- farmacia_asistencial: prisma.asistencial.config.ts y prisma/asistencial/

Los esquemas iniciales guardan medicamentos, categorías, lotes, stock, ubicaciones y movimientos. Para ver una base en Prisma Studio:

    npm run prisma:studio:privada
    npm run prisma:studio:asistencial

Detén el primer Studio con Ctrl+C antes de iniciar el otro.

## Páginas

- /: pantalla de selección entre farmacia privada y asistencial.
- /login/privada y /login/asistencial: acceso con correo o RUT y contraseña.
- /privada: módulo de farmacia privada.
- /asistencial: módulo de farmacia asistencial.
- /api/health: Route Handler de Next que consulta las dos bases.

El backend Express anterior ya no se inicia por separado. El panel muestra las áreas previstas; los demás endpoints CRUD se implementarán en Route Handlers de Next.

## Organización del código

La estructura sigue las convenciones de APPCONSTANCIAS: rutas agrupadas, componentes junto a su sección y servicios de servidor en `lib`.

```text
src/
  app/
    page.tsx                     # Selección de farmacia
    page.module.css
    layout.tsx                   # HTML y estilos base
    globals.css
    login/                       # Formulario, esquema y operaciones de acceso
      [pharmacy]/page.tsx        # Login de cada farmacia
      _components/              # Formulario y estilos INACAP
    (dashboard)/                 # Grupo que no modifica las URLs
      _components/
        app-shell.tsx            # Marco compartido y estado del lateral
        app-navbar.tsx           # Navbar y menú del usuario
        app-sidebar.tsx          # Lateral de escritorio y diálogo móvil
        app-sidebar-trigger.tsx  # Botón para abrir y cerrar
        sidebar-nav.tsx          # Enlaces y selección activa
        app-shell.module.css
      privada/
        layout.tsx               # Sesión y marco compartido
        page.tsx                 # Redirige al Panel
        privada.css              # Estilos limitados a .private-module
        panel/
        punto-de-venta/
          _components/
            punto-de-venta.tsx
        productos/
        stock-y-lotes/
        historial/
        caja/
        compras/
        proveedores/
        reportes/
        usuarios-y-roles/
          _components/
            usuarios-y-roles.tsx
        sin-acceso/
      asistencial/
        layout.tsx               # Sesión, navbar y lateral compartidos
        page.tsx                 # Área de trabajo vacía
        _components/
          example-dashboard.tsx
          example-dashboard.module.css
    api/
      auth/[pharmacy]/route.ts   # Inicio y cierre de sesión
      health/route.ts            # Estado de ambas bases
  lib/
    auth/                        # Credenciales y sesiones de ambas farmacias
    db/
      prisma-privada.ts
      prisma-asistencial.ts
    private/                     # Autenticación, permisos y acceso de administrador
    types/                       # Tipos de Punto de venta y Usuarios y roles
  generated/                     # Clientes generados por Prisma
```

Los componentes exclusivos de una página van en su carpeta `_components`; los compartidos entre farmacias van en `(dashboard)/_components`. Los estilos visuales propios se mantienen en archivos `.module.css`, junto al componente. `globals.css` contiene solo estilos base. Los futuros endpoints se agregan en `app/api` y las funciones de servidor compartidas en `lib`.

Ambas farmacias usan el marco de navegación compartido. Los módulos privados mantienen su funcionalidad, con sus opciones en el lateral. Farmacia Asistencial conserva el área de trabajo vacía. El panel anterior sigue disponible como código de ejemplo en `asistencial/_components`, pero no se monta sobre el nuevo diseño.

Los estilos de Farmacia Privada están delimitados por `.private-module`; el marco compartido y el login usan CSS Modules. Así, navegar entre ambas secciones no mezcla sus diseños.

Los nombres de las carpetas privadas coinciden con los del menú. Se usan minúsculas y guiones en los nombres que contienen espacios:

| Sección visible | Carpeta dentro de `src/app/(dashboard)/privada` | URL |
| --- | --- | --- |
| Panel | `panel` | `/privada/panel` |
| POS (navbar) | `punto-de-venta` | `/privada/punto-de-venta` |
| Productos | `productos` | `/privada/productos` |
| Stock y lotes | `stock-y-lotes` | `/privada/stock-y-lotes` |
| Proveedores | `proveedores` | `/privada/proveedores` |
| Compras | `compras` | `/privada/compras` |
| Caja | `caja` | `/privada/caja` |
| Historial | `historial` | `/privada/historial` |
| Reportes | `reportes` | `/privada/reportes` |
| Usuarios y roles | `usuarios-y-roles` | `/privada/usuarios-y-roles` |

`/privada` abre el Panel. Las rutas antiguas (`pos`, `catalogo`, `inventario`, `ventas`, `indicadores` y `usuarios`) redirigen a sus equivalentes nuevos mediante `next.config.ts`. Las API conservan sus URLs y las claves de permisos conservan sus valores para mantener la compatibilidad con las integraciones y roles guardados.

### Formato del código

Se usa Biome 2.3.6 con el estilo de APPCONSTANCIAS: sangría de dos espacios, imports organizados y JSX legible en varias líneas. ESLint mantiene la revisión de reglas de React y Next.js.

```sh
npm run format        # Ordenar imports y aplicar formato
npm run format:check  # Comprobar formato sin modificar archivos
npm run check         # Validar esquemas, tipos y reglas de código
```

`.editorconfig` mantiene la sangría, UTF-8 y finales de línea consistentes. El formateador excluye clientes generados, datos originales y migraciones ya aplicadas. Los esquemas Prisma se ordenan con `prisma format`, sin modificar la base de datos.

La migración de catálogo integrada admite que `codigoCatalogo` ya exista por la carga de Isidora y completa ATC y fuente sin reemplazar medicamentos. Se conserva `datosCatalogo` junto con las nuevas fichas y tablas de ventas. En una base que ya haya aplicado la versión original de `202611090002_catalogo_inicial`, revisar el historial de migraciones antes de usar `prisma migrate dev`, porque esta rama adapta esa migración para compatibilizar las dos cargas.

## Tabla de usuarios y roles

`/privada/usuarios-y-roles` muestra una tabla administradora basada en APPCONSTANCIAS. Incluye estado activo/inactivo, ID, nombre, apellido, rol, correo, RUT, teléfono, creación y actualización, además de un menú **Acciones** (ver detalles, editar usuario y eliminar con confirmación).

La tabla usa TanStack Query, Table, Virtual y Match Sorter para consultas, búsqueda aproximada, ordenación, carga incremental y virtualización. La búsqueda y la ordenación se aplican a todos los registros en el servidor, no solo a las filas cargadas. Hay esqueleto de diez filas, indicador de actualización, estados vacíos, reintentos y desplazamiento horizontal para celulares. Radix proporciona diálogos, menú y controles accesibles; React Hook Form y Zod validan los formularios y Sonner muestra las notificaciones.

La página original completa está conservada en `/privada/usuarios-y-roles/editar`. La opción **Editar usuario** del menú **Acciones** agrega `?usuario=ID`, muestra un formulario de edición del perfil seleccionado y mantiene debajo la gestión original de roles, permisos y creación de perfiles. No se muestran contraseñas ni hashes; una nueva contraseña es opcional en edición.

```text
usuarios-y-roles/
  page.tsx                      # Tabla de usuarios
  loading.tsx                   # Esqueleto de navegación
  actions.ts                    # Consultas y mutaciones HTTP
  _components/
    columns.tsx                 # Columnas y acciones de cada fila
    users-table.tsx
    table-skeleton.tsx
    new-user-dialog.tsx
    user-profile-form.tsx
    user-state-toggle.tsx
    user-actions.tsx
    user-details-dialog.tsx
    delete-user-dialog.tsx
    usuarios-y-roles.tsx         # Gestión anterior conservada
    usuarios-table.module.css
  editar/
    page.tsx                    # Edición seleccionada y gestión anterior
    loading.tsx
```

Los componentes reutilizables están en `src/components/data-table.tsx` y `src/components/ui`; el proveedor de consultas y notificaciones está en `src/app/providers.tsx`. Las consultas de servidor y la selección segura de campos están en `src/lib/private/users.ts`.

La API de usuarios conserva su respuesta de array sin parámetros para la gestión anterior. Con `?page=0` devuelve `{ data, totalRows, nextPage }` y acepta `pageSize`, `search`, `sort` y `direction`. Todas las operaciones exigen el rol Administrador. No se puede desactivar, cambiar de rol ni eliminar la propia cuenta administradora. Los hashes nunca se devuelven al cliente.

`scripts/test-users.mjs` recibe las credenciales de un administrador por stdin (`identifier` y `password`), comprueba los flujos HTTP con perfiles temporales propios y los retira al terminar. Las preferencias de estructura, formato y uso de APPCONSTANCIAS para futuras tareas están registradas en `AGENTS.md`.

## Catálogo inicial de medicamentos privados

Los archivos originales están en `prisma/data/`. El TypeScript se conserva como `.source.txt` y se analiza con el parser de TypeScript como datos, sin ejecutarlo. Sus 40 medicamentos coinciden con entradas del JSON, que contiene 45 medicamentos únicos y aporta los detalles de presentación.

Después de aplicar las migraciones de Farmacia Privada:

```sh
npm run db:medicamentos:validar
npm run db:medicamentos:privada
```

La carga afecta únicamente a Farmacia Privada y puede repetirse sin duplicar los registros. Los identificadores `MED-xxx` se guardan en `codigoCatalogo`, separados de `codigoBarra`. `datosCatalogo` conserva los datos originales de ambos archivos, incluidos ATC, registro ISP, laboratorio, almacenamiento y observaciones; estos datos se importan tal como fueron entregados, sin una verificación externa nueva. Nombre, principio activo, concentración, forma farmacéutica y categoría también se guardan en sus campos habituales.

No se generan precios, códigos de barras, lotes ni stock. Los cinco medicamentos sin presentación verificada conservan concentración y forma farmacéutica vacías. Cada carga usa una transacción; si falla una validación, se revierte esa carga sin eliminar registros existentes.

