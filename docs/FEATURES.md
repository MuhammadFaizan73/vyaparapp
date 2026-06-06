# Feature Requirements

Binding requirements from the Rootocloud Software Development Proposal & Agreement.
Every module listed here **must** conform to these specifications when built.

---

## 1. Company-Based Invoicing & Product Filtering

- All invoices are created on a **per-company basis**.
- The product list on the billing/invoice screen must be **filtered by the selected company** — the user sees only products belonging to that company.
- Sales, stock, and reports are maintained **independently per company** — data from Company A never bleeds into Company B.

**Affects:** Invoice module, Items/Products module, Sales reports, Stock reports.

---

## 2. Salesman Module with Weekly Shop Assignment & GPS Tracking

- Each salesperson is assigned specific shops on a **weekly schedule** (e.g., Monday: Shop A, Shop B; Tuesday: Shop C, Shop D).
- The salesman's mobile app **auto-displays the assigned shops for the current day** on login/home.
- **Live GPS location tracking** is enabled while the salesman is on duty.
- The system records:
  - How many assigned shops the salesman **visited** that day.
  - How many **orders were taken** per shop per day.

**Affects:** Mobile app, Backend (salesman schedules, GPS events, visit logs), Reporting.

---

## 3. Separate Inventory for Cotton & Box (Packaging Materials)

- **Cotton** and **Box** are maintained as fully independent stock items.
- Each has its own:
  - Opening stock
  - Purchases
  - Consumption
  - Closing balance
  - Dedicated reports
- They must **never be merged** with the main product inventory — separate module, separate data, separate UI.

**Affects:** Inventory module, Purchase module, Stock reports.

---

## 4. Subscription Packages — Monthly, Yearly, and Other

- Mr. Binaish can sell this software to his own end customers on the following plans:
  - **Monthly**
  - **Yearly**
  - **Custom** (quarterly, half-yearly, lifetime)
- The system must include:
  - Subscription creation and management
  - Expiry alerts (notify customer and admin before expiry)
  - Renewal reminders
  - Revenue reports per plan type

**Affects:** Licensing/subscription backend, Admin dashboard, Notification system.

---

## 5. AI Voice Assistant — Fetch Order & Customer Details

- Users can **speak** to enter or fetch order and customer details.
- Supports **English** and **Urdu / Roman Urdu**.
- Voice input is converted into structured form fields:
  - Customer name, phone, item name, quantity, rate, etc.
- The user **reviews and confirms** the auto-filled fields before saving — no blind auto-save.

**Affects:** Invoice/sale screen (mobile + desktop), Party lookup, AI/speech integration layer.

---

## 6. Copy-Paste Data from Excel into Software Fields

- Users can copy a cell, row, column, or full block from any Excel sheet and **paste it directly into software fields**.
- **Smart column-to-field auto-mapping** is built in — the system detects which column maps to which field.
- Works across:
  - Items / Products
  - Parties / Customers
  - Invoice line items
  - Stock updates

**Affects:** Desktop app (Electron), Web app, import flows for Items and Parties.

---

## 7. Exclusive Sale Rights

> **This software has been developed exclusively for Mr. Binaish.**

Rootocloud agrees that it will **NOT**:
- Sell, resell, license, sublicense, distribute, or offer this software (or any substantially similar copy) to any other individual, company, or organization.
- Do so under any brand name, at any time.

**Mr. Binaish holds sole and exclusive commercial rights** to sell and distribute this software.

---

*Source: Rootocloud Software Development Proposal & Agreement — Confidential © 2026*
