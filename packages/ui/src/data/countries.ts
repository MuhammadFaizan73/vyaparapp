export type Country = {
  name: string;
  dial: string;
  iso: string;
  flag: string;
};

export const COUNTRIES: Country[] = [
  { name: "Pakistan", dial: "+92", iso: "PK", flag: "🇵🇰" },
  { name: "India", dial: "+91", iso: "IN", flag: "🇮🇳" },
  { name: "United Arab Emirates", dial: "+971", iso: "AE", flag: "🇦🇪" },
  { name: "Saudi Arabia", dial: "+966", iso: "SA", flag: "🇸🇦" },
  { name: "United Kingdom", dial: "+44", iso: "GB", flag: "🇬🇧" },
  { name: "United States", dial: "+1", iso: "US", flag: "🇺🇸" },
  { name: "Canada", dial: "+1", iso: "CA", flag: "🇨🇦" },
  { name: "Bangladesh", dial: "+880", iso: "BD", flag: "🇧🇩" },
  { name: "Afghanistan", dial: "+93", iso: "AF", flag: "🇦🇫" },
  { name: "Qatar", dial: "+974", iso: "QA", flag: "🇶🇦" },
  { name: "Kuwait", dial: "+965", iso: "KW", flag: "🇰🇼" },
  { name: "Oman", dial: "+968", iso: "OM", flag: "🇴🇲" },
  { name: "Turkey", dial: "+90", iso: "TR", flag: "🇹🇷" },
  { name: "Malaysia", dial: "+60", iso: "MY", flag: "🇲🇾" },
  { name: "Singapore", dial: "+65", iso: "SG", flag: "🇸🇬" },
  { name: "Australia", dial: "+61", iso: "AU", flag: "🇦🇺" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];
