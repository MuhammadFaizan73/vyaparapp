import { Injectable, InternalServerErrorException } from "@nestjs/common";

// MSG91's OTP API (v5) — chosen for cost on Pakistan routes over Twilio/Firebase (see the
// conversation this was requested in). Swapping providers later only means rewriting the
// two calls below; nothing outside this file needs to know which SMS vendor is behind it.
//
// Docs: https://docs.msg91.com/p/tf9GTb4mQ/e/Vt8O5qXPYU/MSG91
// Env vars required: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID (an approved OTP template in the
// MSG91 dashboard — the template's placeholder is filled with the OTP automatically).
const MSG91_BASE = "https://control.msg91.com/api/v5/otp";

@Injectable()
export class SmsService {
  private get authKey(): string {
    const key = process.env.MSG91_AUTH_KEY;
    if (!key) throw new InternalServerErrorException("SMS provider is not configured (MSG91_AUTH_KEY missing).");
    return key;
  }

  private get templateId(): string {
    const id = process.env.MSG91_TEMPLATE_ID;
    if (!id) throw new InternalServerErrorException("SMS provider is not configured (MSG91_TEMPLATE_ID missing).");
    return id;
  }

  // MSG91 wants the number as countrycode+number with no "+" and no spaces, e.g. "923001234567".
  private normalize(countryCode: string, phone: string): string {
    return `${countryCode}${phone}`.replace(/[^\d]/g, "");
  }

  async sendOtp(countryCode: string, phone: string): Promise<void> {
    const mobile = this.normalize(countryCode, phone);
    const url = `${MSG91_BASE}?template_id=${this.templateId}&mobile=${mobile}&authkey=${this.authKey}`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.type !== "success") {
      throw new InternalServerErrorException(data.message || "Could not send verification code.");
    }
  }

  async verifyOtp(countryCode: string, phone: string, otp: string): Promise<boolean> {
    const mobile = this.normalize(countryCode, phone);
    const url = `${MSG91_BASE}/verify?otp=${encodeURIComponent(otp)}&mobile=${mobile}`;
    const res = await fetch(url, { method: "GET", headers: { authkey: this.authKey } });
    const data = await res.json().catch(() => ({}));
    return data.type === "success";
  }

  async resendOtp(countryCode: string, phone: string, via: "text" | "voice" = "text"): Promise<void> {
    const mobile = this.normalize(countryCode, phone);
    const url = `${MSG91_BASE}/retry?authkey=${this.authKey}&mobile=${mobile}&retrytype=${via}`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.type !== "success") {
      throw new InternalServerErrorException(data.message || "Could not resend verification code.");
    }
  }
}
