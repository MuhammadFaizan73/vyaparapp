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
  isSystem: z.boolean(),
  balance: z.number(),
  createdAt: z.string().datetime(),
});
export type Party = z.infer<typeof PartySchema>;

export const CreatePartyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().optional(),
  billingAddress: z.string().optional(),
});
export type CreatePartyRequest = z.infer<typeof CreatePartyRequestSchema>;

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
