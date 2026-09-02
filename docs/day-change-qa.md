# Cambio de día del dispositivo

## Comportamiento

- Venta, Historial y Resumen comienzan siguiendo **Hoy**. Al llegar la medianoche local cambian al nuevo día sin reiniciar la app.
- **Ayer** sigue al día anterior del dispositivo. Una fecha histórica elegida en el calendario permanece fija, también al cambiar de zona horaria. Elegir la fecha de hoy vuelve a activar el seguimiento automático.
- Se comprueba el calendario al volver del segundo plano y al enfocar una pestaña. Mientras la app está activa hay un único temporizador compartido: se programa para medianoche o, como máximo, 30 segundos después para detectar ajustes manuales. No consulta SQLite si no cambia el día o el desfase horario.
- Ventas y extracciones resuelven nuevamente la fecha al confirmar. No dependen de que un temporizador suspendido haya podido ejecutarse.
- Los cambios de fecha invalidan las cargas anteriores. Las consultas de Historial y Resumen vuelven a calcular sus intervalos diarios/semanales.
- El carrito, las ediciones de ventas y el borrador del conteo no se limpian por actualizar el día.
- Contador conserva la política existente de reiniciar el **saldo guardado** cuando cambia la fecha local. El reinicio y su marcador son transaccionales; el primer movimiento del nuevo día aplica ese reinicio dentro de su propia transacción. No se borran movimientos históricos ni el borrador del conteo.
- Cancelar el calendario no modifica la selección. “Ayer” se calcula por días de calendario, no restando 24 horas.

## Validación automatizada

Ejecutar con Node.js 22.13+ (SQLite integrado) y las dependencias instaladas:

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npx.cmd expo export --platform android --output-dir .test-build/android-export
```

Las pruebas usan relojes simulados y procesos aislados en `America/Havana`, `America/New_York` y `Asia/Kolkata`; no modifican la configuración del equipo. Cubren medianoche, saltos hacia delante/atrás, suspensión, año/mes/bisiestos, horario de verano, limpieza de suscripciones y reinicios de caja con SQLite en memoria y rollback. La serialización del adaptador de pruebas no demuestra el comportamiento de bloqueo de las conexiones nativas.

## Pendiente de verificar en Android físico

Usar una instalación de prueba y datos desechables: cambiar la fecha ejecuta la política de reinicio diario de caja ya existente.

1. Preparar un carrito y dejar Venta abierta hasta medianoche. Verificar fecha nueva, carrito intacto y venta registrada en el Historial del nuevo día.
2. Repetir dejando Historial, Resumen y Contador visibles; comprobar listas y totales del día nuevo, salario semanal si es lunes y conteo en curso intacto.
3. Enviar cada pantalla al segundo plano, avanzar varios días desde Ajustes y volver. Debe actualizarse sin cerrar la app.
4. Retroceder la fecha y cambiar zona horaria. Verificar el día mostrado y los intervalos de consulta. Para cambios sin salir de la app, permitir hasta 30 segundos.
5. Elegir una fecha histórica, repetir los cambios y comprobar que siga fija. Probar Hoy y Ayer; cancelar el calendario no debe cambiar nada.
6. Dejar abierto un formulario de extracción o una confirmación de movimiento de caja durante medianoche. Guardar y verificar fecha/saldo, sin borrar el dinero recién registrado por un refresco posterior.
7. Cambiar rápidamente entre fechas mientras se cargan los datos. El último día seleccionado debe conservar sus resultados, sin recuperar los de una consulta anterior.

Referencia del ciclo de vida: [AppState de React Native](https://reactnative.dev/docs/0.81/appstate). Suscripción compartida: [useSyncExternalStore de React](https://react.dev/reference/react/useSyncExternalStore).
