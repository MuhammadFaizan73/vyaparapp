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
  partyType: z.enum(["customer", "supplier", "both"]).default("both"),
  isSystem: z.boolean(),
  groupId: z.string().nullable(),
  groupName: z.string().nullable(),
  balance: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
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
  partyType: z.enum(["customer", "supplier", "both"]).optional(),
  groupId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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
  unit: z.string().nullable(),
  secondaryUnit: z.string().nullable(),
  conversionRate: z.string().nullable(),
  mrp: z.number().nullable(),
  salePrice: z.number().nullable(),
  purchasePrice: z.number().nullable(),
  discount: z.number().nullable(),
  openingStock: z.number(),
  minStock: z.number(),
  companyTag: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Item = z.infer<typeof ItemSchema>;

export const CreateItemRequestSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().optional(),
  unit: z.string().optional(),
  secondaryUnit: z.string().optional(),
  conversionRate: z.string().optional(),
  mrp: z.number().optional(),
  salePrice: z.number().optional(),
  purchasePrice: z.number().optional(),
  discount: z.number().min(0).max(100).optional(),
  openingStock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  companyTag: z.string().optional(),
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
});
export type CreateTransactionRequest = z.infer<typeof CreateTransactionRequestSchema>;

export const UpdateTransactionRequestSchema = z.object({
  partyId: z.string().uuid().optional(),
  date: z.string().optional(),
  total: z.number().optional(),
  balance: z.number().optional(),
  notes: z.string().optional(),
});
export type UpdateTransactionRequest = z.infer<typeof UpdateTransactionRequestSchema>;

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
