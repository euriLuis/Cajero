# Resumen: facturación por producto y editor de ventas

## Validación automática

```powershell
npm.cmd run test:summary
npm.cmd test
.\node_modules\.bin\tsc.cmd --noEmit
git diff --check
```

Las 14 pruebas de `summaryRevenue.test.js` usan SQLite real aislado y los repositorios de la aplicación. Comprueban importes en centavos, precios históricos distintos, nombres largos, productos gratuitos, fechas límite, ediciones, eliminaciones, rollback y 100 ventas mixtas.

En cada escenario se compara la suma del facturado por producto con `sumSalesByRange` para el mismo intervalo. Se suman los `line_total_cents` guardados, no el precio actual del catálogo. Se conserva la agrupación existente por nombre registrado en la venta. No se modifica el saldo físico del Contador ni se añade una consulta por producto.

## Comprobación visual pendiente

No hubo dispositivo Android conectado durante esta implementación. Estas verificaciones requieren Expo Go o una instalación de prueba:

1. Registrar ventas con nombres de varias líneas y abrir Resumen. El nombre debe mostrarse completo y debajo deben aparecer Cantidad y Facturado, sin salir de la tarjeta.
2. Vender 2 unidades de un producto a 100 y 3 unidades a 250: su tarjeta debe mostrar cantidad 5 y facturado 950, aunque después cambie el precio del catálogo.
3. Verificar que la suma de las tarjetas coincide con Facturado para Hoy, Ayer y una fecha elegida. La tarjeta de saldo teórico debe decir Esperado en caja; el Contador conserva la caja física.
4. Abrir una venta desde Historial y tocar Editar. Comprobar nombres completos, referencia Original, campos Cantidad/Precio unitario y Subtotal. En un teléfono estrecho los campos deben colocarse uno debajo del otro.
5. Abrir el teclado y desplazarse por una venta larga. La lista y Agregar producto deben desplazarse, dejando accesibles Guardar y Cancelar al pie. Cancelar debe tener texto oscuro legible.
6. Cambiar cantidad y precio, pulsar Cancelar y volver a editar: la venta debe conservar los datos anteriores.
7. Repetir y pulsar Guardar: el total del detalle debe actualizarse sin cerrar y reabrir. Volver a Resumen y comprobar cantidades/facturación actualizadas.
8. Repetir en pantalla estrecha, orientación horizontal y con tamaño de texto aumentado. Esta batería automática no acredita medidas de píxeles, foco del teclado ni interacción nativa.
