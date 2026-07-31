"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/NotificationBell";
import { fetchWithAuth } from "@/lib/fetch_client";
import RoleGate from "@/components/RoleGate";
import {
  INCOME_PLATFORMS,
  PLATFORM_META,
  WALLET_PLATFORMS,
  Platform,
  IncomePlatform,
} from "@/lib/platforms";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectedSource {
  id: string;
  freelancerId: string;
  platform: Platform;
  status: "CONNECTED" | "DISCONNECTED";
  connectedAt: string;
  provider: string;
  lastSyncedAt?: string | null;
  transactionCount?: number;
}

interface IncomeScore {
  ivs: number;
  avgMonthlyIncome: number;
  trend: "GROWING" | "STABLE" | "DECLINING";
  sourceDiversityScore: number;
  eligibilityBandPKR: string;
  computedAt: string;
}

type SourceMix = Record<IncomePlatform, number>;

interface CreditCard {
  id: string;
  sourceId: string;
  provider: string;
  last4: string;
  creditLimitPKR: number;
  statementBalancePKR: number;
  minPaymentDuePKR: number;
  statementDate: string;
  lastSyncedAt: string;
}

interface SpendCreditBadge {
  label: string;
  status: "HEALTHY" | "WATCH" | "AT_RISK" | "UNKNOWN";
  detail: string;
}

interface SpendCredit {
  hasCards: boolean;
  cardCount: number;
  totalCreditLimitPKR: number;
  totalStatementBalancePKR: number;
  totalMonthlyObligationPKR: number;
  utilizationPercent: number | null;
  dtiPercent: number | null;
  dtiTier: "LOW" | "MODERATE" | "HIGH";
  netFreeCashFlowPKR: number;
  recommendedCreditLimitPKR: number;
  onTimeRepaymentPercent: number | null;
  badges: {
    utilization: SpendCreditBadge;
    repayment: SpendCreditBadge;
    dti: SpendCreditBadge;
  };
}

interface SummaryData {
  sourceMix: SourceMix | null;
  incomeScore: IncomeScore | null;
  totalTransactions: number;
  distinctClientCount: number;
  creditCards: CreditCard[];
  spendCredit: SpendCredit | null;
}

// ─── Small helper components ──────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-error text-label-sm bg-error-container/30 px-3 py-2 rounded-lg">
      <span className="material-symbols-outlined text-[14px]">error</span>
      <span>{message}</span>
    </div>
  );
}

function TrendBadge({ trend }: { trend: "GROWING" | "STABLE" | "DECLINING" }) {
  const config = {
    GROWING: {
      icon: "trending_up",
      color: "text-primary bg-[#E8F5E9]",
      label: "Growing",
    },
    STABLE: {
      icon: "trending_flat",
      color: "text-secondary bg-secondary-container/30",
      label: "Stable",
    },
    DECLINING: {
      icon: "trending_down",
      color: "text-error bg-error-container/30",
      label: "Declining",
    },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-bold ${config.color}`}
    >
      <span className="material-symbols-outlined text-[14px]">{config.icon}</span>
      {config.label}
    </span>
  );
}

/**
 * Uniform card for the mobile-wallet providers. The three original sources
 * keep their bespoke layouts; every wallet renders from this one component so
 * adding a provider is a registry entry rather than another block of JSX.
 */
function WalletSourceCard({
  platform,
  source,
  connecting,
  disconnecting,
  error,
  onLink,
  onDisconnect,
}: {
  platform: Platform;
  source?: ConnectedSource;
  connecting: boolean;
  disconnecting: boolean;
  error: string;
  onLink: () => void;
  onDisconnect: (sourceId: string) => void;
}) {
  const meta = PLATFORM_META[platform];
  const isConnected = !!source;

  return (
    <div className="md:col-span-12 lg:col-span-4 bg-white rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-surface-container-high flex flex-col gap-stack-md hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${meta.color}1a` }}
        >
          <span
            className="material-symbols-outlined text-2xl"
            style={{ color: meta.color }}
          >
            {meta.icon}
          </span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
            isConnected
              ? "bg-[#E8F5E9] text-primary"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {isConnected ? "Active" : "Inactive"}
        </span>
      </div>

      <div>
        <h4 className="text-headline-sm font-headline-sm mb-1">{meta.label}</h4>
        <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
          {meta.tagline}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-label-sm">
          <span className="text-on-surface-variant">Transactions</span>
          <span className="font-bold">{source?.transactionCount ?? 0} records</span>
        </div>
        <div className="flex justify-between text-label-sm">
          <span className="text-on-surface-variant">Last synced</span>
          <span className="font-bold">{formatRelativeTime(source?.lastSyncedAt)}</span>
        </div>
      </div>

      <div className="mt-auto">
        {isConnected ? (
          <div className="flex gap-2">
            <button
              className="flex-1 py-3 bg-[#E8F5E9] text-primary rounded-xl font-bold flex items-center justify-center gap-2 cursor-default"
              disabled
            >
              Linked
              <span className="material-symbols-outlined text-[18px]">done</span>
            </button>
            <button
              onClick={() => onDisconnect(source!.id)}
              disabled={disconnecting}
              className="px-4 py-3 border-2 border-outline text-on-surface-variant rounded-xl font-bold flex items-center gap-2 hover:border-error hover:text-error transition-colors disabled:opacity-50"
              title={`Disconnect ${meta.label}`}
            >
              {disconnecting ? (
                <Spinner />
              ) : (
                <span className="material-symbols-outlined text-[18px]">link_off</span>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={onLink}
            disabled={connecting}
            className="w-full py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: meta.color }}
          >
            {connecting ? (
              <>
                <Spinner />
                Connecting…
              </>
            ) : (
              <>
                Connect
                <span className="material-symbols-outlined text-[18px]">add</span>
              </>
            )}
          </button>
        )}
        <InlineError message={error} />
      </div>
    </div>
  );
}

function badgeTone(status: SpendCreditBadge["status"]) {
  switch (status) {
    case "HEALTHY":
      return "bg-[#E8F5E9] text-primary";
    case "WATCH":
      return "bg-tertiary-container/25 text-on-tertiary-container";
    case "AT_RISK":
      return "bg-error-container/40 text-on-error-container";
    default:
      return "bg-surface-container-high text-on-surface-variant";
  }
}

function badgeIcon(status: SpendCreditBadge["status"]) {
  switch (status) {
    case "HEALTHY":
      return "check_circle";
    case "WATCH":
      return "warning";
    case "AT_RISK":
      return "error";
    default:
      return "help";
  }
}

const PKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

/**
 * Credit Card & Outflow connector. Distinct from the income cards by design:
 * it reports obligations, so it carries its own accent colour and never feeds
 * the income source mix.
 */
function CreditCardConnector({
  cards,
  spend,
  connecting,
  syncing,
  disconnecting,
  error,
  onLink,
  onSync,
  onDisconnect,
}: {
  cards: CreditCard[];
  spend: SpendCredit | null;
  connecting: boolean;
  syncing: boolean;
  disconnecting: boolean;
  error: string;
  onLink: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const meta = PLATFORM_META.CREDIT_CARD;
  const linked = cards.length > 0;
  const utilisation = spend?.utilizationPercent ?? 0;
  const primary = cards[0];

  return (
    <div className="md:col-span-12 glass-card rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-300">
      {/* Accent wash keeps the outflow card visually separate from earnings */}
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />

      <div className="flex flex-col lg:flex-row lg:items-start gap-stack-lg">
        {/* Identity */}
        <div className="flex items-start gap-4 lg:w-1/3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${meta.color}1a` }}
          >
            <span
              className="material-symbols-outlined text-3xl"
              style={{ color: meta.color }}
            >
              {meta.icon}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-headline-sm font-headline-sm">
                {linked ? primary.provider : "Credit Card & Outflow"}
              </h4>
              <span
                className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  linked
                    ? "bg-[#E8F5E9] text-primary"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {linked ? "Linked" : "Not Linked"}
              </span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              {linked ? `•••• ${primary.last4}` : meta.tagline}
            </p>
            {cards.length > 1 && (
              <p className="text-label-sm text-on-surface-variant mt-1">
                +{cards.length - 1} more card{cards.length > 2 ? "s" : ""} aggregated
              </p>
            )}
          </div>
        </div>

        {/* Limit vs balance + utilisation */}
        <div className="flex-1 space-y-stack-md">
          {linked && spend ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-stack-md">
                <div className="p-stack-md bg-surface-container-low rounded-xl">
                  <p className="text-label-sm text-on-surface-variant mb-1">Credit Limit</p>
                  <p className="text-body-md font-bold text-on-surface">
                    {PKR(spend.totalCreditLimitPKR)}
                  </p>
                </div>
                <div className="p-stack-md bg-surface-container-low rounded-xl">
                  <p className="text-label-sm text-on-surface-variant mb-1">Balance</p>
                  <p className="text-body-md font-bold text-on-surface">
                    {PKR(spend.totalStatementBalancePKR)}
                  </p>
                </div>
                <div className="p-stack-md bg-surface-container-low rounded-xl col-span-2 sm:col-span-1">
                  <p className="text-label-sm text-on-surface-variant mb-1">Min Due / mo</p>
                  <p className="text-body-md font-bold text-on-surface">
                    {PKR(spend.totalMonthlyObligationPKR)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-label-sm mb-1">
                  <span className="font-medium text-on-surface-variant">
                    Utilisation
                  </span>
                  <span className="font-bold" style={{ color: meta.color }}>
                    {utilisation}%
                  </span>
                </div>
                <div
                  className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={utilisation}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Credit utilisation"
                >
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, utilisation)}%`,
                      backgroundColor:
                        utilisation < 30
                          ? "#003127"
                          : utilisation <= 50
                            ? "#735c00"
                            : "#ba1a1a",
                    }}
                  />
                </div>
                <p className="text-label-sm text-on-surface-variant mt-1">
                  Last statement {formatRelativeTime(primary.statementDate)} · under 30% is healthy
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[spend.badges.utilization, spend.badges.repayment, spend.badges.dti].map(
                  (b) => (
                    <span
                      key={b.label}
                      title={b.detail}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-sm font-bold ${badgeTone(b.status)}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {badgeIcon(b.status)}
                      </span>
                      {b.label}
                    </span>
                  )
                )}
              </div>
            </>
          ) : (
            <p className="text-body-md text-on-surface-variant max-w-xl">
              Link a card or upload a statement to track utilisation and
              debt-to-income. Only aggregated ratios are ever shared — never your
              transactions or card number.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="lg:w-auto flex flex-col gap-2 lg:min-w-[190px]">
          {linked ? (
            <>
              <button
                onClick={onSync}
                disabled={syncing}
                className="w-full py-3 px-5 border-2 text-on-surface rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-surface-container transition-all active:scale-95 disabled:opacity-60"
                style={{ borderColor: meta.color, color: meta.color }}
              >
                {syncing ? (
                  <>
                    <Spinner />
                    Syncing…
                  </>
                ) : (
                  <>
                    Sync Statement
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                  </>
                )}
              </button>
              <button
                onClick={onDisconnect}
                disabled={disconnecting}
                className="w-full py-3 px-5 border-2 border-outline text-on-surface-variant rounded-xl font-bold flex items-center justify-center gap-2 hover:border-error hover:text-error transition-colors disabled:opacity-50"
              >
                {disconnecting ? (
                  <Spinner />
                ) : (
                  <>
                    Disconnect
                    <span className="material-symbols-outlined text-[18px]">link_off</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onLink}
              disabled={connecting}
              className="w-full py-3 px-5 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: meta.color }}
            >
              {connecting ? (
                <>
                  <Spinner />
                  Linking…
                </>
              ) : (
                <>
                  Link Credit Card
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <InlineError message={error} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ConnectPage() {
  const router = useRouter();
  const [savingDraft, setSavingDraft] = useState(false);
  const [sources, setSources] = useState<ConnectedSource[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    sourceMix: null,
    incomeScore: null,
    totalTransactions: 0,
    distinctClientCount: 0,
    creditCards: [],
    spendCredit: null,
  });

  // Per-source loading states
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [disconnectingSource, setDisconnectingSource] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Per-source inline error messages keyed by platform
  const [errorBySource, setErrorBySource] = useState<Record<string, string>>({});

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchSources = async () => {
    try {
      const res = await fetchWithAuth("/api/v1/connectors/summary");
      const data = await res.json();
      if (data.success) {
        setSources(data.connectedSources || []);
        setSummaryData({
          sourceMix: data.sourceMix || null,
          incomeScore: data.incomeScore || null,
          totalTransactions: data.totalTransactions || 0,
          distinctClientCount: data.distinctClientCount || 0,
          creditCards: data.creditCards || [],
          spendCredit: data.spendCredit || null,
        });
      }
    } catch (err) {
      console.error("[ConnectPage] fetchSources error:", err);
      }
  };

  useEffect(() => {
    void (async () => {
      await fetchSources();
    })();
  }, []);

  // ── Credit card / outflow handlers ──────────────────────────────────────────

  const [cardBusy, setCardBusy] = useState<null | "link" | "sync" | "remove">(null);

  /** One helper for all three card verbs — they share success/error handling. */
  const callCreditCard = async (
    action: "link" | "sync" | "remove",
    method: "POST" | "PATCH" | "DELETE"
  ) => {
    setCardBusy(action);
    clearError("CREDIT_CARD");
    try {
      const res = await fetchWithAuth("/api/v1/connectors/credit-card", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSources();
      } else {
        const raw = data.error;
        const msg =
          typeof raw === "string"
            ? raw.replace(/^ALREADY_LINKED:\s*/i, "")
            : "Could not update your credit card. Please try again.";
        setErrorBySource((prev) => ({ ...prev, CREDIT_CARD: msg }));
      }
    } catch (err) {
      console.error(`[ConnectPage] credit card ${action} error:`, err);
      setErrorBySource((prev) => ({
        ...prev,
        CREDIT_CARD: "Network error. Please try again.",
      }));
    } finally {
      setCardBusy(null);
    }
  };

  /** Re-pulls transactions from the provider, then refreshes the view. */
  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetchWithAuth("/api/v1/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) {
        setSyncError(
          typeof data.error === "string" ? data.error : "Sync failed. Please try again."
        );
      }
      await fetchSources();
    } catch (err) {
      console.error("[ConnectPage] handleSync error:", err);
      setSyncError("Network error. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const clearError = (platform: string) => {
    setErrorBySource((prev) => ({ ...prev, [platform]: "" }));
  };

  const handleLink = async (platform: string) => {
    setConnectingSource(platform);
    clearError(platform);
    try {
      const res = await fetchWithAuth("/api/v1/connectors/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSources();
      } else {
        const raw = data.error;
        const msg =
          typeof raw === "string"
            ? raw.replace(/^ALREADY_CONNECTED:\s*/i, "")
            : "Linking failed. Please try again.";
        setErrorBySource((prev) => ({ ...prev, [platform]: msg }));
      }
    } catch (err) {
      console.error("[ConnectPage] handleLink error:", err);
      setErrorBySource((prev) => ({
        ...prev,
        [platform]: "Network error. Please try again.",
      }));
    } finally {
      setConnectingSource(null);
    }
  };

  const handleDisconnect = async (sourceId: string, platform: string) => {
    setDisconnectingSource(sourceId);
    clearError(platform);

    // Optimistically hide the connection immediately so the button doesn't
    // appear to do nothing while the request is in flight; revert on failure.
    const previousSources = sources;
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, status: "DISCONNECTED" } : s))
    );

    try {
      const res = await fetchWithAuth("/api/v1/connectors/link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSources();
      } else {
        setSources(previousSources);
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Disconnect failed. Please try again.";
        setErrorBySource((prev) => ({ ...prev, [platform]: msg }));
      }
    } catch (err) {
      console.error("[ConnectPage] handleDisconnect error:", err);
      setSources(previousSources);
      setErrorBySource((prev) => ({
        ...prev,
        [platform]: "Network error. Please try again.",
      }));
    } finally {
      setDisconnectingSource(null);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────────

  /** The CONNECTED source for a platform, if any. */
  const sourceFor = (platform: Platform) =>
    sources.find((s) => s.platform === platform && s.status === "CONNECTED");

  const payoneerSource = sourceFor("PAYONEER");
  const bankSource = sourceFor("BANK_TRANSFER");
  const invoiceSource = sourceFor("LOCAL_INVOICING");

  const isPayoneerConnected = !!payoneerSource;
  const isBankConnected = !!bankSource;
  const isInvoiceConnected = !!invoiceSource;

  const connectedCount = sources.filter((s) => s.status === "CONNECTED").length;
  const hasAnyConnected = connectedCount > 0;

  const { sourceMix, incomeScore } = summaryData;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/*  SideNavBar Shell  */}
      <FreelancerSidebar />

      {/*  TopAppBar Shell  */}
      <header className="flex justify-between items-center w-full pl-16 pr-5 lg:px-margin-desktop h-16 lg:ml-64 lg:max-w-[calc(100%-16rem)] fixed top-0 bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] z-40">
        <div className="flex items-center gap-4">
          <h2 className="text-headline-sm font-headline-sm font-bold text-primary">
            Connected Accounts
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Link href="/profile" title="Verification status" className="hover:bg-surface-container-high rounded-full p-2 text-on-surface-variant">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified
            </span>
          </Link>
          <UserAvatar size="w-10 h-10" showName />
        </div>
      </header>

      {/*  Main Content Canvas  */}
      <main className="lg:ml-64 pt-24 pb-stack-lg px-5 lg:px-margin-desktop min-h-screen animate-fade-in">
        <div className="max-w-container-max mx-auto">

          {/*  Header Section  */}
          <div className="mb-stack-lg">
            <h3 className="text-headline-lg font-headline-lg text-primary mb-2">
              Connect Income Sources
            </h3>
            <p className="text-body-lg text-on-surface-variant max-w-2xl">
              Aggregate your earnings to build a verifiable financial profile.
              Securely link your accounts to simplify loan and rental applications.
            </p>
          </div>

          {/*  Bento-style Grid for Source Cards  */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">

            {/*  Card: Payoneer  */}
            <div className="md:col-span-8 glass-card rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-6">
                {isPayoneerConnected ? (
                  <span className="bg-[#E8F5E9] text-primary px-4 py-1 rounded-full text-label-md flex items-center gap-1 font-bold">
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    Connected
                  </span>
                ) : (
                  <span className="bg-surface-container-high text-on-surface-variant px-4 py-1 rounded-full text-label-md flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    Disconnected
                  </span>
                )}
              </div>
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-outline-variant">
                    <span className="material-symbols-outlined text-primary text-3xl">
                      account_balance_wallet
                    </span>
                  </div>
                  <div>
                    <h4 className="text-headline-sm font-headline-sm">Payoneer</h4>
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Global Payments Account
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-stack-lg mb-12">
                  <div className="p-stack-md bg-surface-container-low rounded-xl">
                    <p className="text-label-sm text-on-surface-variant mb-1">Last Synced</p>
                    <p className="text-body-md font-bold text-on-surface">
                      {formatRelativeTime(payoneerSource?.lastSyncedAt)}
                    </p>
                  </div>
                  <div className="p-stack-md bg-surface-container-low rounded-xl">
                    <p className="text-label-sm text-on-surface-variant mb-1">Total Transactions</p>
                    <p className="text-body-md font-bold text-on-surface">
                      {payoneerSource?.transactionCount ?? 0} Items
                    </p>
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px]">groups</span>
                      {summaryData.distinctClientCount}{" "}
                      {summaryData.distinctClientCount === 1 ? "payer" : "payers"} identified
                    </div>
                    <div className="flex items-center gap-2">
                      {isPayoneerConnected ? (
                        <>
                          <button
                            className="px-8 py-3 bg-[#E8F5E9] text-primary rounded-xl font-bold flex items-center gap-2 cursor-default"
                            disabled
                          >
                            Linked
                            <span className="material-symbols-outlined text-[18px]">done</span>
                          </button>
                          <button
                            onClick={() =>
                              handleDisconnect(payoneerSource!.id, "PAYONEER")
                            }
                            disabled={disconnectingSource === payoneerSource?.id}
                            className="px-4 py-3 border-2 border-outline text-on-surface-variant rounded-xl font-bold flex items-center gap-2 hover:border-error hover:text-error transition-colors disabled:opacity-50"
                            title="Disconnect Payoneer"
                          >
                            {disconnectingSource === payoneerSource?.id ? (
                              <Spinner />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">link_off</span>
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleLink("PAYONEER")}
                          disabled={connectingSource === "PAYONEER"}
                          className="px-8 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-98 transition-all disabled:opacity-60 disabled:scale-100"
                        >
                          {connectingSource === "PAYONEER" ? (
                            <>
                              <Spinner />
                              Connecting…
                            </>
                          ) : (
                            <>
                              Connect
                              <span className="material-symbols-outlined text-[18px]">add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <InlineError message={errorBySource["PAYONEER"] || ""} />
                </div>
              </div>
            </div>

            {/*  Card: UBL Bank Account  */}
            <div className="md:col-span-4 bg-white rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-surface-container-high flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-secondary-container/30 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary text-2xl">
                      account_balance
                    </span>
                  </div>
                  {isBankConnected ? (
                    <span className="bg-[#E8F5E9] text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                      Active
                    </span>
                  ) : (
                    <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                      Inactive
                    </span>
                  )}
                </div>
                <h4 className="text-headline-sm font-headline-sm mb-1">UBL Bank Account</h4>
                <p className="text-body-sm text-on-surface-variant mb-6">
                  {bankSource
                    ? `${PLATFORM_META.BANK_TRANSFER.tagline} · ${bankSource.provider}`
                    : PLATFORM_META.BANK_TRANSFER.tagline}
                </p>
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between text-label-sm">
                    <span className="text-on-surface-variant">Transactions</span>
                    <span className="font-bold">
                      {bankSource?.transactionCount ?? 0} records
                    </span>
                  </div>
                  <div className="flex justify-between text-label-sm">
                    <span className="text-on-surface-variant">Last synced</span>
                    <span className="font-bold">
                      {formatRelativeTime(bankSource?.lastSyncedAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                {isBankConnected ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="flex-1 py-3 border-2 border-secondary text-secondary rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary hover:text-on-secondary transition-all active:scale-95 disabled:opacity-60"
                    >
                      {syncing ? (
                        <>
                          <Spinner />
                          Syncing…
                        </>
                      ) : (
                        <>
                          Sync now
                          <span className="material-symbols-outlined text-[18px] group-hover:rotate-180 transition-transform duration-500">
                            sync
                          </span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        handleDisconnect(bankSource!.id, "BANK_TRANSFER")
                      }
                      disabled={disconnectingSource === bankSource?.id}
                      className="px-4 py-3 border-2 border-outline text-on-surface-variant rounded-xl font-bold flex items-center gap-2 hover:border-error hover:text-error transition-colors disabled:opacity-50"
                      title="Disconnect Bank"
                    >
                      {disconnectingSource === bankSource?.id ? (
                        <Spinner />
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">link_off</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLink("BANK_TRANSFER")}
                    disabled={connectingSource === "BANK_TRANSFER"}
                    className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
                  >
                    {connectingSource === "BANK_TRANSFER" ? (
                      <>
                        <Spinner />
                        Connecting…
                      </>
                    ) : (
                      <>
                        Connect source
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </>
                    )}
                  </button>
                )}
                <InlineError message={syncError || errorBySource["BANK_TRANSFER"] || ""} />
              </div>
            </div>

            {/*  Cards: mobile wallets (NayaPay / JazzCash / Easypaisa)  */}
            {WALLET_PLATFORMS.map((platform) => (
              <WalletSourceCard
                key={platform}
                platform={platform}
                source={sourceFor(platform)}
                connecting={connectingSource === platform}
                disconnecting={disconnectingSource === sourceFor(platform)?.id}
                error={errorBySource[platform] || ""}
                onLink={() => handleLink(platform)}
                onDisconnect={(id) => handleDisconnect(id, platform)}
              />
            ))}

            {/*  Card: Credit Card & Outflow (SpendSmart)  */}
            <CreditCardConnector
              cards={summaryData.creditCards}
              spend={summaryData.spendCredit}
              connecting={cardBusy === "link"}
              syncing={cardBusy === "sync"}
              disconnecting={cardBusy === "remove"}
              error={errorBySource["CREDIT_CARD"] || ""}
              onLink={() => callCreditCard("link", "POST")}
              onSync={() => callCreditCard("sync", "PATCH")}
              onDisconnect={() => callCreditCard("remove", "DELETE")}
            />

            {/*  Card: Local Invoicing  */}
            <div className="md:col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border-2 border-dashed border-outline-variant flex items-center gap-stack-lg group hover:border-primary/50 transition-colors">
              <div className="w-20 h-20 bg-surface-container flex-shrink-0 rounded-2xl flex items-center justify-center group-hover:bg-primary-container/10 transition-colors">
                <span className="material-symbols-outlined text-primary text-4xl group-hover:scale-110 transition-transform">
                  cloud_upload
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-headline-sm font-headline-sm mb-1">Local Invoicing</h4>
                <p className="text-body-md text-on-surface-variant mb-4">
                  Upload PDF invoices or link local billing software to include
                  non-platform earnings.
                </p>
                {isInvoiceConnected ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#E8F5E9] text-primary text-label-md font-bold">
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      Connected
                    </span>
                    <button
                      onClick={() =>
                        handleDisconnect(invoiceSource!.id, "LOCAL_INVOICING")
                      }
                      disabled={disconnectingSource === invoiceSource?.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-outline text-on-surface-variant text-label-md font-bold hover:border-error hover:text-error transition-colors disabled:opacity-50"
                    >
                      {disconnectingSource === invoiceSource?.id ? (
                        <Spinner />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">link_off</span>
                          Disconnect
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLink("LOCAL_INVOICING")}
                    disabled={connectingSource === "LOCAL_INVOICING"}
                    className="px-6 py-2 bg-secondary text-on-secondary rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
                  >
                    {connectingSource === "LOCAL_INVOICING" ? (
                      <>
                        <Spinner />
                        Connecting…
                      </>
                    ) : (
                      <>
                        Connect source
                        <span className="material-symbols-outlined">add</span>
                      </>
                    )}
                  </button>
                )}
                <InlineError message={errorBySource["LOCAL_INVOICING"] || ""} />
              </div>
            </div>

            {/*  Secure Data Notice  */}
            <div className="md:col-span-12 lg:col-span-6 bg-primary-container text-on-primary-container p-stack-lg rounded-[24px] flex items-center gap-6 relative overflow-hidden">
              {/*  Subtle pattern overlay  */}
              <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div className="w-16 h-16 bg-on-primary-container/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield_lock
                </span>
              </div>
              <div>
                <p className="text-label-md font-bold mb-1 flex items-center gap-2">
                  Data Stewardship
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ color: "#D4AF37" }}
                  >
                    verified
                  </span>
                </p>
                <p className="text-body-md leading-relaxed">
                  VaultTrust processes your data securely and only shares the
                  summary you approve. Your raw bank credentials are never stored
                  or shared with third parties.
                </p>
              </div>
            </div>

            {/*  IVS Score + Source Mix Panel (only visible when >= 1 source connected)  */}
            {hasAnyConnected && (
              <div className="md:col-span-12 bg-white rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-primary-container/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-container/30 rounded-xl flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      analytics
                    </span>
                  </div>
                  <div>
                    <h4 className="text-headline-sm font-headline-sm text-primary">
                      Income Verification Score
                    </h4>
                    <p className="text-label-sm text-on-surface-variant">
                      Recomputed live after each source connection
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/*  IVS Gauge  */}
                  {incomeScore ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-end gap-4">
                        <div className="text-[56px] font-bold text-primary leading-none">
                          {incomeScore.ivs}
                        </div>
                        <div className="pb-2">
                          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                            out of 100
                          </p>
                          <TrendBadge trend={incomeScore.trend} />
                        </div>
                      </div>
                      {/*  IVS bar  */}
                      <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-primary transition-all duration-700"
                          style={{ width: `${incomeScore.ivs}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <div className="bg-surface-container-low rounded-xl p-3">
                          <p className="text-label-sm text-on-surface-variant mb-0.5">
                            Avg Monthly Income
                          </p>
                          <p className="text-body-md font-bold text-on-surface">
                            PKR {incomeScore.avgMonthlyIncome.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-surface-container-low rounded-xl p-3">
                          <p className="text-label-sm text-on-surface-variant mb-0.5">
                            Eligibility Band
                          </p>
                          <p className="text-body-sm font-bold text-on-surface leading-tight">
                            {incomeScore.eligibilityBandPKR}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-on-surface-variant text-body-md">
                      <span className="material-symbols-outlined mr-2">hourglass_empty</span>
                      Score computing…
                    </div>
                  )}

                  {/*  Source Mix  */}
                  {sourceMix && (
                    <div className="flex flex-col gap-4">
                      <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
                        Income Source Mix (6-month, PKR)
                      </p>
                      {INCOME_PLATFORMS.map((platform) => {
                        const meta = PLATFORM_META[platform];
                        const percent = sourceMix[platform] ?? 0;
                        return (
                          <div key={platform}>
                            <div className="flex justify-between text-label-sm mb-1">
                              <span className="flex items-center gap-1.5 font-medium">
                                <span
                                  className="material-symbols-outlined text-[14px]"
                                  style={{ color: meta.color }}
                                >
                                  {meta.icon}
                                </span>
                                {meta.label}
                              </span>
                              <span className="font-bold" style={{ color: meta.color }}>
                                {percent}%
                              </span>
                            </div>
                            <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                              <div
                                className="h-2.5 rounded-full transition-all duration-700"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: meta.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-label-sm text-on-surface-variant mt-1">
                        All amounts normalized to PKR using fixed FX rates
                        (USD×280, EUR×300).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/*  Primary Action Footer  */}
          <div className="mt-stack-lg flex flex-col md:flex-row items-center justify-between bg-white p-8 rounded-[24px] shadow-[0px_4px_32px_rgba(0,74,59,0.08)] border border-primary-container/10">
            <div className="mb-4 md:mb-0">
              <p className="text-headline-sm font-headline-sm text-primary">
                Summary Ready
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {connectedCount} source{connectedCount !== 1 ? "s" : ""} connected
                {summaryData.totalTransactions > 0
                  ? ` · ${summaryData.totalTransactions} transactions analyzed`
                  : ""}
              </p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button
                onClick={() => {
                  // Each connector link already persisted immediately via
                  // /api/v1/connectors/link — there's no separate draft state
                  // to save, so this just confirms that and returns home.
                  setSavingDraft(true);
                  router.push("/dashboard");
                }}
                disabled={savingDraft}
                className="flex-1 md:flex-initial px-8 py-4 border-2 border-outline text-on-surface rounded-xl font-bold hover:bg-surface-container transition-all disabled:opacity-60"
              >
                {savingDraft ? "Saved — returning to dashboard..." : "Save Draft"}
              </button>
              <Link href="/consent/setup" className="flex-grow md:flex-none">
                <button className="w-full px-10 py-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 transition-all">
                  Continue to Consent Setup
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </Link>
            </div>
          </div>

          {/*  Spacer for visual breathing room  */}
          <div className="h-16" />
        </div>
      </main>

      {/*  Interactive background element for Glassmorphism effect depth  */}
      <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px] pointer-events-none z-0" />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default function Page() {
  return (
    <RoleGate allow="FREELANCER">
      <ConnectPage />
    </RoleGate>
  );
}
