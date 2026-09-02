# Pruebas del contador y compatibilidad

## Ejecución

Desde `Cajero`, con las dependencias instaladas y Node.js 24:

```powershell
npm.cmd run test:cash
npm.cmd test
.\node_modules\.bin\tsc.cmd --noEmit
git diff --check
```

`test:cash` compila el código TypeScript y ejecuta `tests/cashRobustness.test.js`.
`npm test` conserva las suites existentes y añade esta batería. No instala dependencias nuevas.
Node puede mostrar una advertencia experimental de `node:sqlite`; no es un fallo de las pruebas.

## Cobertura nueva

| Grupo | Pruebas | Qué comprueba |
| --- | ---: | --- |
| Denominaciones y cálculos | 45 | Las diez denominaciones, cero/un billete/cantidades grandes, datos antiguos, listas alternativas y 250 mezclas deterministas. |
| Flujos con SQLite real | 22 | Entradas, salidas, eliminación, saldo insuficiente, límites del historial, notas, borradores, migraciones idempotentes, reapertura de archivo y 120 operaciones encadenadas. |
| Validación defensiva | 47 | Negativos, fracciones, texto, nulos, denominaciones desconocidas, desbordamientos, saldo ausente, JSON inválido y coherencia entre total y desglose. |
| Ventas y resumen | 4 | Conciliación de ventas/retiros/conteo, independencia de tablas y rollback de una venta que falla en su segundo producto. |
| Atomicidad y cambio de día | 9 | Rollback al fallar saldo/historial/eliminación/marcador diario, reinicio una sola vez y movimientos después de medianoche. |
| **Total nuevo** | **127** | Los 250 conteos y las 120 operaciones son escenarios internos de dos pruebas, no se suman como pruebas adicionales. |

## Correcciones respaldadas por las pruebas

- Las escrituras de caja validan denominaciones, cantidades enteras no negativas y precisión segura en centavos.
- Los borradores con valores como `-1`, `1.5` o `2abc` se rechazan antes de mostrar la confirmación; la pantalla muestra `Conteo inválido`.
- Los movimientos verifican que el total coincida con su desglose, también al eliminarlos.
- Un saldo guardado inválido o ausente bloquea la lectura/operación en vez de tratarse silenciosamente como cero. Las pruebas de corrupción conservan el marcador del día actual; no cambian la política existente de reinicio diario.
- Los borradores con una estructura JSON incorrecta se leen como vacíos sin escribir encima del dato original.
- Se conservan los cambios existentes de reinicio diario y fecha local; esta batería los verifica, no sustituye su política.

## Aislamiento y límites

Se ejecutan las migraciones y los repositorios reales sobre SQLite. El adaptador de pruebas sustituye únicamente el puente asíncrono de Expo; mapea los resultados de inserción y ejecuta transacciones reales.
Los fallos de escritura se provocan con triggers SQLite que abortan la operación, comprobando después saldo, historial y ajustes.

La mayoría de bases viven en memoria. Una prueba crea un archivo dentro de un directorio temporal `cajero-cash-test-*`, lo cierra, lo reabre y elimina únicamente ese archivo/directorio de prueba al finalizar.
No se abren bases del usuario, no se cambia el reloj/zona horaria del equipo y no se genera ni publica un APK.

Estas pruebas **no** acreditan interacción visual, teclado, temporizadores de la interfaz, concurrencia de conexiones nativas, cierres forzados del proceso Android ni ejecución en un teléfono.

## Comprobación manual pendiente en un teléfono de pruebas

1. Abrir Contador con datos anteriores: comprobar las ocho denominaciones antiguas y las nuevas filas de 2000/5000, también en Caja (Saldo Guardado).
2. Contar 2 billetes de 5000, 3 de 2000, 1 de 1000 y 2 de 50: total esperado **17 100**. Confirmar AGREGAR y comprobar desglose e historial.
3. RESTAR 1 de 5000 y 1 de 2000: deben quedar **10 100**. Intentar retirar más billetes disponibles y verificar que nada cambia.
4. Probar RESET del borrador: debe limpiar el conteo, no el saldo guardado. Editar, esperar el guardado y reabrir la app para verificar persistencia.
5. Pegar una cantidad negativa, decimal, alfanumérica o excesiva: AGREGAR/RESTAR debe mostrar `Conteo inválido`, sin diálogo de confirmación ni movimiento nuevo.
6. Eliminar una salida y comprobar que devuelve sus billetes; probar DESHACER durante su ventana de espera y confirmar que no altera el saldo.
7. Revisar desplazamiento hasta las denominaciones pequeñas, foco del teclado y sección inferior en una pantalla estrecha.
8. Con datos de prueba, verificar suspensión/reanudación y cambio de día según `docs/day-change-qa.md`. No utilizar una caja real para simular cambios de fecha.
