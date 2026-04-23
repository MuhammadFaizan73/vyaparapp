import axios, { AxiosInstance } from "axios";
import type {
  RegisterRequest,
  RegisterResponse,
  LicenseStatus,
  Party,
  CreatePartyRequest,
  User,
} from "@vyapar/shared-types";

export class VyaparApiClient {
  private http: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    this.http = axios.create({
      baseURL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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

  async getLicenseStatus(): Promise<LicenseStatus> {
    const { data } = await this.http.get<LicenseStatus>("/license/status");
    return data;
  }

  async activateLicense(key: string): Promise<LicenseStatus> {
    const { data } = await this.http.post<LicenseStatus>("/license/activate", { key });
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

  async getMe(): Promise<User> {
    const { data } = await this.http.get<User>("/auth/me");
    return data;
  }
}

export type {
  User,
  Party,
  CreatePartyRequest,
  Tenant,
  RegisterRequest,
  RegisterResponse,
  LicenseStatus,
  ActivateLicenseRequest,
} from "@vyapar/shared-types";
