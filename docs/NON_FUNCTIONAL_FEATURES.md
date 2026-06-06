# Non-Functional Features Audit

Last updated: 2026-05-31

Status legend: ❌ Not built | ✅ Fixed | ⚠️ Partial

---

## Mobile App

### Dashboard (`apps/mobile/app/(tabs)/dashboard.tsx`)

| # | Feature | Status |
|---|---|---|
| 1 | Revenue chart — was hardcoded fake data | ✅ Fixed — loads real 6-month sales from API |
| 2 | Top Customers — was hardcoded | ✅ Fixed — loads real top 5 parties by sales |
| 3 | Report tiles (GST, P&L, Stock, Cashflow) — no onPress | ✅ Fixed — navigate to correct report screens |

---

### Home Tab (`apps/mobile/app/(tabs)/index.tsx`)

| # | Feature | Status |
|---|---|---|
| 4 | Notifications button | ❌ No action |
| 5 | Settings button | ❌ No action |
| 6 | My Online Store (menu item) | ❌ No route |
| 7 | Loyalty Points (menu item) | ❌ No route |

-hk --

### Sale — New Invoice (`apps/mobile/app/sale/new.tsx`)

| # | Feature | Status |
|---|---|---|
| 8 | Date picker — was hardcoded | ✅ Fixed — native DateTimePicker, saves selected date |
| 9 | Invoice number — was hardcoded "1" | ✅ Fixed — auto-loads count+1 from API, editable |
| 10 | Add Party (quick add) — was "Coming soon" | ✅ Fixed — navigates to /party/new |
| 11 | Add Document button | ✅ Fixed — opens expo-document-picker, shows attached files |
| 12 | Add Shipping Address | ✅ Fixed — expands inline address + city fields |
| 13 | More button (⋮) | ✅ Fixed — bottom sheet with Duplicate, Share, Print, Cancel |
| 14 | Settings icon | ✅ Fixed — navigates to /transaction-settings |

---

### Sale — List (`apps/mobile/app/sale/index.tsx`)

| # | Feature | Status |
|---|---|---|
| 15 | Search button | ✅ Fixed — toggles text search bar |
| 16 | PDF export button | ✅ Fixed — exports all filtered sales as multi-page PDF |
| 17 | Receive Payment (context menu) — was "Coming soon" | ✅ Fixed — opens Payment-In pre-filled with party + balance |
| 18 | Return (context menu) | ❌ "Coming soon" |
| 19 | Delivery Note (context menu) | ❌ "Coming soon" |

---

### Payment-In — New (`apps/mobile/app/payment-in/new.tsx`)

| # | Feature | Status |
|---|---|---|
| 20 | Date picker — was hardcoded | ✅ Fixed — native DateTimePicker |
| 21 | Receipt number — was hardcoded | ✅ Fixed — auto-loads from API, editable |
| 22 | Add Payment Type button | ✅ Fixed — bottom sheet picker (Cash, Card, UPI, Bank, Cheque, Online) |
| 23 | More button (⋮) | ✅ Fixed — options sheet |
| 24 | Settings icon | ✅ Fixed — navigates to /transaction-settings |
| 25 | Balance bug (was saving balance = amount) | ✅ Fixed — now saves balance: 0 |
| 26 | Prefill from sale invoice | ✅ Fixed — accepts prefillPartyId, prefillAmount, prefillSaleId params |

---

### Payment-In — List (`apps/mobile/app/payment-in/index.tsx`)

| # | Feature | Status |
|---|---|---|
| 27 | Mic / Voice button — animation only | ❌ No real voice |
| 28 | Filter dropdowns | ❌ No onPress handlers |
| 29 | FAB button | ❌ No onPress handler |

---

### Menu Tab (`apps/mobile/app/(tabs)/menu.tsx`)

| # | Feature | Status |
|---|---|---|
| 30 | Company Profile | ❌ No route |
| 31 | Tax Settings | ❌ No route |
| 32 | Print Settings | ❌ No route |
| 33 | Help & Support | ❌ No route |

---

### Items Tab (`apps/mobile/app/(tabs)/items.tsx`)

| # | Feature | Status |
|---|---|---|
| 34 | Categories filter tab | ❌ No filtering logic |

---

### Reports (`apps/mobile/app/reports/[type].tsx`)

| # | Feature | Status |
|---|---|---|
| 35 | PDF export button | ❌ No onPress handler |
| 36 | XLS export button | ❌ No onPress handler |

---

### Premium Tab (`apps/mobile/app/(tabs)/premium.tsx`)

| # | Feature | Status |
|---|---|---|
| 37 | Upgrade plan buttons | ❌ Disabled — no upgrade flow |

---

## Desktop App

### Sale Screen (`packages/ui/src/screens/SaleScreen.tsx`)

| # | Feature | Status |
|---|---|---|
| 1 | Estimate / Quotation tab | ❌ "Coming soon" |
| 2 | Proforma Invoice tab | ❌ "Coming soon" |
| 3 | Sale Order tab | ❌ "Coming soon" |
| 4 | Delivery Challan tab | ❌ "Coming soon" |
| 5 | Sale Return / Credit Note tab | ❌ "Coming soon" |
| 6 | Vyapar POS | ❌ Premium placeholder, not built |
| 7 | Switch view dropdown | ❌ No onClick |
| 8 | Settings button | ❌ No onClick |

---

### Purchase Screen (`packages/ui/src/screens/Shell.tsx`)

| # | Feature | Status |
|---|---|---|
| 9 | Purchase Bills | ❌ "Coming soon" |
| 10 | Payment-Out | ❌ "Coming soon" |
| 11 | Expenses | ❌ "Coming soon" |
| 12 | Purchase Order | ❌ "Coming soon" |
| 13 | Purchase Return / Dr. Note | ❌ "Coming soon" |

---

### Other Desktop Screens

| # | Screen | Feature | Status |
|---|---|---|---|
| 14 | Grow | Insights | ❌ "Coming soon" |
| 15 | Cash & Bank | Bank Accounts | ❌ "Coming soon" |
| 16 | Cash & Bank | Cheques | ❌ "Coming soon" |
| 17 | Sync | Backup | ❌ "Coming soon" |
| 18 | Sync | Sync Data | ❌ "Coming soon" |
| 19 | Utilities | Tools | ❌ "Coming soon" |
| 20 | Utilities | Import Data | ❌ "Coming soon" |
| 21 | Settings | Entire screen | ❌ "Coming soon" |
| 22 | Parties | Import via Google Contacts | ❌ No onClick |
| 23 | Parties | Party Statement button | ❌ No onClick |
| 24 | Parties | All Parties report button | ❌ No onClick |
| 25 | Payment-In | Filter dropdowns | ❌ No handlers |
| 26 | Payment-In | Date range filter | ❌ Hardcoded 01/05/2026–31/05/2026 |
| 27 | Party Statement | Email PDF button | ❌ No onClick |

---

## Progress Summary

| Platform | Total Issues | Fixed | Remaining |
|---|---|---|---|
| Mobile | 37 | 18 | 19 |
| Desktop | 27 | 0 | 27 |
| **Total** | **64** | **18** | **46** |

---

## Priority Fix Order (Remaining)

| Priority | Feature | Platform |
|---|---|---|
| 1 | Sale context menu — Return, Delivery Note | Mobile |
| 2 | Reports PDF + XLS export | Mobile |
| 3 | Payment-In List filters | Mobile |
| 4 | Items Categories filter | Mobile |
| 5 | Menu tab routes (Company Profile, Tax Settings) | Mobile |
| 6 | Purchase screens | Desktop |
| 7 | Settings screen | Both |
| 8 | Voice / AI entry | Mobile |
