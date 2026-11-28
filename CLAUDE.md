# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sistema de farmacias (Privada y Asistencial) en un solo proyecto Next.js: páginas + backend vía Route Handlers, Prisma 7 sobre dos bases PostgreSQL. El código, rutas, commits y documentación están en español. Lee también `AGENTS.md` y `README.md` (README documenta en detalle cada módulo: usuarios/roles, productos, stock, POS, etiquetas).

**Next.js de versión nueva con cambios incompatibles** (`cacheComponents`, `partialPrefetching`, `params` como Promise). Antes de escribir código de Next, consulta `node_modules/next/dist/docs/` en vez de confiar en conocimiento previo.

## Comandos

```sh
npm ci
npm run db:up            # Postgres 16 en Docker (crea farmacia_privada y farmacia_asistencial vía docker/init)
npm run db:deploy        # migrate deploy en ambas bases
npm run dev              # predev regenera ambos clientes Prisma; http://localhost:3000
npm run check            # prisma validate x2 + tsc --noEmit + eslint
npm run format           # Biome (formato + orden de imports); obligatorio antes de entregar cambios
npm run prisma:migrate:privada | prisma:migrate:asistencial   # nueva migración
npm run prisma:studio:privada  | prisma:studio:asistencial    # solo uno a la vez
npm run demo:precios:privada && npm run demo:pos:privada        # datos demo
npm run import:medicamentos:chile                               # fichas FichaMedicamentoChile
```

`.env` desde `.env.example`: `DATABASE_URL_PRIVADA`, `DATABASE_URL_ASISTENCIAL`, `JWT_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_RUT`. Health check: `/api/health`.

No hay framework de tests. Las pruebas son scripts Node independientes en `scripts/test-*.mjs`, ejecutados uno a uno: `node scripts/test-stock.mjs`. La mayoría (`test-roles`, `test-products`, `test-stock`, `test-panel`, `test-user-validation`, `test-pharmacy-isolation`) usan una base simulada y no tocan datos reales. `test-login` y `test-users` hacen HTTP contra el servidor en `localhost:3000` y reciben credenciales por stdin (JSON). Usa el servidor existente en el puerto 3000; no levantes otro en otro puerto.

## Arquitectura

**Dos farmacias, un código.** Todas las páginas viven en `src/app/(dashboard)/[farmacia]/…` y las APIs en `src/app/api/[farmacia]/…`, donde `farmacia ∈ {privada, asistencial}` (`src/lib/auth/pharmacies.ts`). La base se elige por el segmento de URL:
- Páginas: `resolvePharmacy(params)` (`lib/auth/pharmacy-scope.ts`) → 404 si no es válida.
- APIs: envolver el handler con `pharmacyRoute((request, pharmacy, db) => …)` (`lib/auth/pharmacy-route.ts`), que entrega el cliente correcto de `pharmacyDb()`.
- Nunca importar `prismaPrivada`/`prismaAsistencial` directamente en rutas compartidas; usar `pharmacyDb`.

**Prisma dual.** Cada base tiene su config (`prisma.privada.config.ts`, `prisma.asistencial.config.ts`), esquema y migraciones en `prisma/<base>/`. Los esquemas son equivalentes, por lo que ambos clientes runtime usan el tipo generado de `src/generated/privada/client` con adaptador `@prisma/adapter-pg` distinto. Al cambiar el esquema, aplica el cambio en ambas bases. Las migraciones ya aplicadas no se modifican (Biome las excluye); ojo con `202611090002_catalogo_inicial`, adaptada en esta rama.

**Auth y permisos.** Sesiones independientes por farmacia (`lib/auth/session.ts`, JWT con `JWT_SECRET`); login en `/login/[pharmacy]` y `api/auth/[pharmacy]`. Los permisos son claves string guardadas en roles (`lib/private/permissions.ts`: `inicio`, `pos`, `catalogo`, `inventario`, `ventas`, `usuarios`, `roles`, …); no renombrar las claves ni las URLs de API por compatibilidad. El rol Administrador es inmutable. Solo la identidad `SUPERADMIN_EMAIL`/`SUPERADMIN_RUT` puede tener cuenta en ambas farmacias; altas/cambios rechazan correos o RUT de la otra base.

**Lógica de servidor** en `src/lib/private/` (stock, productos, usuarios, dashboard, admin); a pesar del nombre, se usa para ambas farmacias. Las operaciones de inventario/venta usan transacciones (stock: serializable) y registran movimientos; stock no se elimina (DELETE → 405), solo se ajusta con motivo obligatorio y control de cantidad previa.

**Tablas y paginación.** Las APIs de listado devuelven un array sin parámetros; con `?page=0` devuelven `{ data, totalRows, nextPage }` y aceptan `pageSize`, `search`, `sort`, `direction`; `opciones=1` entrega opciones de formulario. En el cliente se usa `src/components/data-table.tsx` (TanStack Table + Virtual + React Query) con búsqueda, orden, carga progresiva, esqueletos y estados vacíos/error; mantener estas capacidades en tablas nuevas.

**Formularios:** React Hook Form + validadores ArkType/Zod compartidos con la API (`src/lib/types`, `src/lib/validation`); Radix para modales/menús, Sonner para toasts. RUT con puntos, guion y módulo 11; teléfono guardado con `+56`.

**Rutas y alias.** `next.config.ts` genera redirecciones de URLs antiguas (`/pos`, `/inventario`, `/ventas`, `usuarios-y-roles`, …) para ambas farmacias; al renombrar una sección, agrega el alias ahí.

## Convenciones (de AGENTS.md)

- Carpetas de sección en `(dashboard)/[farmacia]` en español, minúsculas con guiones, igual al nombre del menú. POS es alias visual de `punto-de-venta` (no renombrar la carpeta).
- Componentes exclusivos en el `_components` de su sección; reutilizables en `src/components`; compartidos del shell en `(dashboard)/_components`; tipos compartidos en `src/lib/types`.
- Estilos: CSS Modules junto al componente; estilos de módulos limitados a `.private-module` (`privada.css`); `globals.css` solo base.
- Biome 2.3.6, dos espacios, imports ordenados; ESLint para reglas React/Next.
- Usar APPCONSTANCIAS como referencia de patrones y librerías; no instalar dependencias ajenas a la función pedida.
- Documentar nuevas rutas en el README.

## Problemas conocidos del entorno de desarrollo

- **La página se recarga sola en bucle** (`✓ Compiled` + `GET` repetidos en la terminal): la caché de Turbopack en `.next` quedó desfasada, típicamente tras editar archivos que el observador no detectó o tras intentar un segundo `next dev` en la misma carpeta. Detén el servidor, borra `.next` y vuelve a ejecutar `npm run dev`. No levantes dos `next dev` en el mismo directorio.
- **Errores de hidratación por formato**: Node y el navegador traen versiones distintas de ICU (espacios especiales, "K"/"k", "nov"/"nov."). En componentes cliente usa los formateadores estables de `panel/_components/panel-charts.tsx` (`estable`, `hora`, `shortDay`) o formatea en el servidor y pasa el texto.
