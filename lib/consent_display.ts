import type { Consent } from "./db";

/**
 * Consents store `grantedAt` + `duration`; there is no stored expiry date.
 * Several screens used to read a non-existent `consent.expiresAt` and always
 * rendered "N/A" — this derives the real answer in one place instead.
 */
export function formatConsentExpiry(consent: Consent): string {
  if (consent.status === "REVOKED") return "Revoked";
  if (consent.duration === "ONE_TIME") return "On first access";

  const granted = new Date(consent.grantedAt);
  if (Number.isNaN(granted.getTime())) return "N/A";

  const expiry = new Date(granted);
  expiry.setMonth(expiry.getMonth() + 6); // ROLLING_6MO
  return expiry.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
