import { Injectable, InternalServerErrorException } from "@nestjs/common";

// D7 Networks — cheaper than MSG91/Twilio on Pakistan local routes (flat per-SMS, no
// monthly platform fee; see the conversation this was requested in). Swapping providers
// later only means rewriting the calls below; nothing outside this file needs to know
// which SMS vendor is behind it.
//
// Docs: https://d7networks.com/docs/verify/overview/
// Env vars required: D7_CLIENT_ID, D7_CLIENT_SECRET (from the D7 Control Panel — this
// account's dashboard issues a Client ID/Secret pair, not a single static token, per
// https://d7networks.com/docs/Authentication/Generate-Token/). D7_ORIGINATOR is optional
// (sender name shown to the recipient, defaults to "VyaparPK").
//
// D7's verify API is request-id based (send-otp returns an otp_id that verify-otp needs),
// unlike MSG91's phone-keyed flow the rest of this module was originally shaped around.
// To keep auth.controller.ts and its DTOs untouched, the otp_id is cached here in-memory
// per phone number for the OTP's lifetime instead of threading it through the API surface.
const D7_AUTH_URL = "https://api.d7networks.com/auth/v1/login/application";
const D7_BASE_URL = "https://api.d7networks.com/verify/v1";
const OTP_TTL_MS = 5 * 60 * 1000;

interface PendingOtp {
  requestId: string;
  expiresAt: number;
}

@Injectable()
export class SmsService {
  private readonly pending = new Map<string, PendingOtp>();
  private cachedToken: string | null = null;

  private get clientId(): string {
    const id = process.env.D7_CLIENT_ID;
    if (!id) throw new InternalServerErrorException("SMS provider is not configured (D7_CLIENT_ID missing).");
    return id;
  }

  private get clientSecret(): string {
    const secret = process.env.D7_CLIENT_SECRET;
    if (!secret) throw new InternalServerErrorException("SMS provider is not configured (D7_CLIENT_SECRET missing).");
    return secret;
  }

  private get originator(): string {
    return process.env.D7_ORIGINATOR || "VyaparPK";
  }

  // D7's Client ID/Secret must be exchanged for a Bearer access token (undocumented expiry —
  // see the docs link above). Cached in-memory rather than tracking an unknown TTL; cleared
  // and re-fetched once on a 401 instead.
  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (this.cachedToken && !forceRefresh) return this.cachedToken;
    const body = new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret });
    const res = await fetch(D7_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new InternalServerErrorException("Could not authenticate with SMS provider.");
    }
    this.cachedToken = data.access_token;
    return this.cachedToken as string;
  }

  private async withAuth(
    fn: (token: string) => Promise<{ res: Response; data: any }>,
  ): Promise<{ res: Response; data: any }> {
    const token = await this.getAccessToken();
    let result = await fn(token);
    if (result.res.status === 401) {
      const fresh = await this.getAccessToken(true);
      result = await fn(fresh);
    }
    return result;
  }

  // Mirrors AuthService.register's normalization so the same phone number always maps to
  // the same key here, regardless of a leading "0" on the local part.
  private normalize(countryCode: string, phone: string): string {
    return `${countryCode}${phone.replace(/^0+/, "")}`;
  }

  async sendOtp(countryCode: string, phone: string): Promise<void> {
    const recipient = this.normalize(countryCode, phone);
    const { res, data } = await this.withAuth(async (token) => {
      const r = await fetch(`${D7_BASE_URL}/otp/send-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originator: this.originator,
          recipient,
          content: "Your Godigi verification code is: {}",
          expiry: OTP_TTL_MS / 1000,
          channel: "SMS",
          otp_code_length: 6,
          otp_type: "numeric",
        }),
      });
      const d = await r.json().catch(() => ({}));
      return { res: r, data: d };
    });

    // D7's actual response field is `otp_id` (confirmed by hand against a real request —
    // the docs/older code here previously assumed `request_id`, which the API never sends).
    if (!res.ok || !data.otp_id) {
      throw new InternalServerErrorException(data.message || "Could not send verification code.");
    }

    this.pending.set(recipient, { requestId: data.otp_id, expiresAt: Date.now() + OTP_TTL_MS });
  }

  async verifyOtp(countryCode: string, phone: string, otp: string): Promise<boolean> {
    const recipient = this.normalize(countryCode, phone);
    const entry = this.pending.get(recipient);
    if (!entry || entry.expiresAt < Date.now()) return false;

    const { res, data } = await this.withAuth(async (token) => {
      const r = await fetch(`${D7_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp_id: entry.requestId, otp_code: otp }),
      });
      const d = await r.json().catch(() => ({}));
      return { res: r, data: d };
    });

    const approved = res.ok && data.status === "APPROVED";
    if (approved) this.pending.delete(recipient);
    return approved;
  }

  async resendOtp(countryCode: string, phone: string): Promise<void> {
    await this.sendOtp(countryCode, phone);
  }
}
