"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import BankSidebar from "@/components/BankSidebar";
import RoleGate from "@/components/RoleGate";
import ExplainabilityCard from "@/components/ExplainabilityCard";
import { fetchWithAuth } from "@/lib/fetch_client";
import { db } from "@/lib/firebase";
import type { ApplicantDetailResponse, Consent, VerificationResponse, VerifiedLedgerEntry } from "@/lib/api_types";

// First 6 + last 4 characters, per the standard Explorer-link truncation format.
function truncateSignature(sig: string | null | undefined): string {
  if (!sig) return "";
  if (sig.length <= 12) return sig;
  return `${sig.slice(0, 6)}...${sig.slice(-4)}`;
}

function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

const EVENT_LABELS: Record<string, string> = {
  GRANT: "Consent Granted",
  SCOPE_CHANGE: "Consent Updated",
  REVOKE: "Consent Revoked",
  BANK_ACCESS: "Bank Accessed Data",
};

function ApplicantDetail() {
  // Derived from the URL rather than mirrored into state via an effect.
  const freelancerId = useSearchParams().get("freelancerId");
  const [applicant, setApplicant] = useState<ApplicantDetailResponse | null>(null);
  // Only start in a loading state when there's actually a fetch to do —
  // otherwise the missing-freelancerId branch below would need a synchronous
  // setState-in-effect just to turn it back off.
  const [loading, setLoading] = useState(!!freelancerId);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [auditTrail, setAuditTrail] = useState<VerifiedLedgerEntry[]>([]);
  // Read-only mirror of what app/api/v1/consent/revoke/route.ts has already
  // written to Firestore — this listener never writes anything itself.
  const [liveConsent, setLiveConsent] = useState<Consent | null>(null);
  const [autoResolveDone, setAutoResolveDone] = useState(false);
  const router = useRouter();

  // Reached without a freelancerId (e.g. straight from the sidebar): pick the
  // first applicant this bank actually has active consent for, and put them in
  // the URL so the page stays refreshable and shareable.
  useEffect(() => {
    if (freelancerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth("/api/v1/lending/assess");
        const data = await res.json();
        const first = data.success
          ? (data.applicants || []).find(
              (a: { consentStatus: string }) => a.consentStatus === "ACTIVE"
            )
          : null;
        if (!cancelled && first) {
          router.replace(`/applicant?freelancerId=${first.id}`);
          return;
        }
      } catch (err) {
        console.error("[Applicant] Could not auto-select an applicant:", err);
      }
      if (!cancelled) setAutoResolveDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [freelancerId, router]);

  useEffect(() => {
    if (!freelancerId) return;
    const fetchApplicant = async () => {
      try {
        const res = await fetchWithAuth(`/api/v1/lending/assess?freelancerId=${freelancerId}`);
        const data = await res.json();
        if (data.success) {
          setApplicant(data);

          const consentId = data.consentInfo?.consentId;
          if (consentId) {
            try {
              const verifyRes = await fetchWithAuth(`/api/v1/consent/${consentId}/verify`);
              const verifyData = await verifyRes.json();
              if (verifyData.success) setVerification(verifyData);
            } catch (verifyErr) {
              console.error("Verification check failed:", verifyErr);
            }

            try {
              const auditRes = await fetchWithAuth(`/api/v1/consent/${consentId}/audit-trail`);
              const auditData = await auditRes.json();
              if (auditData.success) {
                setAuditTrail(
                  [...auditData.entries].sort(
                    (a: VerifiedLedgerEntry, b: VerifiedLedgerEntry) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                );
              }
            } catch (auditErr) {
              console.error("Audit trail fetch failed:", auditErr);
            }
          }
        } else {
          setError(data.error);
        }
      } catch (err) {
        console.error(err);
        setError("Network error fetching applicant profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchApplicant();
  }, [freelancerId]);

  // Real-time consent status. Purely a mirror of Firestore — the freelancer's
  // toggle (app/consent/active/page.tsx) calls the revoke API, which does the
  // actual dual-write; this listener only observes the result live, it never
  // writes anything itself.
  const consentId = applicant?.consentInfo?.consentId;
  useEffect(() => {
    if (!consentId) return;
    const unsubscribe = onSnapshot(
      doc(db, "consents", consentId),
      (snap) => {
        if (snap.exists()) {
          setLiveConsent(snap.data() as Consent);
        }
      },
      (err) => {
        console.error("Real-time consent listener failed:", err);
      }
    );
    return () => unsubscribe();
  }, [consentId]);

  const isLiveRevoked = liveConsent?.status === "REVOKED";

  if (!freelancerId && !autoResolveDone) {
    return (
      <>
        <BankSidebar />
        <div className="ml-72 flex h-screen items-center justify-center bg-surface">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-body-md text-on-surface-variant">Selecting a consented applicant...</p>
          </div>
        </div>
      </>
    );
  }

  if (!freelancerId) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-gutter flex flex-col items-center text-center ml-72">
        <div className="w-20 h-20 bg-error-container/20 rounded-full flex items-center justify-center mb-6 text-error">
          <span className="material-symbols-outlined text-4xl">person_search</span>
        </div>
        <h3 className="text-headline-md font-headline-md text-error mb-2">No Applicant Selected</h3>
        <p className="text-body-md text-on-surface-variant max-w-md mb-8">
          Choose a profile from the applicant list to view its verification details.
        </p>
        <Link href="/lending">
          <button className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all active:scale-95">
            <span className="material-symbols-outlined">arrow_back</span>
            Go to Applicant List
          </button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface ml-72">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-body-md text-on-surface-variant">Accessing secure Vault ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/*  SideNavBar (Authority: Institutional Modernism)  */}
      
      <BankSidebar />

      {/*  TopAppBar  */}
      <header className="fixed top-0 right-0 left-72 h-16 bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex justify-between items-center px-margin-desktop z-40">
      <div className="flex items-center gap-4">
      <Link href="/lending" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors">
        <span className="material-symbols-outlined text-outline cursor-pointer">arrow_back</span>
      </Link>
      <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Applicant Profile</h2>
      </div>
      <div className="flex items-center gap-4">
      <button className="hover:bg-surface-container-high rounded-full p-2 transition-all">
      <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
      </button>
      <button className="hover:bg-surface-container-high rounded-full p-2 transition-all">
      <span className="material-symbols-outlined text-on-surface-variant">verified</span>
      </button>
      <div className="h-8 w-8 rounded-full overflow-hidden border border-outline-variant">
      <img alt="" className="w-full h-full object-cover" data-alt="A professional headshot of a financial services administrator in a corporate setting, looking confident and reliable. The lighting is soft and neutral, reflecting a corporate institutional modernist aesthetic with a palette of deep greens and crisp whites." src="https://lh3.googleusercontent.com/aida-public/AB6AXuB50jon0UWjgDgx0E2K2JWoo20_ijw4iRThZ-WS-cEQiYcA7kIFrdWk7dDTnpy8O0bXSEjkKDpmpQ4nb-3JgID-BEE7OQ3ACRpVoSkIoHozrv3HYN40kmCP-6MXr3mDSwYjxNNbZ1mLjfTK6U8Vy2DHR2TNw25WLhhWZn0tscy4OsMQCudVbOmG6ahuMFBBkz-bHFgHcNQHoDeuFn0aweMOttsPzCPGiX_byFk6A-0XYekGP8YJMB_S1g"/>
      </div>
      </div>
      </header>
      {/*  Main Content Canvas  */}
      <main
        className={`ml-72 pt-24 px-margin-desktop pb-stack-lg bg-surface min-h-screen animate-fade-in transition-all duration-500 ${
          isLiveRevoked ? "backdrop-blur-md opacity-50 pointer-events-none select-none" : ""
        }`}
      >
      
      {error ? (
        <div className="max-w-4xl mx-auto py-24 px-gutter flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-error-container/20 rounded-full flex items-center justify-center mb-6 text-error">
            <span className="material-symbols-outlined text-4xl">gavel</span>
          </div>
          <h3 className="text-headline-md font-headline-md text-error mb-2">Access Denied</h3>
          <p className="text-body-md text-on-surface-variant max-w-md mb-8">
            {error || "Ahmed Raza has revoked consent for UBL Digital Lending. Raw financial data is encrypted and locked in accordance with the Digital Trust Act."}
          </p>
          <Link href="/lending">
            <button className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all active:scale-95">
              <span className="material-symbols-outlined">arrow_back</span>
              Return to Applicant List
            </button>
          </Link>
        </div>
      ) : applicant ? (
        <div className="max-w-container-max mx-auto space-y-stack-lg">
          {/*  Banner & Status  */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-gutter">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-headline-lg font-headline-lg text-on-surface">{applicant.name}</h1>
                <span className="px-3 py-1 bg-[#E8F5E9] text-[#004A3B] rounded-full text-label-sm font-label-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
                  Active consent: {applicant.consentInfo?.duration === "ROLLING_6MO" ? "6 Months Rolling" : "One-time snapshot"}
                </span>
              </div>
              <p className="text-body-lg text-on-surface-variant">Verified Freelancer Profile (City: {applicant.city})</p>
            </div>
            <div className="bg-primary-container/10 border border-primary-container/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{"fontVariationSettings":"'FILL' 1"}}>info</span>
              <span className="text-label-md text-primary">Purpose limitation: Credit assessment only</span>
            </div>
          </div>

          {/*  Bento Grid Layout  */}
          <div className="grid grid-cols-12 gap-gutter">
            {/*  Primary Stats Bento  */}
            <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {/*  Income Card  */}
              <div className="bg-surface-container-lowest p-stack-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-white hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-label-md text-on-surface-variant">Avg. Monthly Income</p>
                  <span className="material-symbols-outlined text-secondary">payments</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-headline-md font-headline-md text-primary">
                    PKR {Math.round(applicant.incomeProfile?.avgMonthlyIncome).toLocaleString()}
                  </h3>
                  <p className="text-label-sm text-[#008080] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">trending_up</span>
                    Trend: {applicant.incomeProfile?.trend}
                  </p>
                </div>
                <div className="mt-6 h-24 relative">
                  {/*  Simple Sparkline with SVG  */}
                  <svg className="w-full h-full preserve-3d" viewBox="0 0 100 30">
                    <path d="M0 25 Q 10 20, 20 22 T 40 15 T 60 18 T 80 5 T 100 8" fill="none" stroke="#008080" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
                    <path d="M0 25 Q 10 20, 20 22 T 40 15 T 60 18 T 80 5 T 100 8 V 30 H 0 Z" fill="url(#gradient-income)" opacity="0.1"></path>
                    <defs>
                      <linearGradient id="gradient-income" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#008080"></stop>
                        <stop offset="100%" stopColor="#008080" stopOpacity="0"></stop>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/*  IVS Score Card  */}
              <div className="bg-surface-container-lowest p-stack-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-white hover:shadow-lg transition-all relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-label-md text-on-surface-variant">IVS Score (Verified)</p>
                  <span className="material-symbols-outlined text-[#D4AF37]" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
                </div>
                <div className="flex items-end gap-2">
                  <h3 className="text-headline-lg font-headline-lg text-primary">{applicant.incomeProfile?.ivs}</h3>
                  <p className="text-label-md text-on-surface-variant mb-2">/100</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="px-2 py-1 bg-[#E8F5E9] text-[#004A3B] rounded text-label-sm">
                    {applicant.incomeProfile?.coefficientOfVariation < 0.2 ? "High Stability" : "Standard Stability"}
                  </span>
                  <span className="px-2 py-1 bg-[#E8F5E9] text-[#004A3B] rounded text-label-sm">
                    Sources: {applicant.consentInfo?.sourcesShared?.join(", ")}
                  </span>
                </div>
                {/*  Decorative background element  */}
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl"></div>
              </div>

              {/*  Source Mix Visualization  */}
              <div className="col-span-1 md:col-span-2 bg-surface-container-lowest p-stack-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-white">
                <h4 className="text-label-md text-on-surface-variant mb-6 uppercase tracking-wider">Income Source Distribution</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    {applicant.consentInfo?.sourcesShared?.map((source: string, idx: number) => {
                      const colors = ["bg-primary", "bg-secondary", "bg-tertiary"];
                      const color = colors[idx % colors.length];
                      return (
                        <div key={source} className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded ${color}`}></div>
                          <div>
                            <p className="text-label-sm text-on-surface-variant uppercase">{source}</p>
                            <p className="text-body-md font-bold text-on-surface">Consented</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="col-span-2 flex items-center justify-center">
                    <div className="w-full h-24 bg-surface-container flex items-end gap-2 px-2 rounded-lg overflow-hidden">
                      <div className="flex-1 bg-primary rounded-t animate-pulse" style={{"height":"75%"}}></div>
                      <div className="flex-1 bg-secondary rounded-t" style={{"height":"45%"}}></div>
                      <div className="flex-1 bg-tertiary-container rounded-t" style={{"height":"25%"}}></div>
                      <div className="flex-1 bg-primary rounded-t" style={{"height":"85%"}}></div>
                      <div className="flex-1 bg-secondary rounded-t animate-pulse" style={{"height":"60%"}}></div>
                      <div className="flex-1 bg-tertiary-container rounded-t" style={{"height":"30%"}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/*  Eligibility & Sidebar Bento  */}
            <div className="col-span-12 lg:col-span-4 space-y-gutter">
              {/*  Eligibility Card  */}
              <div className="bg-primary text-white p-stack-lg rounded-2xl shadow-xl relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest">Digital Underwriting</span>
                    <span className="material-symbols-outlined text-white/50">account_balance_wallet</span>
                  </div>
                  <p className="text-white/70 text-label-md mb-1">Max Credit Band Eligibility</p>
                  <h3 className="text-headline-md font-headline-md mb-1">
                    PKR {Math.round(applicant.eligibility?.maxLimitPKR || 0).toLocaleString()}
                  </h3>
                  <p className="text-white/70 text-label-sm mb-4">
                    {applicant.eligibility?.label || "Not assessed"}
                  </p>

                  {/*  Debt disclosure is shown as an explicit state. A blank
                       field reads as neutral; "Declined" reads as the risk
                       signal it actually is.  */}
                  {(() => {
                    const d = applicant.outflowDisclosure?.status;
                    const cfg =
                      d === "SHARED"
                        ? { icon: "verified", text: "Debt disclosed & statement-backed", tone: "bg-white/20" }
                        : d === "DECLARED_NONE"
                          ? { icon: "info", text: "No debt — self-declared, verify via eCIB", tone: "bg-[#D4AF37]/30" }
                          : { icon: "warning", text: "Debt disclosure DECLINED", tone: "bg-[#ba1a1a]/40" };
                    return (
                      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg mb-3 ${cfg.tone}`}>
                        <span className="material-symbols-outlined text-[18px] mt-0.5">{cfg.icon}</span>
                        <div>
                          <p className="text-label-sm font-bold">{cfg.text}</p>
                          {applicant.eligibility?.capped && applicant.eligibility?.capReason && (
                            <p className="text-[11px] text-white/80 mt-0.5">
                              {applicant.eligibility.capReason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {applicant.outflowDisclosure?.metrics && (
                    <div className="space-y-1.5 mb-4 pt-3 border-t border-white/20">
                      <div className="flex justify-between text-label-sm">
                        <span className="text-white/70">Debt-to-income</span>
                        <span className="font-bold">
                          {applicant.outflowDisclosure.metrics.dtiPercent ?? "—"}
                          {applicant.outflowDisclosure.metrics.dtiPercent !== null ? "%" : ""}
                          {" "}({applicant.outflowDisclosure.metrics.dtiTier})
                        </span>
                      </div>
                      <div className="flex justify-between text-label-sm">
                        <span className="text-white/70">Utilisation</span>
                        <span className="font-bold">
                          {applicant.outflowDisclosure.metrics.utilizationPercent ?? "—"}
                          {applicant.outflowDisclosure.metrics.utilizationPercent !== null ? "%" : ""}
                        </span>
                      </div>
                      <div className="flex justify-between text-label-sm">
                        <span className="text-white/70">Free cash flow</span>
                        <span className="font-bold">
                          PKR {Math.round(applicant.outflowDisclosure.metrics.netFreeCashFlowPKR || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  <button className="w-full py-3 bg-white text-primary rounded-xl font-bold text-label-md hover:bg-opacity-90 transition-all flex items-center justify-center gap-2">
                    Approve Loan Offer
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
                {/*  Abstract glow effect  */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#008080] rounded-full blur-[60px] opacity-30 group-hover:opacity-50 transition-opacity"></div>
              </div>

              {/*  Audit Log Card  */}
              <div className="bg-surface-container-lowest p-stack-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-white">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-label-md text-on-surface-variant font-bold">Access Audit Log</h4>
                  {verification?.status === "VERIFIED" && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[11px] font-bold border border-primary/20">
                      <span className="material-symbols-outlined text-[13px]" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
                      Blockchain-Confirmed
                    </span>
                  )}
                  {verification?.status === "BLOCKCHAIN_PENDING" && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-secondary/10 text-secondary rounded-full text-[11px] font-bold border border-secondary/20">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      Simulated
                    </span>
                  )}
                  {verification?.status === "TAMPERED" && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-error/10 text-error rounded-full text-[11px] font-bold border border-error/20">
                      <span className="material-symbols-outlined text-[13px]" style={{"fontVariationSettings":"'FILL' 1"}}>warning</span>
                      Tampered
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full ${applicant.consentInfo ? "bg-[#008080]" : "bg-outline"}`}></div>
                    <div>
                      <p className="text-body-sm text-on-surface">
                        Consent Active: {applicant.consentInfo ? "Yes" : "No"}
                      </p>
                      <p className="text-label-sm text-on-surface-variant">
                        {verification
                          ? `Local ledger: ${verification.localLedger?.entryCount} entries, ${verification.localLedger?.intact ? "intact" : "BROKEN"}`
                          : "Checking ledger integrity..."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 opacity-60">
                    <div className="mt-1 w-2 h-2 rounded-full bg-outline"></div>
                    <div>
                      <p className="text-body-sm text-on-surface">Consent Ref: VT-{applicant.consentInfo?.consentId?.substring(0, 8).toUpperCase() || "—"}</p>
                      <p className="text-label-sm text-on-surface-variant">Granted on {new Date(applicant.consentInfo?.grantedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                {verification?.transactionSignature && (
                  <div className="mt-4 p-3 bg-surface rounded-lg border border-outline-variant/30">
                    <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Tx Signature</p>
                    <p className="text-[12px] font-mono text-on-surface mb-2" title={verification.transactionSignature}>
                      {truncateSignature(verification.transactionSignature)}
                    </p>
                    <a
                      href={explorerTxUrl(verification.transactionSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary text-label-sm font-bold hover:underline"
                    >
                      View on Devnet Explorer
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  </div>
                )}

                {/* Audit Trail: grant -> updates -> revoke, each with its own timestamp.
                    Only the most recent event can be honestly tied to the current
                    on-chain signature (the backend keeps just one signature per
                    consent, overwritten by whichever action last confirmed) — so
                    the Explorer link only appears there, not fabricated per-row. */}
                {auditTrail.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-outline-variant/20">
                    <h5 className="text-label-md text-on-surface-variant font-bold mb-4">Audit Trail</h5>
                    <ol className="space-y-4">
                      {auditTrail.map((entry, idx) => {
                        const isLast = idx === auditTrail.length - 1;
                        const showSignature = isLast && verification?.transactionSignature;
                        return (
                          <li key={entry.id || idx} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={`mt-1 w-2 h-2 rounded-full ${
                                  entry.verified === false ? "bg-error" : "bg-primary"
                                }`}
                              ></div>
                              {idx < auditTrail.length - 1 && (
                                <div className="w-px flex-1 bg-outline-variant/40 mt-1"></div>
                              )}
                            </div>
                            <div className="pb-1">
                              <p className="text-body-sm font-semibold text-on-surface">
                                {EVENT_LABELS[entry.eventType] || entry.eventType}
                                {entry.verified === false && (
                                  <span className="ml-2 text-error text-label-sm font-bold">Tampered</span>
                                )}
                              </p>
                              <p className="text-label-sm text-on-surface-variant">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Unknown time"}
                              </p>
                              {showSignature && verification.transactionSignature && (
                                <a
                                  href={explorerTxUrl(verification.transactionSignature)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 flex items-center gap-1 text-primary text-label-sm font-bold hover:underline"
                                  title={verification.transactionSignature}
                                >
                                  {truncateSignature(verification.transactionSignature)}
                                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                </a>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                <Link href="/audit">
                  <button className="w-full mt-6 text-primary text-label-md font-bold hover:underline text-left">View Global Consent Registry</button>
                </Link>
              </div>
            </div>
          </div>

          {/*  No Data Privacy Message  */}
          <div className="bg-surface-container-low p-stack-md rounded-xl border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-outline text-xl">lock</span>
            <p className="text-label-sm text-on-surface-variant">
              Individual transaction details are encrypted and hidden as per user&apos;s data sharing preferences. Only aggregate metadata is visible for credit assessment.
            </p>
          </div>

          {/*  Detailed Visualizations Row  */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            {/*  6-Month Trend  */}
            <div className="bg-surface-container-lowest p-stack-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-white">
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-headline-sm text-primary">6-Month Income Trend</h4>
                <select className="bg-surface border-none rounded-lg text-label-sm text-on-surface-variant focus:ring-0">
                  <option>Last 6 Months</option>
                  <option>Year to Date</option>
                </select>
              </div>
              <div className="h-64 flex items-end justify-between px-2 gap-4">
                <div className="group relative flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary-container/20 rounded-t-lg transition-all duration-300 group-hover:bg-primary-container/40" style={{"height":"70%"}}></div>
                  <span className="text-label-sm text-on-surface-variant">Aug</span>
                </div>
                <div className="group relative flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary-container/20 rounded-t-lg transition-all duration-300 group-hover:bg-primary-container/40" style={{"height":"65%"}}></div>
                  <span className="text-label-sm text-on-surface-variant">Sep</span>
                </div>
                <div className="group relative flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary-container/20 rounded-t-lg transition-all duration-300 group-hover:bg-primary-container/40" style={{"height":"85%"}}></div>
                  <span className="text-label-sm text-on-surface-variant">Oct</span>
                </div>
                <div className="group relative flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary-container/20 rounded-t-lg transition-all duration-300 group-hover:bg-primary-container/40" style={{"height":"80%"}}></div>
                  <span className="text-label-sm text-on-surface-variant">Nov</span>
                </div>
                <div className="group relative flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary-container/20 rounded-t-lg transition-all duration-300 group-hover:bg-primary-container/40" style={{"height":"90%"}}></div>
                  <span className="text-label-sm text-on-surface-variant">Dec</span>
                </div>
                <div className="group relative flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-primary rounded-t-lg shadow-md" style={{"height":"100%"}}></div>
                  <span className="text-label-sm text-primary font-bold">Jan</span>
                </div>
              </div>
            </div>

            {/*  Score Explainability — real breakdown from computeIncomeScore(), not mock content  */}
            {applicant.incomeProfile?.breakdown && (
              <ExplainabilityCard
                score={{
                  ivs: applicant.incomeProfile.ivs,
                  trend: applicant.incomeProfile.trend,
                  breakdown: applicant.incomeProfile.breakdown,
                  eligibilityBandPKR:
                    applicant.incomeProfile.indicativeIncomeOnlyBandPKR,
                }}
              />
            )}
          </div>
        </div>
      ) : null}
      </main>

      {/*  Real-time revocation overlay — reflects Firestore instantly via
          onSnapshot, no page reload. Also surfaces blockchainStatus so the
          demo proves the on-chain layer, not just a database flag.  */}
      {isLiveRevoked && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-gutter">
          <div className="bg-error text-white rounded-2xl shadow-2xl px-10 py-8 max-w-md w-full text-center border-4 border-error/40 animate-fade-in">
            <span className="material-symbols-outlined text-5xl mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
              block
            </span>
            <h2 className="text-headline-md font-headline-md font-bold mb-2">403: USER REVOKED ACCESS</h2>
            <p className="text-body-md opacity-90 mb-4">Live feed disconnected by freelancer.</p>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-bold ${
                liveConsent?.blockchainStatus === "CONFIRMED" ? "bg-white/25" : "bg-white/10"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {liveConsent?.blockchainStatus === "CONFIRMED" ? "verified" : "schedule"}
              </span>
              {liveConsent?.blockchainStatus === "CONFIRMED"
                ? "Blockchain-confirmed revocation"
                : "Revocation pending blockchain confirmation..."}
            </span>
          </div>
        </div>
      )}

      {/*  Floating Action Button (Contextual)  */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined">chat_bubble</span>
      </button>
    </>
  );
}

/**
 * `useSearchParams()` opts the subtree into client-side rendering and must be
 * wrapped in Suspense, otherwise the static prerender of /applicant fails.
 */
export default function Page() {
  return (
    <RoleGate allow="BANK_OFFICER">
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-surface">
            <div className="animate-pulse text-on-surface-variant text-body-md">
              Loading applicant…
            </div>
          </div>
        }
      >
        <ApplicantDetail />
      </Suspense>
    </RoleGate>
  );
}
