import axios, { AxiosInstance } from "axios";
import type {
  RegisterRequest,
  RegisterResponse,
  LicenseStatus,
  Party,
  CreatePartyRequest,
  UpdatePartyRequest,
  PartyGroup,
  User,
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  TeamMember,
  BulkSaleImportRequest,
  BulkSaleImportJobStatus,
  BulkCashFlowImportRequest,
  BulkImportJobStatus,
  BulkExpenseImportRequest,
} from "@vyapar/shared-types";

export type BankAccount = {
  id: string;
  tenantId: string;
  name: string;
  openingBalance: number;
  openingBalanceDate: string;
  printOnInvoices: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExtraCompany = {
  id: string;
  name: string;
  businessType: string;
  phone: string;
  email: string;
  gstin: string;
};

export type PartyAssignment = {
  id: string;
  partyId: string;
  memberId: string;
  visitDays: string; // "Mon,Wed,Fri"
  party?: { id: string; name: string; phone?: string; city?: string };
  member?: { id: string; name: string; contact: string; role: string };
};

export type ShopVisit = {
  id: string;
  tenantId: string;
  memberId: string;
  partyId: string | null;
  partyName: string | null;
  latitude: number | null;
  longitude: number | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMin: number | null;
  notes: string | null;
};

export type LocationPingPoint = {
  latitude: number;
  longitude: number;
  createdAt: string;
};

export type DeviceSession = {
  id: string;
  tenantId: string;
  deviceId: string;
  deviceName: string;
  deviceType: "mobile" | "desktop" | "web";
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
};

export class VyaparApiClient {
  private http: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        "bypass-tunnel-reminder": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  setToken(token: string) {
    this.http.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  clearToken() {
    delete this.http.defaults.headers.common.Authorization;
  }

  async register(body: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await this.http.post<RegisterResponse>("/auth/register", body);
    return data;
  }

  async getLicenseStatus(platform: "desktop" | "mobile" = "desktop"): Promise<LicenseStatus> {
    const { data } = await this.http.get<LicenseStatus>(`/license/status?platform=${platform}`);
    return data;
  }

  async activateLicense(key: string, platform: "desktop" | "mobile" = "desktop"): Promise<LicenseStatus> {
    const { data } = await this.http.post<LicenseStatus>("/license/activate", { key, platform });
    return data;
  }

  async getParties(): Promise<Party[]> {
    const { data } = await this.http.get<Party[]>("/parties");
    return data;
  }

  async createParty(body: CreatePartyRequest): Promise<Party> {
    const { data } = await this.http.post<Party>("/parties", body);
    return data;
  }

  async updateParty(id: string, body: UpdatePartyRequest): Promise<Party> {
    const { data } = await this.http.patch<Party>(`/parties/${id}`, body);
    return data;
  }

  async deleteParty(id: string): Promise<void> {
    await this.http.delete(`/parties/${id}`);
  }

  async listPartyGroups(): Promise<PartyGroup[]> {
    const { data } = await this.http.get<PartyGroup[]>("/party-groups");
    return data;
  }

  async createPartyGroup(name: string): Promise<PartyGroup> {
    const { data } = await this.http.post<PartyGroup>("/party-groups", { name });
    return data;
  }

  async deletePartyGroup(id: string): Promise<void> {
    await this.http.delete(`/party-groups/${id}`);
  }

  async getMe(): Promise<User> {
    const { data } = await this.http.get<User>("/auth/me");
    return data;
  }

  async getTenant(): Promise<{ id: string; phone: string; countryCode: string; companyName: string | null; businessType: string | null; companyEmail: string | null; extraCompanies: ExtraCompany[]; trialStartedAt: string; trialExpiresAt: string }> {
    const { data } = await this.http.get("/auth/tenant");
    return data;
  }

  async updateTenant(body: { companyName?: string; businessType?: string; companyEmail?: string; extraCompanies?: string }): Promise<{ id: string; phone: string; countryCode: string; companyName: string | null; businessType: string | null; companyEmail: string | null; extraCompanies: ExtraCompany[] }> {
    const { data } = await this.http.patch("/auth/tenant", body);
    return data;
  }

  async createImportSession(): Promise<{ id: string }> {
    const { data } = await this.http.post<{ id: string }>("/import-sessions");
    return data;
  }

  async pollImportSession(id: string): Promise<{ status: string; contacts: Array<{ name: string; phone?: string; email?: string }> }> {
    const { data } = await this.http.get(`/import-sessions/${id}/status`);
    return data;
  }

  async getPartyTransactions(partyId: string): Promise<Transaction[]> {
    const { data } = await this.http.get<Transaction[]>(`/transactions?partyId=${partyId}`);
    return data;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    const { data } = await this.http.get<Transaction[]>("/transactions");
    return data;
  }

  async getTransactionsByType(type: string): Promise<Transaction[]> {
    const { data } = await this.http.get<Transaction[]>(`/transactions?type=${type}`);
    return data;
  }

  async createTransaction(body: CreateTransactionRequest): Promise<Transaction> {
    const { data } = await this.http.post<Transaction>("/transactions", body);
    return data;
  }

  async updateTransaction(id: string, body: UpdateTransactionRequest): Promise<Transaction> {
    const { data } = await this.http.patch<Transaction>(`/transactions/${id}`, body);
    return data;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.http.delete(`/transactions/${id}`);
  }

  async getTransactionHistory(id: string): Promise<Array<{ id: string; changes: string[]; ipAddress: string | null; createdAt: string }>> {
    const { data } = await this.http.get(`/transactions/${id}/history`);
    return data;
  }

  async getItems(): Promise<Item[]> {
    const { data } = await this.http.get<Item[]>("/items");
    return data;
  }

  async createItem(body: CreateItemRequest): Promise<Item> {
    const { data } = await this.http.post<Item>("/items", body);
    return data;
  }

  async startSaleHistoryImport(body: BulkSaleImportRequest): Promise<{ jobId: string }> {
    const { data } = await this.http.post<{ jobId: string }>("/bulk-import/sale-history", body, { timeout: 60000 });
    return data;
  }

  async getSaleHistoryImportStatus(jobId: string): Promise<BulkSaleImportJobStatus> {
    const { data } = await this.http.get<BulkSaleImportJobStatus>(`/bulk-import/sale-history/${jobId}`);
    return data;
  }

  async startCashFlowImport(body: BulkCashFlowImportRequest): Promise<{ jobId: string }> {
    const { data } = await this.http.post<{ jobId: string }>("/bulk-import/cash-flow", body, { timeout: 60000 });
    return data;
  }

  async getCashFlowImportStatus(jobId: string): Promise<BulkImportJobStatus> {
    const { data } = await this.http.get<BulkImportJobStatus>(`/bulk-import/cash-flow/${jobId}`);
    return data;
  }

  async startExpenseImport(body: BulkExpenseImportRequest): Promise<{ jobId: string }> {
    const { data } = await this.http.post<{ jobId: string }>("/bulk-import/expenses", body, { timeout: 60000 });
    return data;
  }

  async getExpenseImportStatus(jobId: string): Promise<BulkImportJobStatus> {
    const { data } = await this.http.get<BulkImportJobStatus>(`/bulk-import/expenses/${jobId}`);
    return data;
  }

  async updateItem(id: string, body: UpdateItemRequest): Promise<Item> {
    const { data } = await this.http.patch<Item>(`/items/${id}`, body);
    return data;
  }

  async deleteItem(id: string): Promise<void> {
    await this.http.delete(`/items/${id}`);
  }

  async listTeamMembers(): Promise<TeamMember[]> {
    const { data } = await this.http.get<TeamMember[]>("/team");
    return data;
  }

  async createTeamMember(body: { name: string; email: string; password: string; contact?: string; role: string; permissions?: string[] }): Promise<TeamMember> {
    const { data } = await this.http.post<TeamMember>("/team", body);
    return data;
  }

  async updateTeamMemberRole(id: string, role: string): Promise<TeamMember> {
    const { data } = await this.http.patch<TeamMember>(`/team/${id}/role`, { role });
    return data;
  }

  async updateTeamMemberPermissions(id: string, permissions: string[]): Promise<TeamMember> {
    const { data } = await this.http.patch<TeamMember>(`/team/${id}/permissions`, { permissions });
    return data;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await this.http.delete(`/team/${id}`);
  }

  async acceptInvite(token: string): Promise<{ token: string; member: { id: string; name: string; contact: string; role: string }; tenant: { id: string; phone: string; trialExpiresAt: string } }> {
    const res = await this.http.post("/team-invite/accept", { token });
    return res.data;
  }

  async staffLogin(email: string, password: string): Promise<{ token: string; member: { id: string; name: string; email: string | null; role: string; permissions: string[] }; tenant: { id: string; phone: string; trialExpiresAt: string } }> {
    const res = await this.http.post("/team-invite/login", { email, password });
    return res.data;
  }

  async getLoanAccounts(): Promise<any[]> {
    const { data } = await this.http.get("/loan-accounts");
    return data;
  }

  async createLoanAccount(body: {
    accountName: string; lenderBank?: string; accountNumber?: string; description?: string;
    currentBalance: number; balanceAsOf: string; loanReceivedIn?: string;
    interestRate?: number; termDuration?: number; processingFee?: number; processingFeePaidFrom?: string;
  }): Promise<any> {
    const { data } = await this.http.post("/loan-accounts", body);
    return data;
  }

  async updateLoanAccount(id: string, body: Partial<Parameters<VyaparApiClient["createLoanAccount"]>[0]>): Promise<any> {
    const { data } = await this.http.patch(`/loan-accounts/${id}`, body);
    return data;
  }

  async deleteLoanAccount(id: string): Promise<void> {
    await this.http.delete(`/loan-accounts/${id}`);
  }

  async getCashInHand(): Promise<{ balance: number; transactions: Array<{ id: string; type: string; rawType: string; name: string; date: string; amount: number; direction: "in" | "out"; invoiceNo: string | null }> }> {
    const { data } = await this.http.get("/cash-bank/cash-in-hand");
    return data;
  }

  async adjustCash(body: { mode: "add" | "reduce"; amount: number; date: string; description?: string }): Promise<any> {
    const { data } = await this.http.post("/cash-bank/cash-in-hand/adjust", body);
    return data;
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    const { data } = await this.http.get<BankAccount[]>("/cash-bank/banks");
    return data;
  }

  async createBankAccount(body: { name: string; openingBalance?: number; openingBalanceDate?: string; printOnInvoices?: boolean }): Promise<BankAccount> {
    const { data } = await this.http.post<BankAccount>("/cash-bank/banks", body);
    return data;
  }

  async updateBankAccount(id: string, body: { name?: string; openingBalance?: number; openingBalanceDate?: string; printOnInvoices?: boolean }): Promise<any> {
    const { data } = await this.http.patch(`/cash-bank/banks/${id}`, body);
    return data;
  }

  async deleteBankAccount(id: string): Promise<void> {
    await this.http.delete(`/cash-bank/banks/${id}`);
  }

  async getOfficeLocation(): Promise<{ lat: number | null; lng: number | null; label: string | null }> {
    const { data } = await this.http.get("/location/office");
    return data;
  }

  async setOfficeLocation(lat: number, lng: number, label?: string): Promise<void> {
    await this.http.patch("/location/office", { lat, lng, label });
  }

  async pingLocation(latitude: number, longitude: number, accuracy?: number): Promise<void> {
    await this.http.post("/location/ping", { latitude, longitude, accuracy });
  }

  async checkIn(body: { latitude: number; longitude: number; partyId?: string; partyName?: string; notes?: string }): Promise<any> {
    const { data } = await this.http.post("/location/check-in", body);
    return data;
  }

  async checkOut(visitId: string, notes?: string): Promise<any> {
    const { data } = await this.http.post(`/location/check-out/${visitId}`, { notes });
    return data;
  }

  async getMyVisits(): Promise<any[]> {
    const { data } = await this.http.get("/location/my-visits");
    return data;
  }

  async getLiveLocations(): Promise<any[]> {
    const { data } = await this.http.get("/location/live");
    return data;
  }

  async getMemberVisits(memberId: string, from?: string, to?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    const { data } = await this.http.get(`/location/visits/${memberId}${qs ? `?${qs}` : ""}`);
    return data;
  }

  async getOfficeCheckInToday(): Promise<{ checkedIn: boolean }> {
    const { data } = await this.http.get<{ checkedIn: boolean }>("/location/office-checkin-today");
    return data;
  }

  async shopCheckIn(body: { partyId: string; partyName: string; latitude: number; longitude: number; notes?: string }): Promise<ShopVisit> {
    const { data } = await this.http.post<ShopVisit>("/location/shop-checkin", body);
    return data;
  }

  async getMyRoute(): Promise<ShopVisit[]> {
    const { data } = await this.http.get<ShopVisit[]>("/location/my-route");
    return data;
  }

  async getAdminSalesmanRoute(memberId: string, date: string): Promise<ShopVisit[]> {
    const { data } = await this.http.get<ShopVisit[]>(`/location/admin/route/${memberId}?date=${date}`);
    return data;
  }

  async getAdminSalesmanPings(memberId: string, date: string): Promise<LocationPingPoint[]> {
    const { data } = await this.http.get<LocationPingPoint[]>(`/location/admin/pings/${memberId}?date=${date}`);
    return data;
  }

  async getReport(type: string, params: Record<string, string | undefined> = {}): Promise<any> {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
      .join("&");
    const url = `/reports/${type}${qs ? `?${qs}` : ""}`;
    const { data } = await this.http.get(url);
    return data;
  }

  // ── Party Assignments ──────────────────────────────────────────────────────

  async getPartyAssignments(): Promise<PartyAssignment[]> {
    const { data } = await this.http.get<PartyAssignment[]>("/party-assignments");
    return data;
  }

  async getMyAssignments(): Promise<PartyAssignment[]> {
    const { data } = await this.http.get<PartyAssignment[]>("/party-assignments/mine");
    return data;
  }

  async createAssignment(partyId: string, memberId: string, visitDays: string[]): Promise<PartyAssignment> {
    const { data } = await this.http.post<PartyAssignment>("/party-assignments", { partyId, memberId, visitDays });
    return data;
  }

  async updateAssignment(id: string, visitDays: string[]): Promise<PartyAssignment> {
    const { data } = await this.http.patch<PartyAssignment>(`/party-assignments/${id}`, { visitDays });
    return data;
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.http.delete(`/party-assignments/${id}`);
  }

  // ── Device Sessions ────────────────────────────────────────────────────────

  async registerDevice(deviceId: string, deviceName: string, deviceType: "mobile" | "desktop" | "web"): Promise<DeviceSession> {
    const { data } = await this.http.post<DeviceSession>("/devices/register", { deviceId, deviceName, deviceType });
    return data;
  }

  async getDevices(): Promise<DeviceSession[]> {
    const { data } = await this.http.get<DeviceSession[]>("/devices");
    return data;
  }

  async activateDevice(sessionId: string): Promise<DeviceSession> {
    const { data } = await this.http.post<DeviceSession>(`/devices/${sessionId}/activate`);
    return data;
  }

  async removeDevice(sessionId: string): Promise<void> {
    await this.http.delete(`/devices/${sessionId}`);
  }
}

export type {
  User,
  Party,
  CreatePartyRequest,
  UpdatePartyRequest,
  PartyGroup,
  Tenant,
  RegisterRequest,
  RegisterResponse,
  LicenseStatus,
  ActivateLicenseRequest,
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  TeamMember,
  TeamRole,
} from "@vyapar/shared-types";
export { TEAM_ROLES } from "@vyapar/shared-types";
