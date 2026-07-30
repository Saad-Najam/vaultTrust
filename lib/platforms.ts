/**
 * Single source of truth for the income-source platforms VaultTrust supports.
 *
 * Adding a provider means adding one entry here plus a transaction generator
 * in `adapters.ts` — the API aggregation, consent toggles, chart series and
 * connect-page cards all derive from this list rather than hardcoding names.
 */

export const PLATFORMS = [
  "PAYONEER",
  "BANK_TRANSFER",
  "LOCAL_INVOICING",
  "NAYAPAY",
  "JAZZCASH",
  "EASYPAISA",
] as const;

export type Platform = (typeof PLATFORMS)[number];

/**
 * How a platform is presented. `category` drives which card layout the
 * connect page uses: the three original sources keep their bespoke cards,
 * and every mobile wallet renders from one shared card component.
 */
export interface PlatformMeta {
  label: string;
  /** Uppercase strapline under the name on connect cards. */
  tagline: string;
  /** Material Symbols icon name. */
  icon: string;
  /** Sentence describing what the source contributes, used in consent copy. */
  consentLabel: string;
  /**
   * Chart/legend colour as a hex string. Applied via inline styles on
   * purpose — Tailwind cannot statically extract `bg-${dynamic}` classes,
   * so a class-name map would silently purge to nothing.
   */
  color: string;
  category: "global" | "bank" | "invoice" | "wallet";
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  PAYONEER: {
    label: "Payoneer",
    tagline: "Global Payments Account",
    icon: "account_balance_wallet",
    consentLabel: "Payoneer income averages",
    color: "#003127",
    category: "global",
  },
  BANK_TRANSFER: {
    label: "Bank Transfer",
    tagline: "Direct Bank Inflows",
    icon: "account_balance",
    consentLabel: "Direct bank consistency metrics",
    color: "#006a6a",
    category: "bank",
  },
  LOCAL_INVOICING: {
    label: "Local Invoicing",
    tagline: "Client Invoices",
    icon: "cloud_upload",
    consentLabel: "Local invoice growth analysis",
    color: "#735c00",
    category: "invoice",
  },
  NAYAPAY: {
    label: "NayaPay",
    tagline: "Mobile Wallet & Raast Transfers",
    icon: "account_balance_wallet",
    consentLabel: "NayaPay wallet activity",
    color: "#2b6958",
    category: "wallet",
  },
  JAZZCASH: {
    label: "JazzCash",
    tagline: "Mobile Wallet & Bill Payments",
    icon: "smartphone",
    consentLabel: "JazzCash wallet activity",
    color: "#93000a",
    category: "wallet",
  },
  EASYPAISA: {
    label: "Easypaisa",
    tagline: "Mobile Wallet & Merchant Payouts",
    icon: "phone_iphone",
    consentLabel: "Easypaisa wallet activity",
    color: "#0b5041",
    category: "wallet",
  },
};

/** Platforms rendered by the shared wallet card on the connect page. */
export const WALLET_PLATFORMS = PLATFORMS.filter(
  (p) => PLATFORM_META[p].category === "wallet"
);

/** A zeroed accumulator keyed by every platform. */
export function zeroByPlatform(): Record<Platform, number> {
  return PLATFORMS.reduce(
    (acc, p) => ({ ...acc, [p]: 0 }),
    {} as Record<Platform, number>
  );
}
