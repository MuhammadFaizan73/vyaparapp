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
  createdAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

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
});
export type UpdateTransactionRequest = z.infer<typeof UpdateTransactionRequestSchema>;

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

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  secondary_admin: "Secondary Admin",
  salesman: "Salesman",
  biller: "Biller",
  biller_salesman: "Biller & Salesman",
  ca_accountant: "CA / Accountant",
  stock_keeper: "Stock Keeper",
  ca_accountant_edit: "CA / Accountant (Edit)",
};
