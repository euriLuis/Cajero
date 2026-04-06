# tiendaCaja — Punto de Venta (POS)

A mobile point-of-sale and cash management app built with **React Native** and **Expo**. Designed for small retail stores to track sales, manage products, reconcile cash, and generate daily/weekly summaries — entirely **offline** using on-device SQLite.

---

## Features

### 🛒 Venta (Sale)
- Point-of-sale screen with product search & cart management
- Add/remove items, adjust quantities, assign custom dates
- Transactional sale insertion with draft persistence across restarts

### 💰 Contador (Cash Counter)
- Physical cash counting with 8 denomination levels ($5 – $1000)
- Real-time subtotals and auto-save (debounced)
- Balance comparison: expected vs. counted cash
- Add/withdraw cash movements (IN/OUT) with full history
- Tap-to-expand movement details with undo-on-delete

### 📊 Resumen (Summary)
- Daily sales, withdrawals, and net cash overview
- Weekly totals and salary calculations (0.5% of sales)
- Products sold grid with aggregate quantities
- Cash withdrawal management with soft-delete & undo timer
- Date filtering (today / yesterday / custom date picker)

### 📦 Productos (Products)
- Full product catalog CRUD with debounced search
- Soft-deactivation (products aren't hard-deleted)
- Add/edit modal with price input

### 🕐 Historial (History)
- Sales history grouped by date with item summaries
- Sale detail modal with full line-item breakdown
- **Edit mode**: modify quantities, prices, and add/remove items on existing sales
- Date filtering and full sale deletion with confirmation

### ⚙️ Settings
- *Placeholder — not yet implemented*

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.81 · Expo SDK 54 · React 19 |
| **Navigation** | React Navigation v6 (Bottom Tabs + custom animated tab bar) |
| **Database** | expo-sqlite v16 (local-only, no backend) |
| **Language** | TypeScript 5.9 |
| **Build** | EAS Build (Android APK) |
| **Utilities** | lodash.debounce, @react-native-community/datetimepicker |

---

## Architecture

- **Repository Pattern** — Data access is abstracted through repository modules (`productsRepo`, `salesRepo`, `withdrawalsRepo`, `cashRepo`). Screens never query SQLite directly.
- **Cent-Based Money** — All monetary values are stored as integers (cents) to avoid floating-point issues. Formatted with `$` prefix via `formatCents()`.
- **Timestamp Dates** — Dates use millisecond epoch timestamps (except `cash_movements` which uses ISO strings).
- **Draft Persistence** — Cash counter state and sale totals survive app restarts via `app_settings` storage.
- **Soft Deletions** — Products use `active=0`; deletions include undo timers.
- **Snapshot Pattern** — Sale items preserve `product_name_snapshot` and `unit_price_snapshot_cents` so historical data remains accurate even if products change.
- **Performance** — `React.memo` on row components, optimized FlatLists, debounced search (350ms) and saves (500ms).

---

## Database Schema

The app uses a versioned migration system (current: **v3**):

| Table | Purpose |
|---|---|
| `products` | Product catalog (id, name, price_cents, active, updated_at) |
| `sales` | Sale records (id, created_at, total_cents) |
| `sale_items` | Line items with price/name snapshots |
| `withdrawals` | Cash extractions (id, created_at, amount_cents, reason) |
| `app_settings` | Key-value store (theme mode, drafts) |
| `cash_state` | Single-row current cash state (denominations JSON) |
| `cash_movements` | IN/OUT movement log with denominations breakdown |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android device/emulator (iOS supported but not primary target)

### Installation

```bash
# Clone the repo
git clone <repo-url> && cd Cajero

# Install dependencies
npm install

# Start the dev server
npm start

# Run on Android
npm run android
```

### Build APK

```bash
npm run build:apk
```

This triggers an EAS build for Android (preview profile).

---

## Project Structure

```
Cajero/
├── App.tsx                          # Root: DB migration bootstrap, providers
├── src/
│   ├── data/
│   │   ├── db/                      # SQLite connection + migrations
│   │   └── repositories/            # Data access layer (CRUD ops)
│   ├── domain/models/               # TypeScript interfaces (Product, Sale, etc.)
│   ├── ui/
│   │   ├── components/              # Reusable UI (buttons, cards, inputs, soft/*)
│   │   ├── navigation/              # Bottom tab navigator
│   │   ├── screens/                 # Feature screens (Sale, CashCounter, etc.)
│   │   └── theme/                   # Design tokens, light/dark themes, typography
│   └── utils/                       # Money formatting, date utilities
├── assets/                          # Icons, splash screens, favicon
├── app.json                         # Expo configuration
├── eas.json                         # EAS build profiles
└── package.json
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Start Expo on Android |
| `npm run build:apk` | Build Android APK via EAS |

---

## License

Private — all rights reserved.
