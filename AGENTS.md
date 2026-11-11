<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Organización y estilo del proyecto

- Usar APPCONSTANCIAS como referencia de estructura, comportamiento y componentes cuando corresponda. La referencia local está en `C:/Users/isiac/Desktop/APPCONSTANCIAS/app-constancias`.
- Mantener las secciones en `src/app/(dashboard)` y sus carpetas en español, con minúsculas y guiones, coincidiendo con los nombres del menú.
- POS es un alias visual del punto de venta y está en el navbar, a la izquierda del usuario; conservar la carpeta `punto-de-venta` y los nombres actuales de su código.
- Ubicar los componentes exclusivos de cada sección en su `_components`; los reutilizables en `src/components` y los tipos compartidos en `src/lib/types`.
- Mantener el código con Biome, sangría de dos espacios e imports ordenados. Ejecutar `npm run format` y las verificaciones apropiadas al cambio.
- Al adaptar tablas de APPCONSTANCIAS, conservar búsqueda, ordenación, carga progresiva, virtualización, estados vacíos/de error, acciones y esqueletos de carga, adaptándolos al modelo de farmacia.
- Evaluar primero las librerías y patrones de APPCONSTANCIAS para cada nueva funcionalidad. Reutilizar las dependencias pertinentes sin instalar herramientas ajenas a la función solicitada.
- Conservar páginas o componentes que la usuaria pida mantener y documentar sus nuevas rutas.
- Usar el servidor existente en `http://localhost:3000`; no iniciar servidores alternativos en otros puertos para las verificaciones.
