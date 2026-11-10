# Farmacia privada en Chile: alcance y pendientes

## Ya implementado

- Catálogo privado separado de la base asistencial, con 40 medicamentos precargados, código ATC e identificador interno.
- POS con búsqueda y lector de código de barras tipo teclado, carrito, efectivo/tarjetas/transferencia, cálculo de vuelto y registro de venta.
- Descuento transaccional de stock por lotes vigentes, empezando por la fecha de vencimiento más cercana, con movimiento de salida.
- Historial de ventas, consulta de lotes, alertas de stock mínimo y vencimiento.
- Condición de venta por medicamento. Los productos quedan `SIN_CLASIFICAR` por defecto y el POS solo permite `VENTA_DIRECTA`. No asignar automáticamente condiciones de venta desde nombres genéricos: dependen del producto y registro específico.

## Antes de usar en una farmacia real

1. **Usuarios y permisos:** conectar los dos accesos que desarrolla el equipo; exigir sesión y roles en todas las rutas API, registrar operador y director técnico en acciones sensibles, y agregar auditoría inmutable. Actualmente las rutas del POS no tienen autenticación.
2. **Fichas de producto:** registrar presentación comercial, concentración, forma, registro ISP, laboratorio, condición de venta validada, código de barras real, precio, proveedor, costo y mínimo. Los 40 registros precargados son solo un catálogo de nombres; el script de demostración puede asignarles precios ficticios, pero no stock ni condición de venta. Los tres productos `DEMO-POS` son exclusivamente para pruebas.
3. **Recetas:** validación por profesional habilitado, tipo de receta, prescriptor, paciente, fecha, vigencia, archivo y vinculación con dispensación. Implementar retención y conservación conforme al tipo de receta. No desbloquear automáticamente `RECETA_SIMPLE`, `RECETA_RETENIDA` ni `RECETA_CHEQUE`.
4. **Controlados:** flujo separado para estupefacientes y psicotrópicos, con libros/registros, autorización, conciliación y restricciones específicas revisadas por el director técnico. La pantalla actual bloquea su venta.
5. **Documentos tributarios:** integrar proveedor de boleta/factura electrónica autorizado o solución del SII, folios, estado de emisión, anulación y conciliación de pagos. El ID de venta actual es interno y **no es una boleta**.
6. **Compras e inventario:** recepción de proveedores, lotes y vencimientos, ajustes aprobados, devoluciones, cuarentena, mermas, cadena de frío cuando aplique, conteos y trazabilidad de movimientos.
7. **Caja y operación:** apertura/cierre por turno, arqueo, conciliación con terminal de pago, devoluciones y notas de crédito, descuentos con permisos, reportes diarios y exportación contable.
8. **Protección de datos y operación:** políticas de acceso, respaldos, restauración, retención documental y revisión de seguridad y normativa antes de producción.

## Fuentes para la revisión funcional

- Reglamento de Farmacias, Decreto 466: https://www.bcn.cl/leychile/navegar?idNorma=13613
- Recomendaciones ISP de buenas prácticas de dispensación: https://www.ispch.cl/wp-content/uploads/2025/09/RECOMENDACIONES-BUENAS-PRACTICAS-DE-DISPENSACION.pdf
- Boleta electrónica, SII: https://www.sii.cl/destacados/boletas_electronicas/index.html

Las reglas concretas de dispensación y documentos deben validarse con el director técnico y el responsable tributario del establecimiento antes de poner el sistema en operación.
