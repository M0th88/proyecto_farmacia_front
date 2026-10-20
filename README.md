# Sistema de Farmacias — aplicación Next.js

El frontend y las rutas API viven en este mismo proyecto. Next.js atiende las páginas y el backend mediante Route Handlers; Prisma se conecta a farmacia_privada y farmacia_asistencial en PostgreSQL Docker.

## Inicio

Desde la raíz del proyecto, en PowerShell:

    npm ci
    npm run db:up
    npm run db:deploy
    npm run dev

Abre http://localhost:3000. La comprobación de ambas bases está disponible en http://localhost:3000/api/health.

## Bases de datos y Prisma

Las dos bases usan configuraciones, esquemas, migraciones y clientes independientes:

- farmacia_privada: prisma.privada.config.ts y prisma/privada/
- farmacia_asistencial: prisma.asistencial.config.ts y prisma/asistencial/

Los esquemas iniciales guardan medicamentos, categorías, lotes, stock, ubicaciones y movimientos. Para ver una base en Prisma Studio:

    npm run prisma:studio:privada
    npm run prisma:studio:asistencial

Detén el primer Studio con Ctrl+C antes de iniciar el otro.

## Páginas

- /: panel general con estado de ambas bases.
- /privada: módulo de farmacia privada.
- /asistencial: módulo de farmacia asistencial.
- /api/health: Route Handler de Next que consulta las dos bases.

El backend Express anterior ya no se inicia por separado. El panel muestra las áreas previstas; los demás endpoints CRUD se implementarán en Route Handlers de Next.

