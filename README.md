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
        app-shell.tsx            # Navbar y lateral interactivos
        app-shell.module.css
      privada/
        layout.tsx               # Diseño privado de Sebastián
        page.tsx                 # Panel privado
        private.css              # Estilos limitados a .private-module
        _components/             # POS, navegación y usuarios privados
        pos/                     # Punto de venta
        catalogo/                # Productos
        inventario/              # Stock y lotes
        ventas/                  # Historial
        caja/                    # Resumen de cobros
        compras/
        proveedores/
        indicadores/
        usuarios/
        sin-acceso/
      asistencial/
        layout.tsx               # Navbar azul y lateral plegable de Isidora
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
  generated/                     # Clientes generados por Prisma
```

Los componentes exclusivos de una página van en su carpeta `_components`; los compartidos entre farmacias van en `(dashboard)/_components`. Los estilos visuales propios se mantienen en archivos `.module.css`, junto al componente. `globals.css` contiene solo estilos base. Los futuros endpoints se agregan en `app/api` y las funciones de servidor compartidas en `lib`.

Farmacia Privada conserva el diseño y los módulos de la rama `sebastian`. Farmacia Asistencial usa el navbar azul y el lateral plegable de Isidora, con el área de trabajo vacía. El panel anterior sigue disponible como código de ejemplo en `asistencial/_components`, pero no se monta sobre el nuevo diseño.

Los estilos de Farmacia Privada están delimitados por `.private-module`; los de Asistencial usan CSS Modules. Así, navegar entre ambas secciones no mezcla sus diseños. Las URLs públicas se mantienen: `/privada`, sus subsecciones y `/asistencial`.

La migración de catálogo integrada admite que `codigoCatalogo` ya exista por la carga de Isidora y completa ATC y fuente sin reemplazar medicamentos. Se conserva `datosCatalogo` junto con las nuevas fichas y tablas de ventas. En una base que ya haya aplicado la versión original de `202611090002_catalogo_inicial`, revisar el historial de migraciones antes de usar `prisma migrate dev`, porque esta rama adapta esa migración para compatibilizar las dos cargas.

## Catálogo inicial de medicamentos privados

Los archivos originales están en `prisma/data/`. El TypeScript se conserva como `.source.txt` y se analiza con el parser de TypeScript como datos, sin ejecutarlo. Sus 40 medicamentos coinciden con entradas del JSON, que contiene 45 medicamentos únicos y aporta los detalles de presentación.

Después de aplicar las migraciones de Farmacia Privada:

```sh
npm run db:medicamentos:validar
npm run db:medicamentos:privada
```

La carga afecta únicamente a Farmacia Privada y puede repetirse sin duplicar los registros. Los identificadores `MED-xxx` se guardan en `codigoCatalogo`, separados de `codigoBarra`. `datosCatalogo` conserva los datos originales de ambos archivos, incluidos ATC, registro ISP, laboratorio, almacenamiento y observaciones; estos datos se importan tal como fueron entregados, sin una verificación externa nueva. Nombre, principio activo, concentración, forma farmacéutica y categoría también se guardan en sus campos habituales.

No se generan precios, códigos de barras, lotes ni stock. Los cinco medicamentos sin presentación verificada conservan concentración y forma farmacéutica vacías. Cada carga usa una transacción; si falla una validación, se revierte esa carga sin eliminar registros existentes.

