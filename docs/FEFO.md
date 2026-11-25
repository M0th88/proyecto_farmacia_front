# FEFO en farmacia privada

## Rutas y operación

- `/privada/punto-de-venta`: seleccionar sucursal, presentación, cantidades y pago; **Preparar lotes** muestra la asignación FEFO y los faltantes. Confirmar físicamente número de lote y cantidad de cada fila antes de registrar. Venta y dispensación conservan los mismos controles de condición de venta.
- `/privada/stocks-y-lotes`: se conserva la tabla existente con búsqueda, ordenación, carga progresiva, virtualización, acciones y métricas. **Añadir stock** abre el modal de recepción con producto/presentación, ubicación/sucursal, lote, rótulo de vencimiento, precisión, fabricación, recepción y cantidad.
- `/privada/stocks-y-lotes/control-fefo`: sucursales, ubicaciones, conciliación histórica, bloqueos, umbrales, próximos vencimientos, lista de retiro físico, traspasos, revisiones y trazabilidad por lote. Acceso desde Stocks y Lotes.
- `/privada/historial-y-reportes#operaciones-recientes`: estado de la operación, operador, sucursal, lote e ID de detalle necesario para registrar una devolución. Anular se realiza desde Control FEFO y **no** reincorpora unidades.

## Datos y migración

Para actualizar la base privada con FEFO y documentos del POS, ejecutar:

```sh
npm run prisma:generate:privada
npm run prisma:deploy:privada
```

Reiniciar el proceso Next después de aplicar las migraciones y regenerar Prisma. Si Documentos POS se instaló antes de FEFO, aplicar la actualización con el POS detenido para conservar las claves de cobro durante la transición. Las migraciones de compatibilidad restauran las claves existentes antes de reanudar los cobros.

Todos los lotes anteriores quedan `PENDIENTE_REVISION`; no se inventan rótulos, fechas de recepción ni sucursales. Los saldos permanecen para su conteo físico, pero no son vendibles. Crear las sucursales reales, asignar cada ubicación y conciliar físicamente los lotes con recepción comprobable antes de volver a venderlos. Un lote conserva su identidad por producto/presentación y número; cada ubicación tiene un saldo y la fecha de recepción más antigua de sus unidades. Si hay recepciones repetidas del mismo lote/ubicación, se mantiene esa fecha; el historial de movimientos conserva las entradas posteriores.

Las unidades recibidas sin lote o vencimiento verificables se guardan en `RevisionInventario`, separadas del saldo vendible. Los rótulos mes/año también se guardan allí con su precisión y texto originales. No se crean fechas ficticias. Las existencias anteriores sin lote individualizado deben conciliarse con un conteo físico y no compensarse mediante una liberación masiva.

La restricción `Stock_cantidad_no_negativa` bloquea nuevos saldos negativos; está creada como `NOT VALID` para no impedir la migración si existieran inconsistencias históricas. Revisar y corregir esos saldos durante la conciliación antes de validar la restricción con PostgreSQL.

## Criterio de vencimiento

Para fecha completa, se admite `DD/MM/AAAA` o `AAAA-MM-DD`, comprobando que sea una fecha real. Se conserva el texto recibido del envase y se obtiene un instante de corte al final de ese día en **America/Santiago**, incluyendo el horario de verano. Antes de descontar se exige que ese instante sea posterior a la hora del servidor. Esta es una decisión operativa implementada que debe ratificar el director técnico; no equivale a una interpretación normativa automática.

**Mes/año: pendiente**, según instrucción de la usuaria. No se aplica fin de mes ni se permite aprobar esas revisiones en esta versión. El campo `Sucursal.corteMes` permanece `PENDIENTE`, sin opción habilitada de cambio. Integrar posteriormente el criterio documentado por el director técnico.

FEFO ordena por vencimiento ascendente, luego recepción ascendente y finalmente ID estable. Solo considera saldos positivos, lote `APTO`, rótulo con precisión `DIA`, recepción comprobada y ubicación de la sucursal que entrega. Quedan excluidos vencidos, cuarentena, deterioro, retiros por alerta y pendientes. Si no alcanza un lote, se combina con el siguiente. Un faltante bloquea la confirmación.

## Confirmación, permisos y concurrencia

El servidor prepara una sugerencia consistente y vuelve a calcularla al confirmar. Una transacción PostgreSQL **Serializable** valida identidad, estado, vencimiento, cantidades, ubicación, condición de venta, precio y efectivo; descuenta con actualización condicional, crea venta/detalles y movimientos con usuario. Ante un conflicto retorna `409`; el operador actualiza la preparación y vuelve a verificar los lotes. No se fuerza un descuento ni se reintenta silenciosamente una asignación diferente.

Cada confirmación tiene UUID único para que un reintento de la misma operación no duplique salidas. La coincidencia también se comprueba con usuario, sucursal, tipo, pago, total y asignación de lotes. El total debe coincidir con el mostrado al preparar; si cambia el precio, hay que actualizarlo antes de confirmar.

El administrador conserva el acceso completo. Para los demás roles se reutilizan los permisos existentes y se añaden opciones en el formulario actual:

| Permiso | Alcance |
| --- | --- |
| `pos` | Preparar y confirmar ventas/dispensaciones |
| `inventario` | Recepción, consulta, bloqueo preventivo, retiro físico y traspaso |
| `inventario_configurar` + `inventario` | Sucursales, asignación de ubicaciones y umbrales |
| `inventario_liberar` + `inventario` | Conciliación y resolución de revisiones |
| `fefo_excepcion` + `pos` | Excepción solo si la sucursal tiene procedimiento y opción habilitados; exige motivo y permite elegir exclusivamente lotes aptos |
| `ventas_anular` | Anular sin reponer stock |
| `devoluciones` + `inventario` | Recibir una devolución física pendiente de revisión |

Solo el administrador administra roles. Deterioro y retiro por alerta no se pueden revertir desde edición, conciliación o cambio ordinario de estado. La modificación de lote/vencimiento vuelve a requerir revisión. Los medicamentos sujetos a receta o sin clasificación **siguen bloqueados**, como antes: FEFO no sustituye ni implementa la validación clínica/documental de recetas pendiente del sistema.

## Alertas, devoluciones y retiros

Umbrales iniciales: 7 y 30 días; se configuran por sucursal. Control FEFO permite filtrar próximos vencimientos y vencidos para su retiro físico. El retiro verifica el saldo, lo deja en cero y crea una salida con usuario, fecha, ubicación y motivo. No elimina el lote. El bloqueo por alerta se aplica al lote en todas sus ubicaciones.

La anulación cambia el estado de la venta y la excluye de totales de caja, reportes y panel. No modifica inventario ni ejecuta reembolsos bancarios. Registrar por separado las unidades efectivamente devueltas usando el ID de detalle del historial; no se admite devolver más de lo entregado. Esas unidades quedan pendientes, aun si la venta está anulada. La reincorporación exige permiso de liberación, revisión, lote apto y procedimiento de sucursal que autorice el reingreso. Dicha opción está deshabilitada inicialmente; no se reincorpora automáticamente por anular o recibir.

La consulta por lote incluye saldos, también agotados, y sus movimientos con operación, usuario y ubicación. El historial previo conserva las limitaciones de los registros originales: no se infieren operadores ni ubicaciones faltantes.

## Validación pendiente del director técnico

1. Ratificar corte al finalizar el día para rótulos con fecha completa y mantener relojes de servidor sincronizados.
2. Definir criterio para mes/año antes de habilitarlo en una integración posterior.
3. Registrar sucursales/ubicaciones reales, umbrales y responsables de conciliación y retiro.
4. Validar procedimiento y responsables de excepciones, cuarentenas y eventual reincorporación de devoluciones antes de activar opciones o asignar permisos.
5. Completar el procedimiento de receta y condición de venta antes de habilitar productos actualmente bloqueados.

Referencias de contexto: recomendaciones oficiales del ISP sobre [buenas prácticas de dispensación](https://www.ispch.gob.cl/wp-content/uploads/2025/09/RECOMENDACIONES-BUENAS-PRACTICAS-DE-DISPENSACION.pdf) y [buenas prácticas de farmacia](https://www.ispch.gob.cl/wp-content/uploads/2025/09/RECOMENDACIONES-BUENAS-PRACTICAS-DE-FARMACIA.pdf). La configuración local exige validación profesional; los valores iniciales del software no son una declaración de cumplimiento normativo.

## Pruebas reproducibles

Con la base migrada, `.env` local y el servidor existente en `http://localhost:3000`:

```sh
node scripts/test-fefo-integration.mjs
npm run format
npm run check
```

La prueba crea datos con prefijo y UUID exclusivos, autentica un usuario temporal y elimina únicamente sus propios datos en `finally`. Comprueba prioridad por vencimiento aunque la recepción sea posterior, desempate por recepción, combinación de lotes, confirmación física obligatoria, total actualizado, idempotencia, vencidos, última unidad concurrente, retiro auditado, anulación sin reposición, devolución pendiente, mes/año bloqueado y conservación del control de receta. Nunca utiliza credenciales de un usuario real ni deja medicamentos de demostración vendibles.
