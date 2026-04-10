# Refactorización del Proyecto — Resumen

> Documento generado durante la refactorización incremental del proyecto.
> Tecnologías: Expo + React Native + TypeScript + SQLite + React Navigation.

---

## Tabla de Contenidos

1. [Prioridad 1 — Hooks por pantalla](#prioridad-1--hooks-por-pantalla)
2. [Prioridad 2 — Helpers / Utils / Use Cases](#prioridad-2--helpers--utils--use-cases)
3. [Prioridad 3 — Reorganización por features](#prioridad-3--reorganización-por-features)
4. [Estructura final del proyecto](#estructura-final-del-proyecto)

---

## Prioridad 1 — Hooks por pantalla

### Objetivo
Extraer toda la lógica de negocio, estado y handlers fuera de las pantallas, dejando los componentes de UI lo más limpios posible.

### Hooks creados

| Hook | Archivo | Pantalla |
|------|---------|----------|
| `useProductsScreen` | `src/features/products/hooks/useProductsScreen.ts` | ProductsScreen |
| `useSaleScreen` | `src/features/sales/hooks/useSaleScreen.ts` | SaleScreen |
| `useHistoryScreen` | `src/features/history/hooks/useHistoryScreen.ts` | HistoryScreen |
| `useSummaryScreen` | `src/features/summary/hooks/useSummaryScreen.ts` | SummaryScreen |
| `useCashCounterScreen` | `src/features/cash/hooks/useCashCounterScreen.ts` | CashCounterScreen |

### Qué se extrajo de cada pantalla

**ProductsScreen** (~130 → ~85 líneas): carga con debounce, CRUD completo (create/update/deactivate), manejo de modal, validación de formulario.

**SaleScreen** (~770 → ~570 líneas): animaciones del modal, carga de productos, validación de cantidad, gestión del carrito (add/update/remove), confirmación de venta, persistencia del draft total.

**HistoryScreen** (~798 → ~525 líneas): carga de ventas por rango, modo edición completo (edit qty/price, delete/restore items, add new products), cálculos del edited total, save edits, delete sale.

**SummaryScreen** (~626 → ~477 líneas): carga de datos (sales/withdrawals/products sold), soft delete con timer, validación de monto, registro de extracciones, cleanup de timers.

**CashCounterScreen** (~756 → ~494 líneas): carga completa de datos, debounce save, reset diario, apply movement (IN/OUT), delete movement con undo toast, comparaciones de balance memoizadas, construcción de movement rows.

### Qué quedó en cada pantalla
- Estructura JSX
- Props hacia componentes memoizados
- Uso del hook (destrucción de estado y handlers)
- Render de FlatList y modales

---

## Prioridad 2 — Helpers / Utils / Use Cases

### Objetivo
Centralizar funciones puras de cálculo y validación para eliminar duplicación y hacer el código más declarativo.

### Archivos creados

| Archivo | Propósito | Funciones exportadas |
|---------|-----------|---------------------|
| `src/features/shared/utils/validation.ts` | Validaciones numéricas reutilizables | `validateQuantity`, `validateMonetaryAmount`, `validateEditPrice`, `resolveDraftQty`, `resolveDraftPrice`, `isValidPositiveInt`, `isValidNonNegativeCents` |
| `src/features/shared/utils/dateComparisons.ts` | Comparaciones de fecha local | `isToday`, `isYesterday`, `isSameDay` |
| `src/features/cash/utils/cashCalculations.ts` | Cálculos de caja/efectivo | `calculateTotalFromDraft`, `calculateTotalFromState`, `buildDenomsDelta`, `calculateDiff`, `calculateExpectedCash`, `classifyDiff`, `EMPTY_CASH_STATE`, `DEFAULT_DENOMS` |
| `src/features/summary/utils/salaryCalculations.ts` | Cálculo de salario (0.5%) | `calculateSalary`, `calculateDailySalary`, `calculateWeeklySalary` |
| `src/features/sales/utils/cartCalculations.ts` | Operaciones de carrito | `calculateCartTotal`, `addToCart`, `updateCartQty`, `removeFromCart`, `combineDateWithCurrentTime`, `CartItem` |

### Lógica duplicada eliminada

| Patrón | Dónde se repetía | Solución |
|--------|-----------------|----------|
| `qty >= 1` validation | 3 archivos (sale, history × 2) | `validateQuantity` (shared) |
| `denom * 100 * qty` total | 4 archivos (cash hook × 2, cashRepo, history) | `calculateTotalFromDraft` / `calculateTotalFromState` |
| `formatDateShort` comparisons (today/yesterday) | 2 archivos (summary, history) | `isToday` / `isYesterday` (shared) |
| `Math.round(sales * 0.005)` (salario) | 2 lugares dentro de summary | `calculateDailySalary` / `calculateWeeklySalary` |
| Cart add-or-merge | inline en sale hook | `addToCart` |
| Cart qty update + filter | inline en sale hook | `updateCartQty` |
| Draft qty resolution | duplicado en increment/decrement (history) | `resolveDraftQty` |
| `EMPTY_CASH_STATE` constant | cashRepo + cash hook | Centralizado en `cashCalculations.ts` |

### Qué quedó más simple

- **Hooks**: menos lógica inline, más declarativos. Cada cálculo es una llamada a función con nombre.
- **cashRepo**: eliminó ~10 líneas de constantes duplicadas, ahora importa desde utils.
- **Pantallas**: no tocaron su lógica (ya delegan a hooks), solo cambiaron imports de constantes.

---

## Prioridad 3 — Reorganización por features

### Objetivo
Mejorar la organización del proyecto por features, sin migración masiva riesgosa.

### Carpetas nuevas creadas

- `src/shared/` — fundamentos compartidos por todo el proyecto
- `src/features/*/screen/` — 5 subcarpetas, una por feature
- `src/features/*/index.ts` — 5 barrel exports

### Archivos movidos

| De → A | Archivos |
|--------|----------|
| `src/utils/` → `src/shared/utils/` | `money.ts`, `dates.ts` |
| `src/domain/models/` → `src/shared/domain/models/` | `Product.ts`, `Sale.ts`, `SaleItem.ts`, `Withdrawal.ts` |
| `src/types/` → `src/shared/types/` | `expo-vector-icons.d.ts` |
| `src/ui/screens/Products/` → `src/features/products/screen/` | `ProductsScreen.tsx` |
| `src/ui/screens/Sale/` → `src/features/sales/screen/` | `SaleScreen.tsx` |
| `src/ui/screens/History/` → `src/features/history/screen/` | `HistoryScreen.tsx` |
| `src/ui/screens/Summary/` → `src/features/summary/screen/` | `SummaryScreen.tsx` |
| `src/ui/screens/CashCounter/` → `src/features/cash/screen/` | `CashCounterScreen.tsx` |

### Imports actualizados
- **32 imports** actualizados en total: data layer (4), feature hooks (6), screens (5 copias), feature screens nuevas (5), AppNavigator (5), dateComparisons (1), cashRepo (1)

### Lo que se decidió NO mover todavía

| Qué quedó | Por qué |
|-----------|---------|
| `src/data/` (db + repos) | Capa de persistencia transversal. Moverlo implicaría cambiar ~20+ imports. Tiene su propia estructura lógica. |
| `src/ui/theme/` | Usado por ~15 archivos. Riesgo altísimo de romper imports para beneficio bajo. |
| `src/ui/components/` | Componentes UI genéricos reutilizables, no pertenecen a una feature específica. |
| `src/ui/navigation/` | Solo 1 archivo. Ya actualizado para apuntar a las nuevas ubicaciones. |

---

## Estructura final del proyecto

```
src/
├── data/                              ← Capa de persistencia (no movido)
│   ├── db/
│   │   ├── index.ts
│   │   ├── migrations.ts
│   │   └── sqlite.ts
│   └── repositories/
│       ├── index.ts
│       ├── cashRepo.ts
│       ├── productsRepo.ts
│       ├── salesRepo.ts
│       └── withdrawalsRepo.ts
│
├── features/                          ← Features por dominio
│   ├── cash/
│   │   ├── hooks/useCashCounterScreen.ts
│   │   ├── screen/CashCounterScreen.tsx
│   │   ├── utils/cashCalculations.ts
│   │   └── index.ts                   ← Barrel export
│   ├── history/
│   │   ├── hooks/useHistoryScreen.ts
│   │   ├── screen/HistoryScreen.tsx
│   │   └── index.ts
│   ├── products/
│   │   ├── hooks/useProductsScreen.ts
│   │   ├── screen/ProductsScreen.tsx
│   │   └── index.ts
│   ├── sales/
│   │   ├── hooks/useSaleScreen.ts
│   │   ├── screen/SaleScreen.tsx
│   │   ├── utils/cartCalculations.ts
│   │   └── index.ts
│   ├── summary/
│   │   ├── hooks/useSummaryScreen.ts
│   │   ├── screen/SummaryScreen.tsx
│   │   ├── utils/salaryCalculations.ts
│   │   └── index.ts
│   └── shared/                        ← Utils compartidos entre features
│       └── utils/
│           ├── dateComparisons.ts
│           └── validation.ts
│
├── shared/                            ← Fundamentos del proyecto
│   ├── domain/models/
│   │   ├── Product.ts
│   │   ├── Sale.ts
│   │   ├── SaleItem.ts
│   │   └── Withdrawal.ts
│   ├── types/
│   │   └── expo-vector-icons.d.ts
│   └── utils/
│       ├── dates.ts
│       └── money.ts
│
└── ui/                                ← UI genérica (no movido)
    ├── components/
    │   ├── soft/
    │   │   ├── SoftButton.tsx
    │   │   ├── SoftCard.tsx
    │   │   ├── SoftInput.tsx
    │   │   ├── SoftSearchInput.tsx
    │   │   ├── SoftNoticeProvider.tsx
    │   │   ├── SoftTabBar.tsx
    │   │   └── index.ts
    │   ├── AppScreen.tsx
    │   ├── AppButton.tsx
    │   ├── ScreenLayout.tsx
    │   └── index.ts
    ├── navigation/
    │   └── AppNavigator.tsx
    └── theme/
        ├── tokens.ts
        ├── colors.ts
        ├── spacing.ts
        ├── typography.ts
        ├── shadows.ts
        ├── themes.ts
        ├── ThemeProvider.tsx
        ├── useTheme.ts
        └── index.ts
```

---

## Reglas de desarrollo futuras

1. **Nuevas features** → crear bajo `src/features/<nombre>/` con su `screen/`, `hooks/`, `utils/` e `index.ts`
2. **Utilidades compartidas** → ir en `src/features/shared/utils/` si son cross-feature, o en `src/shared/` si son fundamentos del proyecto
3. **UI genérico** → ir en `src/ui/components/`
4. **Repositorios** → seguir en `src/data/repositories/`
5. **Hooks** → contienen estado, carga de datos, validaciones y handlers; las screens solo tienen JSX

---

*Generado el 9 de abril de 2026*
