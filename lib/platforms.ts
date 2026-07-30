/**
 * Single source of truth for the connector platforms VaultTrust supports.
 *
 * Adding an income provider means adding one entry here plus a transaction
 * generator in `adapters.ts` — the API aggregation, consent toggles, chart
 * series and connect-page cards all derive from this list.
 *
 * IMPORTANT: platforms carry a `kind`. Income math (source mix, monthly
 * aggregates, IVS diversity) must iterate `INCOME_PLATFORMS`, never
 * `PLATFORMS` — an outflow source like a credit card would otherwise be
 * counted as earnings and inflate verified income.
 */

export const PLATFORMS = [
  "PAYONEER",
  "BANK_TRANSFER",
  "LOCAL_INVOICING",
  "NAYAPAY",
  "JAZZCASH",
  "EASYPAISA",
  "CREDIT_CARD",
] as const;

export type Platform = (typeof PLATFORMS)[number];

/**
 * Platforms that represent money coming in. Declared explicitly rather than
 * derived from a runtime filter so the compiler can enforce exhaustiveness on
 * income-only maps (e.g. the sandbox transaction generators).
 */
export type IncomePlatform = Exclude<Platform, "CREDIT_CARD">;

/**
 * How a platform is presented. `category` drives which card layout the
 * connect page uses: the original sources keep their bespoke cards, and every
 * mobile wallet renders from one shared card component.
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
  category: "global" | "bank" | "invoice" | "wallet" | "credit";
  /** Whether this source adds to income or represents an obligation. */
  kind: "income" | "outflow";
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  PAYONEER: {
    label: "Payoneer",
    tagline: "Global Payments Account",
    icon: "account_balance_wallet",
    consentLabel: "Payoneer income averages",
    color: "#003127",
    category: "global",
    kind: "income",
  },
  BANK_TRANSFER: {
    label: "Bank Transfer",
    tagline: "Direct Bank Inflows",
    icon: "account_balance",
    consentLabel: "Direct bank consistency metrics",
    color: "#006a6a",
    category: "bank",
    kind: "income",
  },
  LOCAL_INVOICING: {
    label: "Local Invoicing",
    tagline: "Client Invoices",
    icon: "cloud_upload",
    consentLabel: "Local invoice growth analysis",
    color: "#735c00",
    category: "invoice",
    kind: "income",
  },
  NAYAPAY: {
    label: "NayaPay",
    tagline: "Mobile Wallet & Raast Transfers",
    icon: "account_balance_wallet",
    consentLabel: "NayaPay wallet activity",
    color: "#2b6958",
    category: "wallet",
    kind: "income",
  },
  JAZZCASH: {
    label: "JazzCash",
    tagline: "Mobile Wallet & Bill Payments",
    icon: "smartphone",
    consentLabel: "JazzCash wallet activity",
    color: "#93000a",
    category: "wallet",
    kind: "income",
  },
  EASYPAISA: {
    label: "Easypaisa",
    tagline: "Mobile Wallet & Merchant Payouts",
    icon: "phone_iphone",
    consentLabel: "Easypaisa wallet activity",
    color: "#0b5041",
    category: "wallet",
    kind: "income",
  },
  CREDIT_CARD: {
    label: "Credit Card",
    tagline: "Spending & Repayment Obligations",
    icon: "credit_card",
    consentLabel: "Debt-to-income and utilisation ratios",
    // Deliberately outside the income palette — a neutral plum reads as
    // "different category" wherever it sits next to earnings colours.
    color: "#3f3052",
    category: "credit",
    kind: "outflow",
  },
};

/**
 * Sources that count toward verified income. Use for all income math.
 *
 * Spelled out as a literal tuple (rather than a runtime `.filter`) so it can
 * back a `z.enum()` and so the two assertions below can prove — at compile
 * time — that it stays exactly in step with `PLATFORMS`/`kind`.
 */
export const INCOME_PLATFORMS = [
  "PAYONEER",
  "BANK_TRANSFER",
  "LOCAL_INVOICING",
  "NAYAPAY",
  "JAZZCASH",
  "EASYPAISA",
] as const satisfies readonly IncomePlatform[];

// `satisfies` above rejects extras; this rejects omissions. Together they mean
// adding a platform without classifying it is a build error, not a silent bug
// where new earnings quietly vanish from the source mix.
type MissingIncomePlatform = Exclude<
  IncomePlatform,
  (typeof INCOME_PLATFORMS)[number]
>;
const _assertEveryIncomePlatformListed: MissingIncomePlatform extends never
  ? true
  : never = true;
void _assertEveryIncomePlatformListed;

/** Sources that represent obligations rather than earnings. */
export const OUTFLOW_PLATFORMS = PLATFORMS.filter(
  (p) => PLATFORM_META[p].kind === "outflow"
);

/** Platforms rendered by the shared wallet card on the connect page. */
export const WALLET_PLATFORMS = PLATFORMS.filter(
  (p) => PLATFORM_META[p].category === "wallet"
);

export function isIncomePlatform(p: Platform): p is IncomePlatform {
  return PLATFORM_META[p].kind === "income";
}

/** A zeroed accumulator keyed by every income platform. */
export function zeroByIncomePlatform(): Record<IncomePlatform, number> {
  return INCOME_PLATFORMS.reduce(
    (acc, p) => ({ ...acc, [p]: 0 }),
    {} as Record<IncomePlatform, number>
  );
}
