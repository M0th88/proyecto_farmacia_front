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
      [farmacia]/                  # Rutas compartidas de Privada y Asistencial
        layout.tsx               # Sesión y marco compartido
        page.tsx                 # Redirige al Panel
        privada.css              # Estilos limitados a .private-module
        panel/
        punto-de-venta/
          _components/
            punto-de-venta.tsx
        productos-y-empaques/
          etiquetas/
        stocks-y-lotes/
        historial-y-reportes/
          [id]/
        caja-del-dia/
        compras/
        proveedores/
        usuarios/
          _components/
            users-table.tsx
        sin-acceso/
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

Privada y Asistencial usan el mismo panel, menú y módulos. Cada ruta lee y escribe en la base de su farmacia, con sesión y caché de consultas independientes. Las pantallas pendientes se muestran en ambas.

Los estilos de los módulos están delimitados por `.private-module`; el marco compartido y el login usan CSS Modules.

El navbar ocupa todo el ancho y queda fuera del contenedor que desplaza el sidebar. El logo INACAP y el botón del menú conservan su posición al abrir o cerrar la barra lateral. El lateral comienza debajo del navbar y no muestra el título Farmacia Privada. En móvil, el panel y su fondo se abren por debajo del navbar, manteniendo disponible el mismo botón para cerrarlo.

El lateral abre sus grupos por defecto. Cada grupo se puede plegar y el enlace de la página activa queda resaltado. Las carpetas de las páginas están dentro de `src/app/(dashboard)/[farmacia]`. Las rutas de la tabla también existen bajo `/asistencial`.

| Grupo | Opción | URL |
| --- | --- | --- |
| Acceso directo | Panel | `/privada/panel` |
| Acceso directo | Compras | `/privada/compras` |
| Almacén | Stocks y Lotes | `/privada/stocks-y-lotes` |
| Almacén | Otros Productos | `/privada/otros-productos` |
| Almacén | Ubicaciones | `/privada/ubicaciones` |
| Almacén | Cuarentena Sanitaria | `/privada/cuarentena-sanitaria` |
| Almacén | Cuarentena Transitoria | `/privada/cuarentena-transitoria` |
| Segregación de Productos | Segregar Productos | `/privada/segregar-productos` |
| Segregación de Productos | Productos Vencidos | `/privada/productos-vencidos` |
| Segregación de Productos | Retiro de Mercado | `/privada/retiro-de-mercado` |
| Segregación de Productos | Productos Rechazados | `/privada/productos-rechazados` |
| Segregación de Productos | Devoluciones a Proveedor | `/privada/devoluciones-a-proveedor` |
| Administrador | Productos y Empaques | `/privada/productos-y-empaques` |
| Administrador | Proveedores | `/privada/proveedores` |
| Administrador | Usuarios | `/privada/usuarios` |
| Administrador | Roles | `/privada/roles` |
| Administrador | Marcas | `/privada/marcas` |
| Reportes Generales | Auditoría FEFO | `/privada/auditoria-fefo` |
| Reportes Generales | Inventario Histórico | `/privada/inventario-historico` |
| Reportes Generales | Historial y Reportes | `/privada/historial-y-reportes` |
| Reportes Generales | Caja del Día | `/privada/caja-del-dia` |
| Navbar | POS | `/privada/punto-de-venta` |
| Productos y Empaques | Etiquetas de productos | `/privada/productos-y-empaques/etiquetas` |
| Historial y Reportes | Documento de venta | `/privada/historial-y-reportes/<número de venta>` |

`/privada` abre el Panel. `historial`, `reportes`, `ventas` e `indicadores` redirigen a Historial y Reportes. `caja`, `productos`, `stock-y-lotes` y sus demás alias conservan el acceso mediante las redirecciones de `next.config.ts`. Las API conservan sus URLs y las claves de permisos conservan sus valores para mantener la compatibilidad con las integraciones y roles guardados.

### Formato del código

Se usa Biome 2.3.6 con el estilo de APPCONSTANCIAS: sangría de dos espacios, imports organizados y JSX legible en varias líneas. ESLint mantiene la revisión de reglas de React y Next.js.

```sh
npm run format        # Ordenar imports y aplicar formato
npm run format:check  # Comprobar formato sin modificar archivos
npm run check         # Validar esquemas, tipos y reglas de código
```

`.editorconfig` mantiene la sangría, UTF-8 y finales de línea consistentes. El formateador excluye clientes generados, datos originales y migraciones ya aplicadas. Los esquemas Prisma se ordenan con `prisma format`, sin modificar la base de datos.

La migración de catálogo integrada admite que `codigoCatalogo` ya exista por la carga de Isidora y completa ATC y fuente sin reemplazar medicamentos. Se conserva `datosCatalogo` junto con las nuevas fichas y tablas de ventas. En una base que ya haya aplicado la versión original de `202611090002_catalogo_inicial`, revisar el historial de migraciones antes de usar `prisma migrate dev`, porque esta rama adapta esa migración para compatibilizar las dos cargas.

## Usuarios y Roles

El menú del usuario en el navbar incluye **Configuración**, que abre `/privada/configuracion` en una nueva pestaña. Cualquier usuario autenticado puede editar allí sus propios datos y contraseña, con el mismo formulario y validaciones de Usuarios. El formulario compartido está en `src/components/user-profile-form.tsx`. El rol y el estado de la cuenta son de solo lectura. `PATCH /api/privada/perfil` obtiene la cuenta desde la sesión, rechaza identificadores ajenos y campos de rol/estado, y nunca devuelve hashes. La gestión de roles y la edición de roles asignados siguen reservadas al Administrador en las rutas administrativas.

`/privada/usuarios` conserva la tabla de usuarios, el modal **Crear usuario** y sus acciones de ver detalles, editar y eliminar. La edición individual está en `/privada/usuarios/editar?usuario=ID`.

`/privada/roles` tiene su propia tabla con ID, nombre, descripción, vistas permitidas y cantidad de usuarios asignados. Usa el mismo componente `DataTable`, con búsqueda, ordenación, carga progresiva, virtualización, esqueletos y estados vacíos/de error. **Crear rol** y **Editar Roles** abren un modal con nombre, descripción y vistas permitidas, usando la misma estructura de formulario que Crear usuario. El menú de acciones solo incluye **Editar Roles** y **Eliminar Roles**; eliminar requiere confirmación.

Usuarios y Roles aparecen por separado en el sidebar, en ese orden. Las rutas anteriores `/privada/usuarios-y-roles` y `/privada/usuarios-y-roles/editar?usuario=ID` redirigen a sus equivalentes en `/privada/usuarios`, conservando los parámetros. El componente histórico de gestión combinada se conserva en `usuarios/_components/usuarios-y-roles.tsx`, fuera de las vistas nuevas.

Los componentes exclusivos están en `usuarios/_components` y `roles/_components`. La tabla y los estilos compartidos están en `src/components/data-table.tsx` y `src/components/admin-table.module.css`. Radix proporciona los modales y menús; React Hook Form y Zod validan los formularios y Sonner muestra las notificaciones.

Las API de usuarios y roles mantienen la respuesta de array sin parámetros. Con `?page=0` devuelven `{ data, totalRows, nextPage }` y admiten `pageSize`, `search`, `sort` y `direction`. Todas las operaciones requieren Administrador. No se puede modificar ni eliminar el rol Administrador, asignar permisos administrativos a otros roles ni eliminar roles con usuarios asignados. Las claves de permisos existentes se conservan.

`node scripts/test-roles.mjs` verifica la API de roles con una base simulada, sin modificar datos reales. `scripts/test-users.mjs` mantiene las pruebas HTTP de usuarios, recibiendo credenciales administradoras por stdin.

Crear usuario formatea automáticamente los puntos y el guion del RUT. El teléfono móvil muestra `+56 9` fijo y permite ingresar sus ocho dígitos restantes, guardando el número completo. Al editar teléfonos fijos existentes se conserva su formato completo. La casilla Usuario activo se alinea con el campo de contraseña sin desplazarse por sus mensajes de validación; en pantallas pequeñas pasa debajo.

Crear usuario reutiliza los validadores ArkType y los requisitos de contraseña de APPCONSTANCIAS (`src/lib/types/users.ts`), integrados con React Hook Form y el esquema compartido de la API. El RUT exige puntos y guion y también verifica el dígito con módulo 11; admite K/k y se guarda con K mayúscula. El correo se valida y normaliza a minúsculas. APPCONSTANCIAS no contiene una regla de teléfono: aquí es opcional, admite nueve dígitos chilenos con prefijo +56 opcional y espacios, paréntesis o guiones, y se guarda con +56. La contraseña exige ocho caracteres, mayúscula, minúscula, número y carácter especial, con máximo 72 bytes por bcrypt. En edición, vacía conserva la actual. `node scripts/test-user-validation.mjs` verifica estas reglas y su aplicación en la API sin crear usuarios reales.

## Dashboard del Panel

`/privada/panel` muestra indicadores de ventas, operaciones, ticket promedio y unidades disponibles. El selector de 7, 14 y 30 días actualiza el gráfico diario, la comparación con el período anterior, la distribución por medios de pago, los productos más vendidos y las ventas recientes. Los cálculos usan fechas de Chile y datos reales de los últimos 60 días; los períodos sin ventas muestran estados vacíos y no incluyen datos de demostración.

El inventario resume las existencias actuales y sus alertas de stock mínimo y vencimiento. Las unidades disponibles excluyen lotes vencidos y productos inactivos. Los gráficos SVG y CSS son interactivos y adaptables, con valores accesibles y sin dependencias adicionales. El botón Actualizar recarga los datos del servidor existente. `node scripts/test-panel.mjs` verifica períodos, comparaciones, pagos, productos, fechas e inventario con datos simulados.

## Productos

`/privada/productos-y-empaques` usa la misma tabla que Usuarios y Stocks y Lotes, con búsqueda, ordenación, carga progresiva, virtualización y estados de carga/error. Conserva las tarjetas de Productos, Sin precio, Sin código de barras y Sin clasificar.

**Añadir productos** abre un modal con nombre, códigos de barras/catálogo/ATC, fuente, principio activo, concentración, forma farmacéutica, categoría existente o nueva, condición de venta, precio en CLP, stock mínimo y estado activo. Una sección desplegable permite ingresar todos los campos manuales de `FichaMedicamentoChile`, incluidos registro ISP, laboratorio, vía de administración, almacenamiento y observaciones. Identificadores, fechas de auditoría y metadatos JSON de importación son administrados por el sistema. Las existencias y los lotes se registran en Stock y lotes.

`GET /api/privada/productos` admite los mismos filtros de paginación que las otras tablas; `opciones=1` entrega categorías. `POST` crea el producto, su ficha y una categoría nueva en una sola transacción. Requiere Administrador o permiso `catalogo`. Se validan importes, cantidades y códigos únicos; los campos opcionales vacíos se guardan como nulos. Añadir un producto actualiza también la tabla y las opciones de inventario. `node scripts/test-products.mjs` prueba estos flujos con una base simulada.

## Stock y lotes

Productos y Stock y lotes incluyen una columna **Acciones** fija a la derecha con **Ver detalles** y **Editar**. En Productos, **Eliminar** solo aparece para Administrador y la API comprueba ese rol; solo se eliminan productos sin lotes ni ventas, con confirmación. Los productos en uso pueden desactivarse desde Editar.

Stock y lotes no permite eliminar registros, ni siquiera como Administrador: no muestra esa opción y DELETE responde 405. Editar permite modificar número de lote, fechas y cantidad, con un motivo obligatorio y registro de ajuste. El lote y sus fechas son compartidos entre ubicaciones. Se comprueba la cantidad anterior para rechazar cambios sobre stock desactualizado. Editar un producto sin lotes abre el formulario para registrar su primer lote con el producto seleccionado.


`/privada/stocks-y-lotes` conserva las tarjetas de Productos, Stock bajo, Vencen en 30 días y Lotes vencidos. La lista usa la misma tabla reutilizable que Usuarios: filtro, ordenación en servidor, carga progresiva, virtualización, esqueletos y estados vacíos/de error. Cada fila representa un lote en una ubicación; los productos sin lotes también aparecen. Las tarjetas resumen el inventario completo, sin depender del filtro ni contar dos veces los lotes repartidos entre ubicaciones.

**Añadir stock** usa el mismo modal y estructura de formulario que Crear usuario. Permite seleccionar producto, número de lote, fabricación opcional, vencimiento, ubicación, cantidad y motivo opcional. Si no existe una ubicación adecuada, puede registrarse una de tipo Bodega o Vitrina. Los lotes existentes conservan sus fechas y la entrada suma unidades. No se aceptan cantidades negativas/fraccionarias, productos inactivos ni lotes vencidos.

`GET /api/privada/stock-y-lotes` admite `page`, `pageSize`, `search`, `sort`, `direction`; con `opciones=1` entrega productos y ubicaciones para el formulario. `POST` registra lote, ubicación, cantidad y movimiento de entrada en una transacción serializable. La página y la API requieren Administrador o el permiso `inventario`. `node scripts/test-stock.mjs` verifica validación, permisos, acumulación, trazabilidad, rollback, métricas, búsqueda y paginación con una base simulada, sin modificar el inventario real.

## Catálogo inicial de medicamentos privados

Los archivos originales están en `prisma/data/`. El TypeScript se conserva como `.source.txt` y se analiza con el parser de TypeScript como datos, sin ejecutarlo. Sus 40 medicamentos coinciden con entradas del JSON, que contiene 45 medicamentos únicos y aporta los detalles de presentación.

Después de aplicar las migraciones de Farmacia Privada:

```sh
npm run db:medicamentos:validar
npm run db:medicamentos:privada
```

La carga afecta únicamente a Farmacia Privada y puede repetirse sin duplicar los registros. Los identificadores `MED-xxx` se guardan en `codigoCatalogo`, separados de `codigoBarra`. `datosCatalogo` conserva los datos originales de ambos archivos, incluidos ATC, registro ISP, laboratorio, almacenamiento y observaciones; estos datos se importan tal como fueron entregados, sin una verificación externa nueva. Nombre, principio activo, concentración, forma farmacéutica y categoría también se guardan en sus campos habituales.

No se generan precios, códigos de barras, lotes ni stock. Los cinco medicamentos sin presentación verificada conservan concentración y forma farmacéutica vacías. Cada carga usa una transacción; si falla una validación, se revierte esa carga sin eliminar registros existentes.



### Cobro y documentos del POS privado

El POS guarda la venta y las salidas de stock por lote vigente en una misma transacción. Usa precios de catálogo con IVA incluido y desglosa la tasa general del 19 % sobre el importe después del descuento. El efectivo muestra el vuelto. Los demás medios registran la confirmación realizada en el terminal o en la cuenta bancaria.

Selecciona boleta o factura antes de confirmar. Para factura, completa los datos de facturación. Desde la confirmación o el historial se puede abrir la vista previa, imprimirla o guardarla como PDF. El folio tributario y la emisión electrónica quedan pendientes de integración con el SII. Las ventas anteriores conservan su comprobante interno.

La apertura, los movimientos, el cierre de caja, el directorio de clientes, las anulaciones y las devoluciones tienen controles deshabilitados hasta que se implemente su registro. La consulta de stock usa la sección Stock y lotes existente.

La base privada requiere la migración `202611240001_documentos_pos`. En la base de destino autorizada, aplica `npm run prisma:deploy:privada` y ejecuta `npm run prisma:generate:privada` si aún falta regenerar el cliente.


### Etiquetas de productos

En Productos y Empaques, abre **Generador de etiquetas** o elige **Etiqueta de código de barras** desde las acciones de un artículo. Para vender unidades de un envase por separado, usa una ficha con el precio y stock de la unidad. **Generar y guardar código** asigna un código interno Code 128 al producto sin código. El POS lo reconoce a través del campo de código de barras habitual. Los códigos ya guardados se conservan.

La pantalla permite seleccionar varios productos, asociar lote y ubicación existentes, completar datos opcionales del envase y elegir copias y orientación por fila. **Imprimir** abre el diálogo del navegador con las etiquetas preparadas.


### Aislamiento y superadministración

Las rutas `/privada` y `/api/privada` usan `DATABASE_URL_PRIVADA`. Las de Asistencial usan `DATABASE_URL_ASISTENCIAL`. Ejecuta `npm run prisma:deploy:asistencial` para instalar la estructura equivalente en Asistencial. La migración conserva sus cuentas, productos y existencias.

Configura `SUPERADMIN_EMAIL` y `SUPERADMIN_RUT` con la identidad autorizada. El correo y el RUT deben coincidir con una cuenta activa con rol Administrador en cada base. Cada acceso valida la contraseña registrada en esa farmacia. Solo esa identidad puede mantener acceso a las dos. El alta y los cambios de identidad rechazan correos o RUT asociados a la otra farmacia. Para duplicados anteriores a este cambio conserva el acceso la cuenta de Privada.

`node scripts/test-pharmacy-isolation.mjs` verifica el acceso, la separación de sesiones y la selección de base con datos ficticios.
