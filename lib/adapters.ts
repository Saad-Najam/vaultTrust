import { ConnectedSource, Transaction } from "./db";
import { Platform } from "./platforms";

export interface PlatformAdapter {
  connect(uid: string, platform: Platform, authCode?: string): Promise<ConnectedSource>;

  fetchTransactions(
    freelancerId: string,
    sourceId: string,
    platform: Platform
  ): Promise<Transaction[]>;
}

/**
 * Per-platform shape of the generated sandbox history: two inflows a month,
 * each a base amount plus jitter, in the platform's natural currency.
 *
 * Transaction ids are derived from a stable slug + month index so a re-sync
 * overwrites the same records rather than appending duplicates.
 */
interface SandboxProfile {
  slug: string;
  currency: string;
  entries: [
    { base: number; jitter: number; day: number; label: string },
    { base: number; jitter: number; day: number; label: string },
  ];
}

const SANDBOX_PROFILES: Record<Platform, SandboxProfile> = {
  PAYONEER: {
    slug: "pay",
    currency: "USD",
    entries: [
      { base: 800, jitter: 400, day: 5, label: "Upwork Escrow Disbursement" },
      { base: 450, jitter: 200, day: 20, label: "Fiverr Ltd Payout" },
    ],
  },
  BANK_TRANSFER: {
    slug: "bank",
    currency: "PKR",
    entries: [
      { base: 60000, jitter: 20000, day: 10, label: "Habib Bank IBFT Inward" },
      { base: 40000, jitter: 15000, day: 25, label: "SCB Pakistan Salary Inward" },
    ],
  },
  LOCAL_INVOICING: {
    slug: "inv",
    currency: "PKR",
    entries: [
      { base: 30000, jitter: 10000, day: 12, label: "Inv #2908 Tech Solutions" },
      { base: 25000, jitter: 10000, day: 27, label: "Inv #2909 Apex Design Studio" },
    ],
  },
  NAYAPAY: {
    slug: "npy",
    currency: "PKR",
    entries: [
      { base: 35000, jitter: 15000, day: 8, label: "NayaPay Wallet Inflow" },
      { base: 20000, jitter: 10000, day: 22, label: "NayaPay Raast Transfer" },
    ],
  },
  JAZZCASH: {
    slug: "jzc",
    currency: "PKR",
    entries: [
      { base: 28000, jitter: 12000, day: 6, label: "JazzCash Wallet Inflow" },
      { base: 18000, jitter: 9000, day: 19, label: "JazzCash Merchant Settlement" },
    ],
  },
  EASYPAISA: {
    slug: "ezp",
    currency: "PKR",
    entries: [
      { base: 26000, jitter: 11000, day: 9, label: "Easypaisa Wallet Inflow" },
      { base: 16000, jitter: 8000, day: 24, label: "Easypaisa Merchant Payout" },
    ],
  },
};

/**
 * Sandbox Platform Adapter generating realistic 6-month transaction data.
 */
export class SandboxAdapter implements PlatformAdapter {
  async connect(
    uid: string,
    platform: Platform,
    authCode?: string
  ): Promise<ConnectedSource> {
    const id = `${uid}_${platform.toLowerCase()}`;
    return {
      id,
      freelancerId: uid,
      platform,
      status: "CONNECTED",
      connectedAt: new Date().toISOString(),
      provider: "sandbox",
    };
  }

  async fetchTransactions(
    freelancerId: string,
    sourceId: string,
    platform: Platform
  ): Promise<Transaction[]> {
    const profile = SANDBOX_PROFILES[platform];
    if (!profile) return [];

    const transactions: Transaction[] = [];
    const now = new Date();

    const getTxDate = (monthsAgo: number, day: number) =>
      new Date(now.getFullYear(), now.getMonth() - monthsAgo, day).toISOString();

    // 6 months of history, two inflows per month.
    for (let month = 0; month < 6; month++) {
      profile.entries.forEach((entry, idx) => {
        transactions.push({
          id: `tx_sb_${profile.slug}_${month}_${idx + 1}`,
          sourceId,
          freelancerId,
          amount: entry.base + Math.round(Math.random() * entry.jitter),
          currency: profile.currency,
          date: getTxDate(month, entry.day),
          clientLabel: entry.label,
        });
      });
    }

    return transactions;
  }
}

/**
 * Payoneer Live Adapter throwing error if credentials are not configured in environment.
 */
export class PayoneerLiveAdapter implements PlatformAdapter {
  private isConfigured(): boolean {
    return !!(
      process.env.PAYONEER_CLIENT_ID &&
      process.env.PAYONEER_CLIENT_SECRET &&
      process.env.PAYONEER_REDIRECT_URI
    );
  }

  async connect(uid: string, platform: Platform, authCode?: string): Promise<ConnectedSource> {
    if (!this.isConfigured()) {
      throw new Error("NOT_CONFIGURED: Payoneer Live API credentials (PAYONEER_CLIENT_ID/SECRET) are missing in environment.");
    }
    const id = `${uid}_payoneer_live`;
    return {
      id,
      freelancerId: uid,
      platform: "PAYONEER",
      status: "CONNECTED",
      connectedAt: new Date().toISOString(),
      provider: "live",
    };
  }

  async fetchTransactions(
    freelancerId: string,
    sourceId: string,
    platform: Platform
  ): Promise<Transaction[]> {
    if (!this.isConfigured()) {
      throw new Error("NOT_CONFIGURED: Payoneer Live API credentials are missing in environment.");
    }
    // Real OAuth API calls would go here
    return [];
  }
}

/**
 * Upwork Live Adapter throwing error if credentials are not configured in environment.
 */
export class UpworkLiveAdapter implements PlatformAdapter {
  private isConfigured(): boolean {
    return !!(process.env.UPWORK_CLIENT_ID && process.env.UPWORK_CLIENT_SECRET);
  }

  async connect(uid: string, platform: Platform, authCode?: string): Promise<ConnectedSource> {
    if (!this.isConfigured()) {
      throw new Error("NOT_CONFIGURED: Upwork API credentials (UPWORK_CLIENT_ID/SECRET) are missing in environment.");
    }
    const id = `${uid}_upwork_live`;
    return {
      id,
      freelancerId: uid,
      platform,
      status: "CONNECTED",
      connectedAt: new Date().toISOString(),
      provider: "live",
    };
  }

  async fetchTransactions(
    freelancerId: string,
    sourceId: string,
    platform: Platform
  ): Promise<Transaction[]> {
    if (!this.isConfigured()) {
      throw new Error("NOT_CONFIGURED: Upwork API credentials are missing in environment.");
    }
    return [];
  }
}

/**
 * Factory to retrieve the active PlatformAdapter.
 * Automatically chooses sandbox vs live based on whether live environment variables exist.
 */
export function getPlatformAdapter(platform: Platform): PlatformAdapter {
  if (platform === "PAYONEER" && process.env.PAYONEER_CLIENT_ID) {
    return new PayoneerLiveAdapter();
  }
  // Otherwise, default to sandbox adapter
  return new SandboxAdapter();
}
