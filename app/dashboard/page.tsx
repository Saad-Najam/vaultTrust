"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import BankSidebar from "@/components/BankSidebar";
import UserAvatar from "@/components/UserAvatar";
import { normalizeAmountToPKR } from "@/lib/scoring";
import { fetchWithAuth } from "@/lib/fetch_client";
import { useCurrentUser } from "@/lib/use_current_user";
import { INCOME_PLATFORMS, PLATFORM_META } from "@/lib/platforms";
import { toCsvRow, downloadTextFile } from "@/lib/download";
import NotificationBell from "@/components/NotificationBell";
import type { Consent, ReliabilityResponse, SummaryResponse } from "@/lib/api_types";
import type { IncomePlatform } from "@/lib/platforms";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

const PKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

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
  verifiedMonthlyIncomePKR: number;
  netFreeCashFlowPKR: number;
  recommendedCreditLimitPKR: number;
  onTimeRepaymentPercent: number | null;
  badges: {
    utilization: SpendCreditBadge;
    repayment: SpendCreditBadge;
    dti: SpendCreditBadge;
  };
}

interface Eligibility {
  tier: "MICRO" | "CLASSIC" | "GOLD" | "PLATINUM";
  label: string;
  maxLimitPKR: number;
  baseTier: "MICRO" | "CLASSIC" | "GOLD" | "PLATINUM";
  disclosure: "SHARED" | "DECLARED_NONE" | "NOT_SHARED";
  capped: boolean;
  capReason: string | null;
  tierIfDisclosed: "MICRO" | "CLASSIC" | "GOLD" | "PLATINUM" | null;
  selfAttested: boolean;
  notes: string[];
}

const DTI_TIER_STYLE: Record<
  SpendCredit["dtiTier"],
  { color: string; label: string }
> = {
  LOW: { color: "#003127", label: "Low risk" },
  MODERATE: { color: "#735c00", label: "Moderate risk" },
  HIGH: { color: "#ba1a1a", label: "High risk" },
};

/**
 * Semi-circular DTI gauge. The arc is a stroke-dash fraction of a half circle,
 * so it animates from the same geometry the IVS gauge uses elsewhere.
 */
function DtiGauge({ percent, tier }: { percent: number | null; tier: SpendCredit["dtiTier"] }) {
  const ARC = 251.2; // half-circumference of r=80, matching the profile gauge
  // Anything at or above 60% pins the needle; beyond that the bar stops being
  // informative and the tier label carries the message.
  const filled = percent === null ? 0 : Math.min(percent, 60) / 60;
  const style = DTI_TIER_STYLE[tier];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24">
        <svg className="w-full h-full" viewBox="0 0 200 100" aria-hidden="true">
          <path
            className="stroke-surface-container-highest"
            d="M20,90 A80,80 0 0,1 180,90"
            fill="none"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M20,90 A80,80 0 0,1 180,90"
            fill="none"
            stroke={style.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={ARC}
            strokeDashoffset={ARC - ARC * filled}
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-headline-lg font-headline-lg" style={{ color: style.color }}>
            {percent === null ? "—" : `${percent}%`}
          </span>
          <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest">
            DTI Ratio
          </span>
        </div>
      </div>
      <span
        className="mt-2 px-3 py-1 rounded-full text-label-sm font-bold"
        style={{ backgroundColor: `${style.color}1a`, color: style.color }}
      >
        {style.label}
      </span>
    </div>
  );
}

/**
 * Spend & Credit Health — sits beside the IVS and answers the complementary
 * question: how much of the verified income is already committed to debt.
 */
function SpendCreditWidget({
  spend,
  eligibility,
  loading,
}: {
  spend: SpendCredit | null;
  eligibility: Eligibility | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-56 bg-surface-container-high rounded" />
          <div className="h-24 bg-surface-container-high rounded-xl" />
        </div>
      </section>
    );
  }

  // No card linked is a normal state, not an error — invite the action instead
  // of rendering an empty gauge.
  if (!spend || !spend.hasCards) {
    return (
      <section className="bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${PLATFORM_META.CREDIT_CARD.color}1a` }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: PLATFORM_META.CREDIT_CARD.color }}
            >
              credit_card
            </span>
          </div>
          <div>
            <h4 className="text-headline-sm font-headline-sm text-primary">
              Spend &amp; Credit Health
            </h4>
            <p className="text-body-sm text-on-surface-variant max-w-lg mt-1">
              Link a credit card to see your debt-to-income ratio, free cash flow
              and pre-approved offers from partner banks.
            </p>
            {eligibility?.disclosure === "NOT_SHARED" ? (
              <p className="text-body-sm text-error mt-2 font-medium">
                Debt disclosure is currently withheld, so lenders can only offer
                you the entry tier
                {eligibility.tierIfDisclosed
                  ? ` — sharing it could unlock ${eligibility.tierIfDisclosed}.`
                  : "."}
              </p>
            ) : (
              <p className="text-body-sm text-on-surface-variant mt-2">
                Banks weigh undisclosed obligations as risk. Sharing a clean
                debt position typically raises your approved limit.
              </p>
            )}
          </div>
        </div>
        <Link href="/connect" className="flex-shrink-0">
          <button className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all">
            Link a card
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </Link>
      </section>
    );
  }

  const negative = spend.netFreeCashFlowPKR < 0;
  const offered = spend.recommendedCreditLimitPKR > 0;

  return (
    <section className="bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h4 className="text-headline-sm font-headline-sm text-primary">
            Spend &amp; Credit Health
          </h4>
          <p className="text-body-sm text-on-surface-variant">
            Across {spend.cardCount} linked card{spend.cardCount === 1 ? "" : "s"} ·
            measured against verified income
          </p>
          {eligibility && (
            <p className="text-label-sm mt-2 inline-flex items-center gap-1.5 font-bold">
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ color: eligibility.capped ? "#ba1a1a" : "#003127" }}
              >
                {eligibility.capped ? "trending_down" : "verified"}
              </span>
              <span style={{ color: eligibility.capped ? "#ba1a1a" : "#003127" }}>
                Lending tier: {eligibility.tier}
                {eligibility.capped ? ` (reduced from ${eligibility.baseTier})` : ""}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[spend.badges.utilization, spend.badges.repayment, spend.badges.dti].map((b) => (
            <span
              key={b.label}
              title={b.detail}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-sm font-bold ${
                b.status === "HEALTHY"
                  ? "bg-[#E8F5E9] text-primary"
                  : b.status === "WATCH"
                    ? "bg-tertiary-container/25 text-on-tertiary-container"
                    : b.status === "AT_RISK"
                      ? "bg-error-container/40 text-on-error-container"
                      : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {b.status === "HEALTHY"
                  ? "check_circle"
                  : b.status === "WATCH"
                    ? "warning"
                    : b.status === "AT_RISK"
                      ? "error"
                      : "help"}
              </span>
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        {/* Net free cash flow */}
        <div className="space-y-4">
          <div>
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
              Net Free Cash Flow
            </p>
            <h3
              className="text-headline-lg font-headline-lg"
              style={{ color: negative ? "#ba1a1a" : "#003127" }}
            >
              {PKR(spend.netFreeCashFlowPKR)}
            </h3>
            <p className="text-label-sm text-on-surface-variant mt-1">
              per month, after card obligations
            </p>
          </div>
          <div className="space-y-2 pt-4 border-t border-outline-variant/20">
            <div className="flex justify-between text-label-sm">
              <span className="text-on-surface-variant">Verified income</span>
              <span className="font-bold">{PKR(spend.verifiedMonthlyIncomePKR)}</span>
            </div>
            <div className="flex justify-between text-label-sm">
              <span className="text-on-surface-variant">Card obligations</span>
              <span className="font-bold">−{PKR(spend.totalMonthlyObligationPKR)}</span>
            </div>
            <div className="flex justify-between text-label-sm">
              <span className="text-on-surface-variant">Utilisation</span>
              <span className="font-bold">
                {spend.utilizationPercent === null ? "—" : `${spend.utilizationPercent}%`}
              </span>
            </div>
          </div>
        </div>

        {/* DTI gauge */}
        <div className="flex justify-center">
          <DtiGauge percent={spend.dtiPercent} tier={spend.dtiTier} />
        </div>

        {/* Pre-approved offer */}
        <div
          className={`rounded-[24px] p-6 relative overflow-hidden ${
            offered
              ? "bg-primary-container text-on-primary"
              : "bg-surface-container border border-outline-variant/30"
          }`}
        >
          {offered ? (
            <>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ color: "#D4AF37" }}
                  >
                    verified
                  </span>
                  <span className="text-label-sm font-bold uppercase tracking-widest">
                    Pre-Approved
                  </span>
                </div>
                <p className="text-headline-md font-headline-md mb-1">
                  {PKR(spend.recommendedCreditLimitPKR)}
                </p>
                <p className="text-body-sm opacity-90">
                  {eligibility ? `${eligibility.tier} tier · ` : ""}based on{" "}
                  {PKR(spend.netFreeCashFlowPKR)} monthly free cash flow.
                </p>
                {eligibility?.capped && eligibility.capReason && (
                  <p className="text-body-sm mt-2 px-3 py-2 rounded-lg bg-on-primary-container/15">
                    {eligibility.capReason}
                  </p>
                )}
                <Link href="/consent/setup">
                  <button className="mt-4 w-full py-2.5 bg-on-primary-container/15 hover:bg-on-primary-container/25 rounded-lg font-bold text-label-md transition-colors flex items-center justify-center gap-2">
                    Share &amp; apply
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </Link>
              </div>
              <div className="absolute -bottom-5 -right-4 opacity-15 pointer-events-none">
                <span className="material-symbols-outlined text-[90px]">credit_score</span>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span className="text-label-sm font-bold uppercase tracking-widest">
                  No offer yet
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                {eligibility?.disclosure === "NOT_SHARED"
                  ? "Debt disclosure is withheld from lenders, so only the entry tier is available regardless of your income score."
                  : negative
                    ? "Your card obligations currently exceed verified income, so no limit is recommended. Reducing utilisation will unlock an offer."
                    : "Connect more income sources to establish free cash flow and unlock a pre-approved limit."}
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-on-surface-variant italic mt-6">
        Indicative only. Banks see aggregated ratios and badges — never your card
        number or individual transactions. Final approval remains with the lender.
      </p>
    </section>
  );
}

function FreelancerDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResponse | null>(null);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const { photoURL } = useCurrentUser();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [summaryRes, reliabilityRes, consentRes] = await Promise.all([
          fetchWithAuth("/api/v1/connectors/summary"),
          fetchWithAuth("/api/v1/profile/reliability"),
          fetchWithAuth("/api/v1/consent/active"),
        ]);
        const summaryData = await summaryRes.json();
        const reliabilityData = await reliabilityRes.json();
        const consentData = await consentRes.json();

        if (summaryData.success) setSummary(summaryData);
        if (reliabilityData.success) setReliability(reliabilityData);
        if (consentData.success) setConsent(consentData.consent);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const monthlyAggregates = summary?.monthlyAggregates || [];
  const maxTotal = Math.max(...monthlyAggregates.map((m) => m.totalPKR), 1);
  const connectedSourcesCount = summary?.connectedSources?.filter((s) => s.status === "CONNECTED").length || 0;

  // Only chart/legend the platforms this freelancer actually earned through,
  // so the legend doesn't list six providers for someone using two.
  const activePlatforms = INCOME_PLATFORMS.filter((p) =>
    monthlyAggregates.some((m) => (m.byPlatform?.[p] || 0) > 0)
  );
  const sourceMix: Partial<Record<IncomePlatform, number>> = summary?.sourceMix || {};
  // Prefer the reliability payload: its DTI is measured against the same income
  // figure shown in this page's header, so the two can never disagree.
  const spendCredit: SpendCredit | null =
    reliability?.spendCredit || summary?.spendCredit || null;
  const eligibility: Eligibility | null = reliability?.eligibility || null;

  // Cumulative arc offsets for the source-mix doughnut, computed without
  // mutating a running total during render.
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * 80;
  const donutSegments = activePlatforms.map((platform, i) => {
    const arc = ((sourceMix[platform] || 0) / 100) * DONUT_CIRCUMFERENCE;
    const offset = activePlatforms
      .slice(0, i)
      .reduce((sum, p) => sum + ((sourceMix[p] || 0) / 100) * DONUT_CIRCUMFERENCE, 0);
    return { platform, arc, rest: DONUT_CIRCUMFERENCE - arc, offset };
  });

  const handleExportStatement = () => {
    const rows: string[] = [toCsvRow(["Field", "Value"])];
    rows.push(toCsvRow(["Freelancer", reliability?.userName || ""]));
    rows.push(toCsvRow(["Verified Monthly Income (PKR)", Math.round(reliability?.scores?.avgMonthlyIncome || 0)]));
    rows.push(toCsvRow(["Verification Score (IVS)", reliability?.scores?.ivs ?? ""]));
    rows.push(toCsvRow(["Income Trend", reliability?.scores?.trend || ""]));
    rows.push(toCsvRow(["Active Consent", consent ? "UBL Bank" : "None"]));
    if (consent) {
      rows.push(toCsvRow(["Consent Duration", consent.duration === "ROLLING_6MO" ? "6 mo. rolling" : "One-time"]));
    }
    rows.push(toCsvRow([]));
    rows.push(toCsvRow(["Income Source", "Share of Income (%)"]));
    activePlatforms.forEach((p) => {
      rows.push(toCsvRow([PLATFORM_META[p]?.label || p, Math.round(sourceMix[p] || 0)]));
    });
    if (spendCredit?.hasCards) {
      rows.push(toCsvRow([]));
      rows.push(toCsvRow(["Credit Utilization (%)", spendCredit.utilizationPercent ?? ""]));
      rows.push(toCsvRow(["Debt-to-Income (%)", spendCredit.dtiPercent ?? ""]));
      rows.push(toCsvRow(["Recommended Credit Limit (PKR)", Math.round(spendCredit.recommendedCreditLimitPKR || 0)]));
    }
    if (eligibility) {
      rows.push(toCsvRow([]));
      rows.push(toCsvRow(["Lending Tier", eligibility.label]));
      rows.push(toCsvRow(["Max Limit (PKR)", Math.round(eligibility.maxLimitPKR || 0)]));
    }
    downloadTextFile(
      `vaulttrust-statement-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.join("\n")
    );
  };

  const handleShareProfile = async () => {
    const shareText = `My VaultTrust verification score is ${reliability?.scores?.ivs ?? "—"}/100, with verified monthly income of PKR ${Math.round(
      reliability?.scores?.avgMonthlyIncome || 0
    ).toLocaleString()}.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "VaultTrust Verification", text: shareText });
        return;
      } catch {
        // User cancelled the native share sheet — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch {
      // Clipboard API unavailable — nothing further to do silently.
    }
  };

  return (
    <>
      <FreelancerSidebar />
      {/*  TopAppBar Component  */}
      <header className="flex justify-between items-center w-full pl-16 pr-5 lg:px-margin-desktop h-16 lg:ml-64 lg:max-w-[calc(100%-16rem)] fixed top-0 bg-surface-container-lowest dark:bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] z-40">
      <div className="flex items-center gap-4">
      <span className="text-headline-sm font-headline-sm font-bold text-primary dark:text-primary-fixed">VaultTrust</span>
      </div>
      <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
      <NotificationBell />
      <Link href="/profile" title="Verification status" className="hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-full p-2 transition-opacity active:opacity-80">
      <span className="material-symbols-outlined text-on-surface-variant" data-icon="verified">verified</span>
      </Link>
      </div>
      <div className="h-8 w-[1px] bg-outline-variant"></div>
      <Link href="/settings" title="Edit profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
      <div className="text-right hidden sm:block">
      <p className="text-label-md font-label-md text-on-surface">{reliability?.userName || "Freelancer"}</p>
      <p className="text-label-sm font-label-sm text-on-surface-variant">Verified Freelancer</p>
      </div>
      <div className="w-10 h-10 rounded-full border-2 border-primary-fixed-dim overflow-hidden bg-primary-container flex items-center justify-center flex-shrink-0">
      {photoURL ? (
        <img className="w-full h-full object-cover" src={photoURL} alt={reliability?.userName || "Profile photo"} />
      ) : (
        <span className="text-on-primary-container font-bold text-label-sm">{getInitials(reliability?.userName || "Freelancer")}</span>
      )}
      </div>
      </Link>
      </div>
      </header>
      {/*  Main Content Canvas  */}
      <main className="lg:ml-64 mt-16 p-5 lg:p-stack-lg min-h-screen animate-fade-in">
      <div className="max-w-container-max mx-auto space-y-8">
      {/*  Welcome Header  */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
      <h2 className="text-headline-lg font-headline-lg text-primary">Good morning, {reliability?.userName?.split(" ")[0] || "Freelancer"}</h2>
      <p className="text-body-lg text-on-surface-variant">Here is your verified financial health and consent status for today.</p>
      </div>
      <div className="flex gap-3">
      <button onClick={handleExportStatement} className="flex items-center gap-2 px-6 py-3 border border-outline text-primary rounded-full font-bold hover:bg-surface-container transition-all">
      <span className="material-symbols-outlined" data-icon="download">download</span>
                              Export Statement
                           </button>
      <button onClick={handleShareProfile} className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold hover:shadow-xl transition-all">
      <span className="material-symbols-outlined" data-icon={shareState === "copied" ? "check" : "share"}>{shareState === "copied" ? "check" : "share"}</span>
                              {shareState === "copied" ? "Copied!" : "Share Profile"}
                           </button>
      </div>
      </section>
      {/*  KPI Bento Grid  */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/*  KPI 1  */}
      <div className="bg-surface-container-lowest p-6 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between hover:translate-y-[-4px] transition-transform">
      <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-primary-fixed rounded-xl text-primary">
      <span className="material-symbols-outlined" data-icon="account_balance_wallet">account_balance_wallet</span>
      </div>
      <span className="text-primary font-bold text-label-sm flex items-center gap-1">
      <span className="material-symbols-outlined text-[16px]" data-icon="trending_up">trending_up</span>
                                  +12%
                               </span>
      </div>
      <div>
      <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Verified Monthly Income</p>
      <h3 className="text-headline-md font-headline-md mt-1">
        PKR {reliability?.scores?.avgMonthlyIncome?.toLocaleString() || "0"}
      </h3>
      </div>
      </div>
      {/*  KPI 2  */}
      <div className="bg-surface-container-lowest p-6 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between hover:translate-y-[-4px] transition-transform">
      <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-secondary-fixed rounded-xl text-secondary">
      <span className="material-symbols-outlined" data-icon="verified">verified</span>
      </div>
      <div className="bg-primary-container/10 px-3 py-1 rounded-full">
      <span className="text-primary font-bold text-label-sm">
        {reliability?.scores?.trend || "STABLE"}
      </span>
      </div>
      </div>
      <div>
      <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Verification Score</p>
      <div className="flex items-end gap-2 mt-1">
      <h3 className="text-headline-md font-headline-md">{reliability?.scores?.ivs || "0"}</h3>
      <span className="text-body-sm text-on-surface-variant mb-1.5">/ 100</span>
      </div>
      </div>
      </div>
      {/*  KPI 3  */}
      <div className="bg-surface-container-lowest p-6 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between hover:translate-y-[-4px] transition-transform relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-tertiary-fixed rounded-xl text-tertiary">
      <span className="material-symbols-outlined" data-icon="lock_clock">lock_clock</span>
      </div>
      </div>
      <div>
      <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Active Consent</p>
      <h3 className="text-headline-sm font-headline-sm mt-1">
        {consent ? "UBL Bank" : "No Active Consent"}
      </h3>
      <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
      <div className="h-full bg-tertiary-container" style={{ width: consent ? "100%" : "0%" }}></div>
      </div>
      <span className="text-label-sm font-label-sm">
        {consent ? (consent.duration === "ROLLING_6MO" ? "6 mo. rolling" : "One-time") : "Not shared"}
      </span>
      </div>
      </div>
      </div>
      {/*  KPI 4 (Asymmetric Profile Card)  */}
      <div className="bg-primary-container text-on-primary p-6 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.08)] flex flex-col justify-between hover:translate-y-[-4px] transition-transform">
      <p className="text-label-md text-on-primary-container uppercase tracking-wider">Financial Posture</p>
      <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary-fixed" data-icon="check_circle">check_circle</span>
      <span className="text-body-sm">Stable income</span>
      </div>
      <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary-fixed" data-icon="check_circle">check_circle</span>
      <span className="text-body-sm">Strong diversity</span>
      </div>
      <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary-fixed" data-icon="check_circle">check_circle</span>
      <span className="text-body-sm">Low client concentration</span>
      </div>
      </div>
      </div>
      </section>
      {/*  Analytics Section  */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/*  Stacked Bar Chart Card  */}
      <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-8">
      <div>
      <h4 className="text-headline-sm font-headline-sm text-primary">Income Stream Analysis</h4>
      <p className="text-body-sm text-on-surface-variant">Last 6 months comparison</p>
      </div>
      <div className="flex items-center gap-3 text-label-sm flex-wrap justify-end">
      {activePlatforms.map((platform) => (
        <div key={platform} className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_META[platform].color }}></span>
        {PLATFORM_META[platform].label}
        </div>
      ))}
      </div>
      </div>
      <div className="h-64 flex items-end justify-between gap-4 group">
      {monthlyAggregates.map((month, idx: number) => {
        const isCurrent = idx === 5;
        const total = month.totalPKR;
        const heightPercent = Math.max(10, Math.round((total / maxTotal) * 100));
        
        const byPlatform = month.byPlatform || {};

        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <div
              className="w-full flex flex-col-reverse gap-0.5"
              style={{ height: `${heightPercent}%` }}
            >
              {INCOME_PLATFORMS.map((platform, pIdx) => {
                const amount = byPlatform[platform] || 0;
                if (amount <= 0) return null;
                const meta = PLATFORM_META[platform];
                return (
                  <div
                    key={platform}
                    className={`rounded-sm hover:opacity-80 transition-all cursor-pointer ${
                      isCurrent && pIdx === 0 ? "rounded-t shadow-lg" : ""
                    }`}
                    style={{
                      height: `${(amount / total) * 100}%`,
                      backgroundColor: meta.color,
                    }}
                    title={`${meta.label}: PKR ${Math.round(amount).toLocaleString()}`}
                  ></div>
                );
              })}
            </div>
            <span className={`text-label-sm ${isCurrent ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>
              {month.monthLabel}
            </span>
          </div>
        );
      })}
      </div>
      </div>
      {/*  Source Doughnut Card  */}
      <div className="bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col">
      <h4 className="text-headline-sm font-headline-sm text-primary mb-2">Source Mix</h4>
      <p className="text-body-sm text-on-surface-variant mb-6">Revenue distribution by channel</p>
      <div className="relative flex-1 flex items-center justify-center">
      {/*  Custom SVG Doughnut  */}
      <svg className="w-48 h-48 transform -rotate-90">
      <circle cx="96" cy="96" fill="transparent" r="80" stroke="#ebeef3" strokeWidth="18"></circle>
      {donutSegments.map((seg) => (
        <circle
          key={seg.platform}
          className="transition-all duration-1000"
          cx="96"
          cy="96"
          fill="transparent"
          r="80"
          stroke={PLATFORM_META[seg.platform].color}
          strokeDasharray={`${seg.arc} ${seg.rest}`}
          strokeDashoffset={-seg.offset}
          strokeWidth="18"
        ></circle>
      ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <span className="text-headline-md font-headline-md">{connectedSourcesCount}</span>
      <span className="text-label-sm text-on-surface-variant uppercase">Major Channels</span>
      </div>
      </div>
      <div className="mt-8 space-y-3">
      {activePlatforms.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant text-center">
        Connect an income source to see your mix.
        </p>
      ) : (
        activePlatforms.map((platform) => (
          <div key={platform} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_META[platform].color }}></span>
          <span className="text-body-sm">{PLATFORM_META[platform].label}</span>
          </div>
          <span className="text-label-md font-bold">{sourceMix[platform] || 0}%</span>
          </div>
        ))
      )}
      </div>
      </div>
      </section>
      {/*  SpendSmart: Spend & Credit Health  */}
      <SpendCreditWidget spend={spendCredit} eligibility={eligibility} loading={loading} />
      {/*  Activity & Ledger Section  */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/*  Activity Feed  */}
      <div className="bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-6">
      <h4 className="text-headline-sm font-headline-sm text-primary">Recent Transactions</h4>
      <Link href="/profile" className="text-primary text-label-md font-bold hover:underline">View All</Link>
      </div>
      <div className="space-y-6">
      {(summary?.recentTransactions || []).slice(0, 3).map((tx) => (
        <div key={tx.id} className="flex gap-4">
          <div className="mt-1 w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              {tx.sourceId.includes("payoneer") ? "payments" : tx.sourceId.includes("bank") ? "account_balance" : "description"}
            </span>
          </div>
          <div>
            <p className="text-body-md font-bold">{tx.clientLabel}</p>
            <p className="text-body-sm text-on-surface-variant font-medium">
              Received {tx.currency} {tx.amount.toLocaleString()} ({Math.round(normalizeAmountToPKR(tx.amount, tx.currency)).toLocaleString()} PKR equivalent)
            </p>
            <p className="text-label-sm text-outline mt-1">{new Date(tx.date).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
      {(!summary || !summary.recentTransactions || summary.recentTransactions.length === 0) && (
        <p className="text-body-md text-on-surface-variant italic">No recent activity. Connect a source to view transactions.</p>
      )}
      </div>
      </div>
      {/*  Ledger & Verification CTA  */}
      <div className="relative rounded-[24px] overflow-hidden group cursor-pointer shadow-lg">
      <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700" data-alt="A sophisticated abstract technological background with subtle data pathways and node connections in deep forest green and teal, with a professional corporate lighting aesthetic." style={{"backgroundImage":"url('https://lh3.googleusercontent.com/aida-public/AB6AXuBlyCOLiJx0135hSdM1T7hYQDi1OqudzRn0XxBJ-tNp03Cavhge5YUWDXe_ARlvg8PwVuIZEdVczU5rG7ha8qKxjbPF6LrFJjDpiEWGHpK9G-998ue294BXat6KOmW0VaCMVJSsXQTxBYlxPut1HwWnOF2Gx0iUlzMk461RMp1Vc7Q2b_M1DtvLXEBu9BXRRKqPVX4fAgtz0gJ81FrfYr_-SGLNBFllFZpSObvDddVi2a1EkJarPmLnTg')"}}></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary/80 to-transparent"></div>
      <div className="relative h-full p-10 flex flex-col justify-end text-on-primary">
      <span className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-6">
      <span className="material-symbols-outlined text-white" data-icon="shield_with_heart">shield_with_heart</span>
      </span>
      <h4 className="text-headline-md font-headline-md mb-2">Institutional-Grade Identity</h4>
      <p className="text-body-lg text-primary-fixed mb-8 max-w-md">Your income profile is protected by multi-signature ledger technology and bank-grade encryption.</p>
      <div className="flex">
      <Link href="/profile">
        <button className="bg-white text-primary px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-primary-fixed transition-colors">
                                        View trust profile
                                        <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
        </button>
      </Link>
      </div>
      </div>
      </div>
      </section>
      </div>
      </main>
      {/*  Micro-interaction Scripts  */}
    </>
  );
}

function BankInsightsPlaceholder() {
  return (
    <>
      <BankSidebar />
      <main className="ml-72 min-h-screen bg-surface animate-fade-in">
        <header className="flex justify-between items-center w-full px-margin-desktop h-16 bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sticky top-0 z-40">
          <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Insights</h2>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <UserAvatar size="w-8 h-8" href={null} />
          </div>
        </header>
        <div className="max-w-2xl mx-auto py-24 px-gutter flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary-container/10 rounded-full flex items-center justify-center mb-6 text-primary">
            <span className="material-symbols-outlined text-4xl">construction</span>
          </div>
          <h3 className="text-headline-md font-headline-md text-on-surface mb-2">Portfolio Insights — Coming Soon</h3>
          <p className="text-body-md text-on-surface-variant max-w-md mb-8">
            Portfolio-wide analytics across all applicants aren&apos;t built yet. In the meantime, Applicant Profiles has per-applicant income, IVS score, and eligibility data.
          </p>
          <Link href="/lending">
            <button className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all active:scale-95">
              <span className="material-symbols-outlined">group</span>
              Go to Applicant Profiles
            </button>
          </Link>
        </div>
      </main>
    </>
  );
}

export default function Page() {
  const { role, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return role === "BANK_OFFICER" ? <BankInsightsPlaceholder /> : <FreelancerDashboard />;
}
