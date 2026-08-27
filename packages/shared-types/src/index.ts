import { z } from "zod";

export const TenantSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  countryCode: z.string(),
  trialStartedAt: z.string().datetime(),
  trialExpiresAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const RegisterRequestSchema = z.object({
  countryCode: z.string().regex(/^\+\d{1,4}$/),
  phone: z.string().regex(/^\d{6,15}$/),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z.object({
  token: z.string(),
  tenant: TenantSchema,
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const LicenseStatusSchema = z.object({
  state: z.enum(["trial", "trial_expired", "licensed", "license_expired"]),
  platform: z.enum(["desktop", "mobile"]),
  trialStartedAt: z.string().datetime(),
  trialExpiresAt: z.string().datetime(),
  daysRemaining: z.number().int().nonnegative(),
  license: z
    .object({
      key: z.string(),
      plan: z.string(),
      activatedAt: z.string().datetime().nullable(),
      expiresAt: z.string().datetime(),
    })
    .nullable(),
});
export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export const ActivateLicenseRequestSchema = z.object({
  key: z.string().min(8).max(64),
  platform: z.enum(["desktop", "mobile"]),
});
export type ActivateLicenseRequest = z.infer<typeof ActivateLicenseRequestSchema>;

export const PartySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  billingAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  shippingAddress: z.string().nullable(),
  shippingCity: z.string().nullable(),
  shippingState: z.string().nullable(),
  shippingPincode: z.string().nullable(),
  openingBalance: z.number(),
  creditLimit: z.number().nullable(),
  creditDays: z.number().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  ntn: z.string().nullable(),
  cnic: z.string().nullable(),
  strn: z.string().nullable(),
  partyType: z.enum(["customer", "supplier", "both", "other"]).default("both"),
  isSystem: z.boolean(),
  groupId: z.string().nullable(),
  groupName: z.string().nullable(),
  balance: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  companyId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type Party = z.infer<typeof PartySchema>;

const partyFields = {
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  billingAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingPincode: z.string().optional(),
  openingBalance: z.number().optional(),
  creditLimit: z.number().min(0).optional(),
  creditDays: z.number().min(0).optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  ntn: z.string().optional(),
  cnic: z.string().optional(),
  strn: z.string().optional(),
  partyType: z.enum(["customer", "supplier", "both", "other"]).optional(),
  groupId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  companyId: z.string().optional(),
};

export const CreatePartyRequestSchema = z.object({
  ...partyFields,
  name: z.string().min(1).max(100),
});
export type CreatePartyRequest = z.infer<typeof CreatePartyRequestSchema>;

export const UpdatePartyRequestSchema = z.object(partyFields);
export type UpdatePartyRequest = z.infer<typeof UpdatePartyRequestSchema>;

export const PartyGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
});
export type PartyGroup = z.infer<typeof PartyGroupSchema>;

export const TaxRateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rate: z.number(),
  createdAt: z.string().datetime(),
});
export type TaxRate = z.infer<typeof TaxRateSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  customerName: z.string(),
  amount: z.number().nonnegative(),
  currency: z.literal("PKR"),
  status: z.enum(["draft", "sent", "paid", "overdue"]),
  issuedAt: z.string().datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
});
export type Product = z.infer<typeof ProductSchema>;

export const ItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  category: z.string().nullable().optional(),
  unit: z.string().nullable(),
  secondaryUnit: z.string().nullable(),
  conversionRate: z.string().nullable(),
  tertiaryUnit: z.string().nullable().optional(),
  tertiaryConversionRate: z.string().nullable().optional(),
  mrp: z.number().nullable(),
  salePrice: z.number().nullable(),
  purchasePrice: z.number().nullable(),
  discount: z.number().nullable(),
  discountType: z.string().nullable().optional(),
  taxRate: z.number().nullable().optional(),
  inclusiveOfTax: z.string().nullable().optional(),
  itemLocation: z.string().nullable().optional(),
  openingStock: z.number(),
  minStock: z.number(),
  companyTag: z.string().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  // Per-store breakdown + live total, added with multi-store inventory. Empty/0 for
  // items whose tenant has no stores yet or that aren't attached to a company (see
  // StoresService.ensureBootstrapped) — callers should fall back to openingStock.
  stocks: z.array(z.lazy(() => ItemStoreStockSchema)).default([]),
  totalStock: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Item = z.infer<typeof ItemSchema>;

export const DistributorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  businessType: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Distributor = z.infer<typeof DistributorSchema>;

export const CreateDistributorRequestSchema = z.object({
  name: z.string().min(1).max(100),
  businessType: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});
export type CreateDistributorRequest = z.infer<typeof CreateDistributorRequestSchema>;

export const UpdateDistributorRequestSchema = CreateDistributorRequestSchema.partial();
export type UpdateDistributorRequest = z.infer<typeof UpdateDistributorRequestSchema>;

export const BranchSchema = z.object({
  id: z.string().uuid(),
  distributorId: z.string().uuid(),
  name: z.string(),
  city: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const CreateBranchRequestSchema = z.object({
  distributorId: z.string().uuid(),
  name: z.string().min(1).max(100),
  city: z.string().optional(),
});
export type CreateBranchRequest = z.infer<typeof CreateBranchRequestSchema>;

export const UpdateBranchRequestSchema = z.object({
  distributorId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  city: z.string().optional(),
});
export type UpdateBranchRequest = z.infer<typeof UpdateBranchRequestSchema>;

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  businessType: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  gstin: z.string().nullable(),
  branchId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type Company = z.infer<typeof CompanySchema>;

export const CreateCompanyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  businessType: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  branchId: z.string().nullable().optional(),
});
export type CreateCompanyRequest = z.infer<typeof CreateCompanyRequestSchema>;

export const UpdateCompanyRequestSchema = CreateCompanyRequestSchema.partial();
export type UpdateCompanyRequest = z.infer<typeof UpdateCompanyRequestSchema>;

export const CreateItemRequestSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  secondaryUnit: z.string().optional(),
  conversionRate: z.string().optional(),
  tertiaryUnit: z.string().optional(),
  tertiaryConversionRate: z.string().optional(),
  mrp: z.number().optional(),
  salePrice: z.number().optional(),
  purchasePrice: z.number().optional(),
  discount: z.number().min(0).max(100).optional(),
  discountType: z.string().optional(),
  taxRate: z.number().min(0).optional(),
  inclusiveOfTax: z.string().optional(),
  itemLocation: z.string().optional(),
  openingStock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  companyTag: z.string().optional(),
  companyId: z.string().uuid().nullable().optional(),
  // Which store openingStock should be set at. Falls back to the company's Main
  // Store when omitted (see StockService.resolveStoreId).
  storeId: z.string().uuid().optional(),
});
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

export const UpdateItemRequestSchema = CreateItemRequestSchema.partial();
export type UpdateItemRequest = z.infer<typeof UpdateItemRequestSchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: z.enum(["sale","purchase","payment_in","payment_out","credit_note","debit_note","expense","opening_balance","estimate","proforma_invoice","sale_order","purchase_order","delivery_challan"]),
  number: z.string().nullable(),
  date: z.string().datetime(),
  total: z.number(),
  balance: z.number(),
  notes: z.string().nullable(),
  companyId: z.string().uuid().nullable().optional(),
  bookerId: z.string().uuid().nullable().optional(),
  // Which store the goods moved out of/into. Null on pre-feature rows and on types
  // that don't move stock — see TxnLineItemSchema/parseTxnLineItems below.
  storeId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// One entry in a payment_in/payment_out's `allocations` — how much of this payment
// was applied against a specific invoice (sale/purchase) transaction. Persisted as
// PaymentAllocation rows so the link survives, unlike the old behavior of just
// mutating the invoice's balance with no record of which payment did it.
export const PaymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number(),
});
export type PaymentAllocationInput = z.infer<typeof PaymentAllocationInputSchema>;

export const PaymentAllocationSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number(),
});
export type PaymentAllocation = z.infer<typeof PaymentAllocationSchema>;

export const CreateTransactionRequestSchema = z.object({
  partyId: z.string().uuid(),
  type: z.enum(["sale","purchase","payment_in","payment_out","credit_note","debit_note","expense","opening_balance","estimate","proforma_invoice","sale_order","purchase_order","delivery_challan"]),
  number: z.string().optional(),
  date: z.string().optional(),
  total: z.number(),
  balance: z.number(),
  notes: z.string().optional(),
  companyId: z.string().uuid().nullable().optional(),
  bookerId: z.string().uuid().nullable().optional(),
  storeId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().optional(),
  allocations: z.array(PaymentAllocationInputSchema).optional(),
});
export type CreateTransactionRequest = z.infer<typeof CreateTransactionRequestSchema>;

export const UpdateTransactionRequestSchema = z.object({
  partyId: z.string().uuid().optional(),
  date: z.string().optional(),
  total: z.number().optional(),
  balance: z.number().optional(),
  notes: z.string().optional(),
  companyId: z.string().uuid().nullable().optional(),
  bookerId: z.string().uuid().nullable().optional(),
  storeId: z.string().uuid().nullable().optional(),
  // When provided (even as []), replaces this payment's existing allocations —
  // reversing the old ones' effect on their invoices before applying the new set.
  // Omitted entirely, existing allocations are left untouched.
  allocations: z.array(PaymentAllocationInputSchema).optional(),
});
export type UpdateTransactionRequest = z.infer<typeof UpdateTransactionRequestSchema>;

export const LastSalePriceSchema = z.object({
  rate: z.number(),
  date: z.string().datetime(),
});
export type LastSalePrice = z.infer<typeof LastSalePriceSchema>;

// ─── Multi-store inventory ──────────────────────────────────────────────────

// The shape stored inside Transaction.notes. Historically untyped, and written in
// two variants on disk: a bare array (desktop PurchaseScreen) or
// { items: [...], ...metadata } (everything else) — both are accepted here so old
// rows keep parsing exactly like reports.service.ts's parseItems() already tolerates.
export const TxnLineItemSchema = z.object({
  // Added with per-store stock. Absent on every pre-feature row and on any client
  // not yet updated — stock movement silently skips lines without it rather than
  // guessing which catalog item they meant.
  itemId: z.string().uuid().optional(),
  name: z.string(),
  qty: z.number(),
  unit: z.string().optional(),
  rate: z.number().optional(),
  mrp: z.number().optional(),
  discount: z.number().optional(),
});
export type TxnLineItem = z.infer<typeof TxnLineItemSchema>;

const TxnNotesObjectSchema = z.object({ items: z.array(TxnLineItemSchema).optional() }).passthrough();

/** Parses Transaction.notes into a line-item array, tolerating both on-disk shapes
 * and any malformed/legacy content (returns [] rather than throwing). */
export function parseTxnLineItems(notes: string | null | undefined): TxnLineItem[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) {
      const result = z.array(TxnLineItemSchema).safeParse(parsed);
      return result.success ? result.data : [];
    }
    const result = TxnNotesObjectSchema.safeParse(parsed);
    return result.success ? (result.data.items ?? []) : [];
  } catch {
    return [];
  }
}

export const StoreSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  storeType: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  pincode: z.string().nullable(),
  address: z.string().nullable(),
  isMain: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Store = z.infer<typeof StoreSchema>;

export const CreateStoreRequestSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  storeType: z.string().max(40).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  pincode: z.string().optional(),
  address: z.string().optional(),
});
export type CreateStoreRequest = z.infer<typeof CreateStoreRequestSchema>;

export const UpdateStoreRequestSchema = CreateStoreRequestSchema.omit({ companyId: true }).partial();
export type UpdateStoreRequest = z.infer<typeof UpdateStoreRequestSchema>;

export const ItemStoreStockSchema = z.object({
  storeId: z.string().uuid(),
  storeName: z.string(),
  quantity: z.number(),
});
export type ItemStoreStock = z.infer<typeof ItemStoreStockSchema>;

export const StockTransferLineSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemSku: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number(),
});
export type StockTransferLine = z.infer<typeof StockTransferLineSchema>;

export const StockTransferSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  fromStoreId: z.string().uuid(),
  fromStoreName: z.string(),
  toStoreId: z.string().uuid(),
  toStoreName: z.string(),
  date: z.string().datetime(),
  number: z.string().nullable(),
  notes: z.string().nullable(),
  lines: z.array(StockTransferLineSchema),
  totalQty: z.number(),
  createdAt: z.string().datetime(),
});
export type StockTransfer = z.infer<typeof StockTransferSchema>;

export const CreateStockTransferRequestSchema = z.object({
  companyId: z.string().uuid(),
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  date: z.string().optional(),
  number: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
    unit: z.string().optional(),
  })).min(1),
});
export type CreateStockTransferRequest = z.infer<typeof CreateStockTransferRequestSchema>;

export const BulkSaleImportLineItemSchema = z.object({
  name: z.string(),
  qty: z.number(),
  unit: z.string().optional(),
  rate: z.number(),
});
export type BulkSaleImportLineItem = z.infer<typeof BulkSaleImportLineItemSchema>;

export const BulkSaleImportItemSchema = z.object({
  name: z.string(),
  unit: z.string().optional(),
  sku: z.string().optional(),
  salePrice: z.number().optional(),
  purchasePrice: z.number().optional(),
});
export type BulkSaleImportItem = z.infer<typeof BulkSaleImportItemSchema>;

export const BulkSaleImportPartySchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
});
export type BulkSaleImportParty = z.infer<typeof BulkSaleImportPartySchema>;

export const BulkSaleImportInvoiceSchema = z.object({
  number: z.string(),
  date: z.string(),
  partyName: z.string(),
  transactionType: z.string(),
  total: z.number(),
  balance: z.number().optional(),
  lineItems: z.array(BulkSaleImportLineItemSchema),
});
export type BulkSaleImportInvoice = z.infer<typeof BulkSaleImportInvoiceSchema>;

export const BulkSaleImportRequestSchema = z.object({
  companyTag: z.string().optional(),
  companyId: z.string().uuid().nullable().optional(),
  items: z.array(BulkSaleImportItemSchema),
  parties: z.array(BulkSaleImportPartySchema),
  invoices: z.array(BulkSaleImportInvoiceSchema),
});
export type BulkSaleImportRequest = z.infer<typeof BulkSaleImportRequestSchema>;

export const BulkImportJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["processing", "done", "error"]),
  total: z.number(),
  processed: z.number(),
  itemsCreated: z.number(),
  partiesCreated: z.number(),
  invoicesImported: z.number(),
  invoicesSkipped: z.number(),
  entriesImported: z.number(),
  entriesSkipped: z.number(),
  error: z.string().optional(),
});
export type BulkImportJobStatus = z.infer<typeof BulkImportJobStatusSchema>;
// Retained alias — sale-history and cash-flow imports share the same job status shape.
export const BulkSaleImportJobStatusSchema = BulkImportJobStatusSchema;
export type BulkSaleImportJobStatus = BulkImportJobStatus;

export const BulkCashFlowPartySchema = z.object({
  name: z.string(),
});
export type BulkCashFlowParty = z.infer<typeof BulkCashFlowPartySchema>;

export const BulkCashFlowEntrySchema = z.object({
  partyName: z.string(),
  type: z.enum(["payment_in", "payment_out"]),
  date: z.string(),
  amount: z.number(),
  number: z.string().optional(),
  description: z.string().optional(),
});
export type BulkCashFlowEntry = z.infer<typeof BulkCashFlowEntrySchema>;

export const BulkCashFlowImportRequestSchema = z.object({
  companyTag: z.string().optional(),
  companyId: z.string().uuid().nullable().optional(),
  parties: z.array(BulkCashFlowPartySchema),
  entries: z.array(BulkCashFlowEntrySchema),
});
export type BulkCashFlowImportRequest = z.infer<typeof BulkCashFlowImportRequestSchema>;

export const BulkExpenseEntrySchema = z.object({
  category: z.string(),
  paymentType: z.string(),
  date: z.string(),
  amount: z.number(),
  balance: z.number().optional(),
  number: z.string().optional(),
  description: z.string().optional(),
});
export type BulkExpenseEntry = z.infer<typeof BulkExpenseEntrySchema>;

export const BulkExpenseImportRequestSchema = z.object({
  companyTag: z.string().optional(),
  companyId: z.string().uuid().nullable().optional(),
  partyName: z.string().optional(),
  entries: z.array(BulkExpenseEntrySchema),
});
export type BulkExpenseImportRequest = z.infer<typeof BulkExpenseImportRequestSchema>;

export const TEAM_ROLES = [
  "secondary_admin",
  "salesman",
  "biller",
  "biller_salesman",
  "ca_accountant",
  "stock_keeper",
  "ca_accountant_edit",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  name: z.string(),
  contact: z.string(),
  role: z.string(),
  permissions: z.string().default("[]"),
  allowedReports: z.string().default("[]"),
  status: z.string(),
  inviteToken: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

// ── Team permissions ──────────────────────────────────────────────────────────
// Canonical permission catalog + per-role defaults, shared so mobile and desktop
// always offer the exact same permission options. Mobile currently keeps its own
// copy inline (apps/mobile/app/add-user.tsx) for historical reasons — this export
// is the source of truth for any NEW client (desktop, future web) built against it.

export type TeamPermission = { id: string; label: string; group: string };

export const ALL_PERMISSIONS: TeamPermission[] = [
  // Sales
  { id: "sale_view",          label: "View Sale Invoices",        group: "Sales" },
  { id: "sale_create",        label: "Create Sale Invoice",       group: "Sales" },
  { id: "payment_in_view",    label: "Payment-In",                group: "Sales" },
  { id: "sale_return_view",   label: "Sale Return / Credit Note", group: "Sales" },
  { id: "estimate_view",      label: "Estimate / Quotation",      group: "Sales" },
  { id: "proforma_view",      label: "Proforma Invoice",          group: "Sales" },
  { id: "sale_order_view",    label: "Sale Order",                group: "Sales" },
  { id: "delivery_note_view", label: "Delivery Note",             group: "Sales" },
  { id: "sale_edit_own",      label: "Edit Own Sales",            group: "Sales" },
  { id: "sale_edit_all",      label: "Edit All Sales",            group: "Sales" },
  // Modifier on top of sale_edit_own/sale_edit_all, not a standalone edit grant — narrows
  // whichever of those two is on to only that invoice's own creation date. Off by default:
  // adding it never restricts an existing team member who didn't have it before.
  { id: "sale_edit_today_only", label: "Edit Only Today's Invoices", group: "Sales" },
  { id: "sale_delete",        label: "Delete Sales",              group: "Sales" },
  // Purchase
  { id: "purchase_view",        label: "View Purchase Bills",   group: "Purchase" },
  { id: "purchase_create",      label: "Create Purchase Bill",  group: "Purchase" },
  { id: "purchase_order_view",  label: "Purchase Order",        group: "Purchase" },
  { id: "purchase_return_view", label: "Purchase Return",       group: "Purchase" },
  { id: "payment_out_view",     label: "Payment-Out",           group: "Purchase" },
  { id: "purchase_edit_own",    label: "Edit Own Purchases",    group: "Purchase" },
  { id: "purchase_edit_all",    label: "Edit All Purchases",    group: "Purchase" },
  { id: "purchase_delete",      label: "Delete Purchases",      group: "Purchase" },
  // Parties
  { id: "parties_view",    label: "View Parties",       group: "Parties" },
  { id: "parties_create",  label: "Add Parties",        group: "Parties" },
  { id: "parties_edit",    label: "Edit Parties",       group: "Parties" },
  { id: "parties_balance", label: "View Party Balance", group: "Parties" },
  // Items
  { id: "items_view",   label: "View Items",   group: "Items" },
  { id: "items_create", label: "Add Items",    group: "Items" },
  { id: "items_edit",   label: "Edit Items",   group: "Items" },
  { id: "items_delete", label: "Delete Items", group: "Items" },
  // Reports
  { id: "reports_view",   label: "View Reports",              group: "Reports" },
  { id: "reports_export", label: "Export / Download Reports", group: "Reports" },
  // Cash & Bank
  { id: "cash_view",   label: "View Cash & Bank",    group: "Cash & Bank" },
  { id: "cash_create", label: "Add Cash/Bank Entry", group: "Cash & Bank" },
  // Expenses
  { id: "expense_view",   label: "View Expenses",   group: "Expenses" },
  { id: "expense_create", label: "Create Expenses", group: "Expenses" },
  // Team
  { id: "team_view",   label: "View Team Members",         group: "Team" },
  { id: "team_manage", label: "Add / Remove Team Members", group: "Team" },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<TeamRole, string[]> = {
  secondary_admin: [
    "sale_view", "sale_create", "payment_in_view", "sale_return_view", "estimate_view",
    "proforma_view", "sale_order_view", "delivery_note_view",
    "sale_edit_own", "sale_edit_all", "sale_delete",
    "purchase_view", "purchase_create", "purchase_order_view", "purchase_return_view",
    "payment_out_view", "purchase_edit_own", "purchase_edit_all", "purchase_delete",
    "parties_view", "parties_create", "parties_edit", "parties_balance",
    "items_view", "items_create", "items_edit", "items_delete",
    "reports_view", "reports_export",
    "cash_view", "cash_create",
    "expense_view", "expense_create",
    "team_view",
  ],
  salesman: [
    "sale_view", "sale_create", "payment_in_view", "sale_edit_own",
    "parties_view",
    "items_view",
    "expense_view", "expense_create",
  ],
  biller: [
    "sale_view", "sale_create", "payment_in_view", "sale_edit_own",
    "parties_view", "parties_balance",
  ],
  biller_salesman: [
    "sale_view", "sale_create", "payment_in_view", "sale_edit_own",
    "parties_view", "parties_balance",
    "items_view",
    "expense_view", "expense_create",
  ],
  ca_accountant: [
    "sale_view",
    "purchase_view",
    "parties_view", "parties_balance",
    "items_view",
    "reports_view", "reports_export",
    "cash_view",
  ],
  ca_accountant_edit: [
    "sale_view", "sale_create", "payment_in_view", "sale_return_view",
    "sale_edit_own", "sale_edit_all", "sale_delete",
    "purchase_view", "purchase_create", "purchase_order_view", "purchase_return_view",
    "purchase_edit_own", "purchase_edit_all",
    "parties_view", "parties_create", "parties_edit", "parties_balance",
    "items_view", "items_create", "items_edit",
    "reports_view", "reports_export",
    "cash_view",
    "expense_view", "expense_create",
  ],
  stock_keeper: [
    "purchase_view", "purchase_create", "purchase_order_view", "purchase_return_view",
    "purchase_edit_own",
    "items_view", "items_create", "items_edit",
    "expense_view", "expense_create",
  ],
};

// ── Report catalog ────────────────────────────────────────────────────────────
// Canonical list of every report key either client can navigate to (desktop's is the
// superset; mobile currently exposes a subset of these keys under its own labels/groups).
// Used only to build the "which reports can this staff member see" checklist in Add/Edit
// User — a team member's `reports_view` permission is still the master switch; an empty
// `allowedReports` array under it means "no extra restriction, show everything" so this
// is purely additive and never changes behavior for an existing team member on its own.
export type ReportCatalogEntry = { key: string; label: string; group: string };

export const ALL_REPORTS: ReportCatalogEntry[] = [
  { key: "sale",              label: "Sale",                        group: "Transaction Reports" },
  { key: "purchase",          label: "Purchase",                     group: "Transaction Reports" },
  { key: "day-book",          label: "Day Book",                     group: "Transaction Reports" },
  { key: "all-transactions",  label: "All Transactions",             group: "Transaction Reports" },
  { key: "profit-and-loss",   label: "Profit & Loss",                group: "Transaction Reports" },
  { key: "cash-flow",         label: "Cash Flow",                    group: "Transaction Reports" },
  { key: "expense",           label: "Expense",                      group: "Transaction Reports" },
  { key: "party-statement",              label: "Party Statement",              group: "Party Reports" },
  { key: "all-parties",                  label: "All Parties",                  group: "Party Reports" },
  { key: "sale-purchase-by-party",       label: "Sale Purchase By Party",       group: "Party Reports" },
  { key: "party-report-by-item",         label: "Party Report By Item",         group: "Party Reports" },
  { key: "sale-purchase-by-party-group", label: "Sale Purchase By Party Group", group: "Party Reports" },
  { key: "stock-summary",       label: "Stock Summary",               group: "Item / Stock Reports" },
  { key: "item-report-by-party", label: "Item Report By Party",       group: "Item / Stock Reports" },
  { key: "item-wise-pnl",       label: "Item Wise Profit & Loss",     group: "Item / Stock Reports" },
  { key: "item-category-pnl",   label: "Item Category Profit & Loss", group: "Item / Stock Reports" },
  { key: "low-stock",           label: "Low Stock Summary",           group: "Item / Stock Reports" },
  { key: "stock-detail",        label: "Stock Detail",                group: "Item / Stock Reports" },
  { key: "item-detail",         label: "Item Detail",                 group: "Item / Stock Reports" },
  { key: "sale-purchase-by-item-category", label: "Sale/Purchase By Item Category", group: "Item / Stock Reports" },
  { key: "stock-summary-by-category",      label: "Stock Summary By Category",      group: "Item / Stock Reports" },
  { key: "item-wise-discount",  label: "Item Wise Discount",          group: "Item / Stock Reports" },
  { key: "bank-statement",  label: "Bank Statement",  group: "Business Status" },
  { key: "discount-report", label: "Discount Report", group: "Business Status" },
  { key: "expense-category", label: "Expense Category", group: "Business Status" },
  { key: "expense-item",     label: "Expense Item",     group: "Business Status" },
  { key: "tax-report",      label: "Tax Report",      group: "Taxes" },
  { key: "tax-rate-report", label: "Tax Rate Report", group: "Taxes" },
  { key: "sale-purchase-orders",      label: "Sale / Purchase Orders",      group: "Orders" },
  { key: "sale-purchase-order-items", label: "Sale / Purchase Order Items", group: "Orders" },
  { key: "loan-statement", label: "Loan Statement", group: "Loan Accounts" },
];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  secondary_admin: "Secondary Admin",
  salesman: "Salesman",
  biller: "Biller",
  biller_salesman: "Biller & Salesman",
  ca_accountant: "CA / Accountant",
  stock_keeper: "Stock Keeper",
  ca_accountant_edit: "CA / Accountant (Edit)",
};
