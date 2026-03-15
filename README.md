# 📦 CoreInventory

**A full-stack warehouse and inventory management system** built with FastAPI (Python) and vanilla JavaScript. CoreInventory provides end-to-end visibility into stock levels, inbound/outbound operations, internal transfers, and stock adjustments — all through a modern, dark-themed web interface with role-based access control.

**Note** : Deployment has not been possible as free tier deployment services do not allow use of 587 port which is required for email based OTP, we had an option to use third party API but we wanted to avoid it completely so we have opted for this option. The system runs perfectly on localhost, for setup instruction refer to guidelines in readme.

---

## 🌟 Key Features

### Inventory Management
- **Product Catalog** — Create, edit, and search products with 6-digit SKU codes, categories, units of measure, and reorder levels
- **Multi-Warehouse Support** — Manage multiple warehouses, each with their own named locations (zones, racks, bins)
- **Real-Time Stock Levels** — Track on-hand quantities per product per location with drill-down views
- **Low Stock & Out-of-Stock Alerts** — Automatic detection based on per-product reorder levels, surfaced on the dashboard

### Operations
- **Receipts (Inbound)** — Record incoming goods from suppliers into specific warehouse locations
- **Deliveries (Outbound)** — Track outgoing shipments to customers from warehouse locations
- **Internal Transfers** — Move stock between warehouses (source → destination) with per-line location mapping
- **Stock Adjustments** — Manager-only manual overrides with confirmation dialog and full audit trail

### Workflow & Status Tracking
- **Draft → Waiting → Ready → Done/Cancelled** lifecycle for all operations
- **Kanban Board View** — Visual columns for each status stage (toggle between list & Kanban)
- **Validate & Cancel** — One-click validation (applies stock changes) and cancellation with confirmation
- **Move History** — Complete audit trail of every stock movement (receipts, deliveries, transfers, adjustments)

### Dashboard
- **KPI Cards** — Total products, low stock count, out-of-stock count, pending receipts/deliveries
- **Inbound/Outbound Summary** — Late, operating, and waiting counts for receipts and deliveries
- **Low Stock Alerts Table** — Lists products below reorder level with severity percentage, linked to stock details
- **Smart Alert Banner** — Routes to the most urgent filter (out-of-stock > low-stock)

### User Management & Security
- **Role-Based Access Control (RBAC)** — Three-tier role system:
  - **Super Manager** — Full access + can approve/reject new manager accounts
  - **Manager** — Full operational access (CRUD, validate, cancel, adjust stock)
  - **Staff** — Read-only view of operations; cannot create, edit, or validate
- **User Approval Workflow** — New signups require manager/super-manager approval before access
- **JWT Authentication** — Secure token-based auth with login, signup, and password reset via email OTP
- **Password Reset** — Email-based OTP verification for forgotten passwords (SMTP integration)

### UI/UX
- **Dark Theme** — Modern dark interface with accent colors, glassmorphism, and smooth transitions
- **Searchable Dropdowns** — Autocomplete search for warehouses, products, and locations across all forms
- **Responsive Layout** — Sidebar navigation with collapsible sections
- **Filter Pills** — Quick-filter products by All / Low Stock / Out of Stock
- **Activity Logs** — Complete operation audit trail with timestamped entries, user attribution, and direct links

---

## 🏗️ Architecture

```
CoreInventory/
├── backend/                    # FastAPI Python Backend
│   ├── main.py                 # App entry point, router registration, CORS, static mount
│   ├── db/
│   │   └── database.py         # SQLAlchemy engine, SessionLocal, Base
│   ├── models/
│   │   └── models.py           # All ORM models (User, Product, Warehouse, Location, etc.)
│   ├── routers/
│   │   ├── auth.py             # Login, signup, JWT, password reset (OTP)
│   │   ├── products.py         # CRUD products, stock queries, low/out-of-stock filters
│   │   ├── warehouses.py       # CRUD warehouses & locations
│   │   ├── receipts.py         # Receipt CRUD, validate, cancel
│   │   ├── deliveries.py       # Delivery CRUD, validate, cancel
│   │   ├── transfers.py        # Internal transfer CRUD, validate, cancel
│   │   ├── adjustments.py      # Stock adjustments (manual overrides)
│   │   ├── dashboard.py        # Dashboard stats & low stock products
│   │   ├── moves.py            # Stock move history
│   │   ├── logs.py             # Operation audit logs
│   │   └── users.py            # User approval management
│   └── schemas/
│       ├── auth.py             # Auth request/response schemas
│       ├── products.py         # Product schemas with SKU validation
│       ├── dashboard.py        # Dashboard stats schema
│       └── logs.py             # Log response schemas
│
├── frontend/                   # Vanilla JS/HTML/CSS Frontend
│   ├── css/
│   │   ├── global.css          # CSS variables, reset, shared styles
│   │   ├── layout.css          # App shell, sidebar, topnav
│   │   ├── dashboard.css       # Dashboard-specific styles
│   │   ├── products.css        # Product table, modal, stock views
│   │   ├── operations.css      # Operations forms, Kanban board, badges, searchable select
│   │   ├── auth.css            # Login/signup form styles
│   │   └── moves.css           # Move history table styles
│   ├── js/
│   │   ├── api.js              # Global apiFetch() helper with JWT token injection
│   │   ├── layout.js           # Sidebar + topnav renderer, RBAC link hiding
│   │   ├── searchable-select.js # Reusable autocomplete dropdown component
│   │   ├── dashboard.js        # Dashboard KPI rendering & low stock table
│   │   ├── products.js         # Product CRUD, search, filter pills
│   │   ├── product-stock.js    # Per-product stock breakdown view
│   │   ├── operation-form.js   # Receipt/delivery form with searchable selects
│   │   ├── transfer-form.js    # Internal transfer form with searchable selects
│   │   ├── operations.js       # Operations list (receipts/deliveries) with Kanban toggle
│   │   ├── transfers.js        # Transfers list with Kanban toggle
│   │   ├── adjustments.js      # Stock adjustments form with confirmation
│   │   ├── moves.js            # Move history with Kanban toggle
│   │   ├── users.js            # User approval management
│   │   ├── logs.js             # Activity logs rendering
│   │   ├── login.js            # Login flow
│   │   ├── signup.js           # Signup flow
│   │   └── forgot-password.js  # Password reset flow
│   └── pages/
│       ├── login.html          # Login page
│       ├── signup.html         # Registration page
│       ├── forgot-password.html # Password reset page
│       ├── dashboard.html      # Main dashboard
│       ├── products.html       # Product catalog
│       ├── product-stock.html  # Per-product stock breakdown
│       ├── warehouse.html      # Warehouse & location management
│       ├── receipts.html       # Receipts list
│       ├── deliveries.html     # Deliveries list
│       ├── transfers.html      # Internal transfers list
│       ├── operation-form.html # Receipt/delivery detail form
│       ├── transfer-form.html  # Internal transfer detail form
│       ├── adjustments.html    # Stock adjustments page
│       ├── moves.html          # Move history
│       ├── logs.html           # Activity logs
│       └── users.html          # User approvals (manager only)
│
├── seed_and_reset.py           # Database reset & user seeding script
├── .env                        # Environment configuration
└── README.md                   # This file
```

---

## 📊 Database Schema

### Core Models

| Model | Table | Purpose |
|-------|-------|---------|
| `User` | `users` | User accounts with role, approval status, super-manager flag |
| `Product` | `products` | Product catalog with SKU (6-digit), category, UoM, reorder level |
| `Warehouse` | `warehouses` | Warehouse definitions with short codes |
| `Location` | `locations` | Locations within warehouses (zones, racks, bins) |
| `StockLevel` | `stock_levels` | Current on-hand quantity per product per location |

### Operations Models

| Model | Table | Purpose |
|-------|-------|---------|
| `Receipt` | `receipts` | Inbound operations (supplier → warehouse) |
| `ReceiptLine` | `receipt_lines` | Line items for receipts (product, location, qty) |
| `Delivery` | `deliveries` | Outbound operations (warehouse → customer) |
| `DeliveryLine` | `delivery_lines` | Line items for deliveries |
| `InternalTransfer` | `internal_transfers` | Warehouse-to-warehouse transfers |
| `InternalTransferLine` | `internal_transfer_lines` | Line items with source/dest locations |

### Audit Models

| Model | Table | Purpose |
|-------|-------|---------|
| `StockMove` | `stock_moves` | Every stock movement (receipt, delivery, transfer, adjustment) |
| `OperationLog` | `operation_logs` | Who did what and when (created, validated, cancelled) |
| `OTPStore` | `otp_store` | Temporary OTP storage for password reset |

### Enums

| Enum | Values |
|------|--------|
| `RoleEnum` | `manager`, `staff` |
| `StatusEnum` | `draft`, `waiting`, `ready`, `done`, `cancelled` |
| `MoveTypeEnum` | `receipt`, `delivery`, `transfer`, `adjustment` |
| `ActionEnum` | `created`, `validated`, `cancelled` |

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.9+**
- **MySQL 8.0+** (or MariaDB)
- **pip** (Python package manager)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CoreInventory
```

### 2. Create a Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install fastapi uvicorn sqlalchemy pymysql passlib[bcrypt] python-jose[cryptography] python-dotenv pydantic[email]
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/coreinventory
JWT_SECRET_KEY=your_secret_key_here
ALLOWED_ORIGINS=*
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
```

> **Note:** For Gmail SMTP, you need to generate an [App Password](https://support.google.com/accounts/answer/185833) since Google blocks less secure apps.

### 5. Create the Database

```sql
CREATE DATABASE coreinventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 6. Seed the Database

```bash
python seed_and_reset.py
```

This will create the tables and seed three default users:

| Role | Email | Password |
|------|-------|----------|
| **Super Manager** | `super@admin.com` | `admin123` |
| **Manager** | `manager@admin.com` | `manager123` |
| **Staff** | `staff@admin.com` | `staff123` |

### 7. Start the Development Server

```bash
uvicorn backend.main:app --reload
```

The app will be available at: **http://localhost:8000**

- Frontend: `http://localhost:8000/app/pages/login.html`
- API Docs: `http://localhost:8000/docs` (Swagger UI)

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register a new account |
| `POST` | `/api/auth/login` | Login and receive JWT token |
| `POST` | `/api/auth/forgot-password` | Send OTP to email |
| `POST` | `/api/auth/verify-otp` | Verify OTP code |
| `POST` | `/api/auth/reset-password` | Reset password with session ID |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/products` | List all products (supports `?low_stock=true`, `?out_of_stock=true`) |
| `POST` | `/api/products` | Create a product (SKU must be 6 digits) |
| `PUT` | `/api/products/{id}` | Update a product |
| `DELETE` | `/api/products/{id}` | Delete a product |
| `GET` | `/api/products/{id}/stock` | Get stock breakdown by location |

### Warehouses & Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/warehouses` | List warehouses with locations |
| `POST` | `/api/warehouses` | Create a warehouse |
| `PUT` | `/api/warehouses/{id}` | Update a warehouse |
| `DELETE` | `/api/warehouses/{id}` | Delete a warehouse |
| `POST` | `/api/locations` | Create a location |
| `PUT` | `/api/locations/{id}` | Update a location |
| `DELETE` | `/api/locations/{id}` | Delete a location |

### Receipts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/receipts` | List all receipts |
| `POST` | `/api/receipts` | Create a receipt |
| `GET` | `/api/receipts/{id}` | Get receipt details |
| `PUT` | `/api/receipts/{id}` | Update a receipt |
| `PUT` | `/api/receipts/{id}/validate` | Validate (applies stock in) |
| `PUT` | `/api/receipts/{id}/cancel` | Cancel a receipt |

### Deliveries
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/deliveries` | List all deliveries |
| `POST` | `/api/deliveries` | Create a delivery |
| `GET` | `/api/deliveries/{id}` | Get delivery details |
| `PUT` | `/api/deliveries/{id}` | Update a delivery |
| `PUT` | `/api/deliveries/{id}/validate` | Validate (applies stock out) |
| `PUT` | `/api/deliveries/{id}/cancel` | Cancel a delivery |

### Internal Transfers
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transfers` | List all transfers |
| `POST` | `/api/transfers` | Create a transfer |
| `GET` | `/api/transfers/{id}` | Get transfer details |
| `PUT` | `/api/transfers/{id}` | Update a transfer |
| `PUT` | `/api/transfers/{id}/validate` | Validate (moves stock) |
| `PUT` | `/api/transfers/{id}/cancel` | Cancel a transfer |

### Stock Adjustments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/adjustments` | Create a stock adjustment (manager-only) |
| `GET` | `/api/adjustments/stock` | Get current stock at a location |

### Dashboard & Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | Dashboard KPIs and low stock products |
| `GET` | `/api/moves` | Stock move history (supports `?move_type=adjustment`) |
| `GET` | `/api/logs` | Operation audit logs |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/pending` | List pending user approvals |
| `PUT` | `/api/users/{id}/approve` | Approve a user |
| `PUT` | `/api/users/{id}/reject` | Reject (delete) a user |

---

## 🔐 Role-Based Access Control

| Feature | Super Manager | Manager | Staff |
|---------|:---:|:---:|:---:|
| View dashboard | ✅ | ✅ | ✅ (limited) |
| View products & stock | ✅ | ✅ | ✅ |
| Create/edit products | ✅ | ✅ | ❌ |
| Manage warehouses | ✅ | ✅ | ❌ |
| Create operations | ✅ | ✅ | ❌ |
| Validate/cancel operations | ✅ | ✅ | ❌ |
| Stock adjustments | ✅ | ✅ | ❌ |
| View activity logs | ✅ | ✅ | ✅ |
| Approve new users | ✅ | ✅ | ❌ |
| Approve new **managers** | ✅ | ❌ | ❌ |

---

## 🛠️ Development

### Running Tests

```bash
python test_validate.py
python test_validate_http.py
```

### Database Reset

To completely reset and re-seed the database:

```bash
python seed_and_reset.py
```

> ⚠️ **Warning:** This drops ALL tables and recreates them. All data will be lost.

### Adding a New Feature

1. Create the ORM model in `backend/models/models.py`
2. Create Pydantic schemas in `backend/schemas/`
3. Create the API router in `backend/routers/`
4. Register the router in `backend/main.py`
5. Create the frontend page in `frontend/pages/`
6. Create the JS logic in `frontend/js/`
7. Add the sidebar link in `frontend/js/layout.js`

---

## 📝 Validation Rules

| Field | Rule |
|-------|------|
| **SKU** | Must be exactly 6 digits (`/^\d{6}$/`) |
| **Email** | Standard email format, unique per account |
| **Password** | Minimum length enforced at signup |
| **Quantity** | Must be ≥ 1 for operations, ≥ 0 for adjustments |
| **Reorder Level** | Integer ≥ 0; when `on_hand ≤ reorder_level`, product is flagged as low stock |

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.9+, FastAPI, SQLAlchemy, Pydantic |
| **Database** | MySQL 8.0+ (via PyMySQL) |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Email** | SMTP (smtplib) for OTP-based password reset |
| **Frontend** | Vanilla HTML, CSS, JavaScript (no frameworks) |

---

## ✦ Contributors - Team SyncStock

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/YashvardhanJani">
        <img src="https://avatars.githubusercontent.com/u/185942676?v=4" width="40px;" style="border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.2);" alt="Yashvardhan Jani"/>
    </td>
    <td align="center">
        <a href="https://github.com/YashvardhanJani">
        <b>Yashvardhan Jani</b></a><br/>
        🔗 <a href="https://www.linkedin.com/in/yashvardhan-jani">LinkedIn</a>
    </td>
    <td align="center">
      <a href="https://github.com/dakshshah2099">
        <img src="https://avatars.githubusercontent.com/u/251745636?v=4" width="40px;" style="border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.2);" alt="Daksh Shah"/>
    </td>
    <td align="center">
        <a href="https://github.com/dakshshah2099">
        <b>Daksh Shah</b></a><br/>
        🔗 <a href="https://www.linkedin.com/in/dakshshah2099/">LinkedIn</a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://github.com/Vishwashah11">
        <img src="https://avatars.githubusercontent.com/u/184846059?v=4" width="40px;" style="border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.2);" alt="Vishwa Shah"/>
    </td>
    <td align="center">
        <a href="https://github.com/Vishwashah11">
        <b>Vishwa Shah</b></a><br/>
        🔗 <a href="https://www.linkedin.com/in/vishwa-shah-27798b320/">LinkedIn</a>
    </td>
    <td align="center">
      <a href="https://github.com/mansisharma46">
        <img src="https://avatars.githubusercontent.com/u/253931964?v=4" width="40px;" style="border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.2);" alt="Mansi Sharma"/>
    </td>
    <td align="center">
        <a href="https://github.com/mansisharma46">
        <b>Mansi Sharma</b></a><br/>
        🔗 <a href="https://www.linkedin.com/in/mansisharmacse/">LinkedIn</a>
    </td>
  </tr>
</table>

---

## 📄 License

This project is proprietary software developed for OdooxIndus.

---

Built with ❤️ by the SyncStock Team.
