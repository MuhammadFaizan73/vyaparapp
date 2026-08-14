import { Injectable, InternalServerErrorException } from "@nestjs/common";

// D7 Networks — cheaper than MSG91/Twilio on Pakistan local routes (flat per-SMS, no
// monthly platform fee; see the conversation this was requested in). Swapping providers
// later only means rewriting the calls below; nothing outside this file needs to know
// which SMS vendor is behind it.
//
// Docs: https://d7networks.com/docs/verify/overview/
// Env vars required: D7_API_TOKEN. D7_ORIGINATOR is optional (sender name shown to the
// recipient, defaults to "VyaparPK").
//
// D7's verify API is request-id based (send-otp returns an otp_id that verify-otp needs),
// unlike MSG91's phone-keyed flow the rest of this module was originally shaped around.
// To keep auth.controller.ts and its DTOs untouched, the otp_id is cached here in-memory
// per phone number for the OTP's lifetime instead of threading it through the API surface.
const D7_BASE_URL = "https://api.d7networks.com/verify/v1";
const OTP_TTL_MS = 5 * 60 * 1000;

interface PendingOtp {
  requestId: string;
  expiresAt: number;
}

@Injectable()
export class SmsService {
  private readonly pending = new Map<string, PendingOtp>();

  private get apiToken(): string {
    const token = process.env.D7_API_TOKEN;
    if (!token) throw new InternalServerErrorException("SMS provider is not configured (D7_API_TOKEN missing).");
    return token;
  }

  private get originator(): string {
    return process.env.D7_ORIGINATOR || "VyaparPK";
  }

  // Mirrors AuthService.register's normalization so the same phone number always maps to
  // the same key here, regardless of a leading "0" on the local part.
  private normalize(countryCode: string, phone: string): string {
    return `${countryCode}${phone.replace(/^0+/, "")}`;
  }

  async sendOtp(countryCode: string, phone: string): Promise<void> {
    const recipient = this.normalize(countryCode, phone);
    const res = await fetch(`${D7_BASE_URL}/otp/send-otp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originator: this.originator,
        recipient,
        content: "Your Vyapar verification code is: {}",
        expiry: OTP_TTL_MS / 1000,
        channel: "SMS",
        otp_code_length: 6,
        otp_type: "numeric",
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.request_id) {
      throw new InternalServerErrorException(data.message || "Could not send verification code.");
    }

    this.pending.set(recipient, { requestId: data.request_id, expiresAt: Date.now() + OTP_TTL_MS });
  }

  async verifyOtp(countryCode: string, phone: string, otp: string): Promise<boolean> {
    const recipient = this.normalize(countryCode, phone);
    const entry = this.pending.get(recipient);
    if (!entry || entry.expiresAt < Date.now()) return false;

    const res = await fetch(`${D7_BASE_URL}/verify-otp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp_id: entry.requestId, otp_code: otp }),
    });

    const data = await res.json().catch(() => ({}));
    const approved = res.ok && data.status === "APPROVED";
    if (approved) this.pending.delete(recipient);
    return approved;
  }

  async resendOtp(countryCode: string, phone: string): Promise<void> {
    await this.sendOtp(countryCode, phone);
  }
}
