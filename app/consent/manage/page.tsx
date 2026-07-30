"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import UserAvatar from "@/components/UserAvatar";
import { fetchWithAuth } from "@/lib/fetch_client";

// First 6 + last 4 characters, per the standard Explorer-link truncation format.
function truncateSignature(sig: string | null | undefined): string {
  if (!sig) return "";
  if (sig.length <= 12) return sig;
  return `${sig.slice(0, 6)}...${sig.slice(-4)}`;
}

function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export default function Page() {
  const [activeConsent, setActiveConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await fetchWithAuth("/api/v1/consent/active");
        const data = await res.json();
        if (data.success && data.consent) {
          setActiveConsent(data.consent);

          // Verification and the audit trail are independent of each other;
          // neither failing should stop the other from rendering.
          const [verifyRes, trailRes] = await Promise.allSettled([
            fetchWithAuth(`/api/v1/consent/${data.consent.id}/verify`),
            fetchWithAuth(`/api/v1/consent/${data.consent.id}/audit-trail`),
          ]);

          if (verifyRes.status === "fulfilled") {
            try {
              const verifyData = await verifyRes.value.json();
              if (verifyData.success) setVerification(verifyData);
            } catch (e) {
              console.error("Verification parse failed:", e);
            }
          }

          if (trailRes.status === "fulfilled") {
            try {
              const trailData = await trailRes.value.json();
              if (trailData.success) setAuditEntries(trailData.entries || []);
            } catch (e) {
              console.error("Audit trail parse failed:", e);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchActive();
  }, []);

  /** Ledger event types rendered as human-readable activity labels. */
  const EVENT_LABELS: Record<string, string> = {
    GRANT: "Consent granted",
    SCOPE_CHANGE: "Scope updated",
    REVOKE: "Consent revoked",
    BANK_ACCESS: "Data accessed by bank",
  };

  const formatEventTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };

  // Newest first, capped — this panel is a summary, the full list lives in /audit.
  const recentActivity = [...auditEntries]
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 4);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Interaction helpers for events inside the HTML designs
  const openDetail = (eventId: string) => {
    console.log('Opening details for:', eventId);
    if (typeof document !== 'undefined') {
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach(row => {
        row.classList.remove('active-row', 'border-l-4', 'border-primary');
      });
    }
  };

  const openModal = () => {
    if (typeof document !== 'undefined') {
      const modal = document.getElementById('revocationModal');
      const content = document.getElementById('modalContent');
      if (modal && content) {
        modal.classList.remove('hidden');
        setTimeout(() => {
          content.classList.remove('scale-95', 'opacity-0');
          content.classList.add('scale-100', 'opacity-100');
        }, 10);
      }
    }
  };

  const closeModal = () => {
    if (typeof document !== 'undefined') {
      const content = document.getElementById('modalContent');
      const modal = document.getElementById('revocationModal');
      if (content && modal) {
        content.classList.add('scale-95', 'opacity-0');
        content.classList.remove('scale-100', 'opacity-100');
        setTimeout(() => {
          modal.classList.add('hidden');
        }, 300);
      }
    }
  };

  const executeRevoke = async () => {
    setRevokeError(null);
    try {
      const res = await fetchWithAuth("/api/v1/consent/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentId: activeConsent?.id }),
      });
      const data = await res.json();
      if (data.success) {
        // Keep showing the (now revoked) consent record — the ledger revoke
        // is guaranteed regardless of blockchain status, so this is a genuine
        // success either way, and the revocation time/status should stay visible
        // rather than the whole card disappearing.
        setActiveConsent(data.consent);
        closeModal();

        if (data.consent?.id) {
          try {
            const verifyRes = await fetchWithAuth(`/api/v1/consent/${data.consent.id}/verify`);
            const verifyData = await verifyRes.json();
            if (verifyData.success) setVerification(verifyData);
          } catch (verifyErr) {
            console.error("Verification refresh failed:", verifyErr);
          }
        }

        if (typeof document !== 'undefined') {
          const toast = document.getElementById('successToast');
          if (toast) {
            toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => {
              toast.classList.add('translate-y-20', 'opacity-0');
            }, 4000);
          }
        }
      } else {
        setRevokeError(data.error || "Failed to revoke access. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setRevokeError("Could not reach the server. Check your connection and try again.");
    }
  };

  return (
    <>
      {/*  Predicted SideNavBar for UBL Digital Portal  */}
      
      <FreelancerSidebar />

      {/*  Main Canvas  */}
      <main className="lg:ml-72 min-h-screen animate-fade-in">
      {/*  Predicted TopAppBar  */}
      <header className="flex justify-between items-center w-full pl-16 pr-5 lg:px-margin-desktop h-16 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sticky top-0 z-40">
      <div className="flex items-center gap-4">
      <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Consent Management</h2>
      </div>
      <div className="flex items-center gap-stack-md">
      <button className="hover:bg-surface-container-high rounded-full p-2 transition-opacity">
      <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
      </button>
      <UserAvatar size="w-8 h-8" />
      </div>
      </header>
      {/*  Content Area  */}
      <div className="p-stack-lg max-w-container-max mx-auto">
      {/*  Page Header  */}
      <div className="flex items-end justify-between mb-stack-lg">
      <div className="space-y-1">
      <span className="text-label-md font-label-md text-secondary uppercase tracking-widest">Active Permissions</span>
      <h3 className="text-headline-md font-headline-md text-on-surface">Digital Stewardship Dashboard</h3>
      </div>
      <div className="flex gap-stack-md">
      <button className="px-stack-md py-2 border border-outline rounded-full text-label-md font-label-md text-on-surface hover:bg-surface-container-low transition-all">
                              Download Audit Log
                          </button>
      </div>
      </div>
      {/*  Bento Grid Layout  */}
      <div className="grid grid-cols-12 gap-gutter">
      {/*  Main Consent Card (UBL Digital Lending)  */}
      {activeConsent ? (
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-8 border border-outline-variant/20 relative overflow-hidden">
        {/*  Glassmorphic Accent  */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10">
        <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary border border-secondary/20">
        <span className="material-symbols-outlined text-[32px]">shield_with_heart</span>
        </div>
        <div>
        <div className="flex items-center gap-2">
        <h4 className="text-headline-sm font-headline-sm text-on-surface">
          {activeConsent.bankId === "ubl-bank-id" ? "UBL Digital Lending" : activeConsent.bankId}
        </h4>
        <span className="material-symbols-outlined text-[18px] text-tertiary">verified</span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
        {activeConsent.status === "REVOKED" ? (
          <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[12px] font-bold">Revoked</span>
        ) : (
          <span className="px-3 py-1 bg-[#E8F5E9] text-[#004A3B] rounded-full text-[12px] font-bold">Active</span>
        )}
        {/* Verification Badge — driven entirely by the real /verify response, never hardcoded. */}
        {verification?.status === "VERIFIED" && (
          <span className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-[12px] font-bold border border-primary/20">
            <span className="material-symbols-outlined text-[14px]" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
            Verified
          </span>
        )}
        {verification?.status === "BLOCKCHAIN_PENDING" && (
          <span className="flex items-center gap-1 px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[12px] font-bold border border-secondary/20">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            Blockchain-Pending
          </span>
        )}
        {verification?.status === "TAMPERED" && (
          <span className="flex items-center gap-1 px-3 py-1 bg-error/10 text-error rounded-full text-[12px] font-bold border border-error/20">
            <span className="material-symbols-outlined text-[14px]" style={{"fontVariationSettings":"'FILL' 1"}}>warning</span>
            Tampered
          </span>
        )}
        <span className="text-label-sm font-label-sm text-on-surface-variant">
          Granted: {activeConsent.grantedAt ? new Date(activeConsent.grantedAt).toLocaleString() : "Unknown"}
        </span>
        {activeConsent.revokedAt && (
          <span className="text-label-sm font-label-sm text-on-surface-variant">
            Revoked: {new Date(activeConsent.revokedAt).toLocaleString()}
          </span>
        )}
        </div>
        </div>
        </div>
        {activeConsent.status !== "REVOKED" && (
          <button className="mt-4 md:mt-0 px-6 py-3 border-2 border-error text-error rounded-xl font-bold text-label-md hover:bg-error/5 transition-all flex items-center gap-2" onClick={() => { openModal() }}>
          <span className="material-symbols-outlined text-[20px]">no_accounts</span>
                                      Revoke access
                                  </button>
        )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        <div className="space-y-2">
        <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Purpose</p>
        <p className="text-body-lg font-body-lg text-on-surface font-semibold">{activeConsent.purpose}</p>
        <p className="text-body-sm text-on-surface-variant leading-relaxed">Evaluation of freelancer income consistency for loan limits.</p>
        </div>
        <div className="space-y-2">
        <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Scope</p>
        <div className="flex flex-wrap gap-2">
        {activeConsent.sources.map((s: string) => (
          <span key={s} className="px-2 py-1 bg-surface-container text-on-surface rounded text-label-sm uppercase font-bold">{s}</span>
        ))}
        </div>
        </div>
        <div className="space-y-2">
        <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Expiry Date</p>
        <p className="text-body-lg font-body-lg text-on-surface font-semibold">
          {new Date(activeConsent.expiresAt).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"})}
        </p>
        <p className="text-label-sm text-secondary font-medium">
          {Math.ceil((new Date(activeConsent.expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24))} days remaining
        </p>
        </div>
        </div>
        <div className="mt-10 p-4 bg-surface rounded-lg border border-outline-variant/30 flex items-center gap-4">
        <span className="material-symbols-outlined text-secondary" style={{"fontVariationSettings":"'FILL' 1"}}>info</span>
        <p className="text-body-sm text-on-surface-variant">This consent is protected by <strong>End-to-End Institutional Encryption</strong>. Data retrieval is limited to read-only access for the specified purpose.</p>
        </div>
        {verification?.transactionSignature ? (
          <div className="mt-4 p-4 bg-surface rounded-lg border border-outline-variant/30 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-primary" style={{"fontVariationSettings":"'FILL' 1"}}>link</span>
              <div className="min-w-0">
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Solana Transaction Signature</p>
                <p className="text-body-sm font-mono text-on-surface" title={verification.transactionSignature}>
                  {truncateSignature(verification.transactionSignature)}
                </p>
              </div>
            </div>
            <a
              href={explorerTxUrl(verification.transactionSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-4 py-2 border border-primary text-primary rounded-lg text-label-sm font-bold hover:bg-primary/5 transition-all whitespace-nowrap"
            >
              View on Explorer
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>
          </div>
        ) : (activeConsent.blockchainStatus === "FAILED" || activeConsent.blockchainStatus === "PENDING_RETRY") && (
          // Expected fallback behavior, not an error — the ledger write already
          // succeeded and guarantees this consent is tamper-evident; the chain
          // write just hasn't landed (or is retrying) yet.
          <div className="mt-4 p-4 bg-secondary/5 rounded-lg border border-secondary/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">schedule</span>
            <div>
              <p className="text-body-sm font-semibold text-on-surface">Blockchain sync pending</p>
              <p className="text-label-sm text-on-surface-variant">
                Your consent is safely recorded in the tamper-evident ledger. The Solana confirmation is still syncing and will appear here automatically.
              </p>
            </div>
          </div>
        )}
        </div>
      ) : (
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-8 border border-outline-variant/20 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-3xl">gavel</span>
          </div>
          <h4 className="text-headline-sm font-headline-sm text-on-surface mb-2">No Active Consent Policies</h4>
          <p className="text-body-md text-on-surface-variant max-w-sm mb-6">You do not have any active data sharing consent policy with UBL or other banks.</p>
          <Link href="/consent/setup">
            <button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold">Set up new policy</button>
          </Link>
        </div>
      )}
      {/*  Side Stats / Info  */}
      <div className="col-span-12 lg:col-span-4 space-y-gutter">
      <div className="bg-primary-container text-on-primary-container p-stack-lg rounded-xl shadow-lg relative overflow-hidden group">
      <div className="absolute inset-0 opacity-10 pointer-events-none transition-transform group-hover:scale-110 duration-700">
      <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/40 to-transparent"></div>
      </div>
      <h5 className="text-label-md font-label-md mb-2 opacity-80 uppercase">Trust Score</h5>
      <div className="flex items-baseline gap-2 mb-4">
      <span className="text-4xl font-bold tracking-tighter">98.4</span>
      <span className="text-label-sm">Excellent</span>
      </div>
      <p className="text-body-sm opacity-90 leading-relaxed mb-6">Your consent hygiene is top-tier. Regular reviews enhance your financial security profile.</p>
      <button className="w-full py-3 bg-on-primary-container text-primary-container rounded-lg font-bold text-label-md shadow-md">View Security Report</button>
      </div>
      <div className="bg-surface-container-lowest p-stack-lg rounded-xl border border-outline-variant/20 shadow-sm">
      <h5 className="text-label-md font-label-md text-on-surface-variant mb-4 flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]">history</span>
                                  Recent Activity
                              </h5>
      <ul className="space-y-4">
      {recentActivity.length === 0 ? (
        <li className="text-label-sm text-on-surface-variant">No ledger activity recorded yet.</li>
      ) : (
        recentActivity.map((entry: any) => (
        <li key={entry.id} className="flex gap-3">
        <div className={`w-2 h-2 rounded-full mt-2 ${entry.verified === false ? "bg-error" : "bg-secondary"}`}></div>
        <div>
        <p className="text-body-sm font-semibold">{EVENT_LABELS[entry.eventType] || entry.eventType}</p>
        <p className="text-label-sm text-on-surface-variant">{formatEventTime(entry.timestamp)}</p>
        </div>
        </li>
        ))
      )}
      </ul>
      </div>
      </div>
      </div>
      {/*  Secondary Cards / Other Consents  */}
      <div className="mt-stack-lg">
      <h4 className="text-headline-sm font-headline-sm text-on-surface mb-stack-md">Other Consents</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
      <div className="glass-card p-stack-md rounded-xl border border-outline-variant/30 flex items-center gap-4 opacity-70 grayscale-[0.5]">
      <div className="w-12 h-12 bg-surface-container rounded-lg flex items-center justify-center text-on-surface-variant">
      <span className="material-symbols-outlined">payments</span>
      </div>
      <div>
      <p className="font-bold text-on-surface">PayStream Inc</p>
      <p className="text-label-sm text-on-surface-variant">Expired: 12 Dec 2023</p>
      </div>
      </div>
      <div className="glass-card p-stack-md rounded-xl border border-outline-variant/30 flex items-center gap-4">
      <div className="w-12 h-12 bg-primary-container/10 rounded-lg flex items-center justify-center text-primary">
      <span className="material-symbols-outlined">house</span>
      </div>
      <div>
      <p className="font-bold text-on-surface">Hearth Mortgages</p>
      <p className="text-label-sm text-on-surface-variant">Pending Renewal</p>
      </div>
      </div>
      </div>
      </div>
      </div>
      </main>
      {/*  Revocation Modal  */}
      <div className="fixed inset-0 z-[100] hidden flex items-center justify-center p-gutter" id="revocationModal">
      <div className="modal-overlay absolute inset-0" onClick={() => { closeModal() }}></div>
      <div className="bg-surface-container-lowest w-full max-w-md rounded-xl shadow-[0px_12px_32px_rgba(0,74,59,0.08)] relative z-10 overflow-hidden transform scale-95 transition-all duration-300 opacity-0" id="modalContent">
      <div className="p-8">
      <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center mb-6">
      <span className="material-symbols-outlined" style={{"fontVariationSettings":"'FILL' 1"}}>warning</span>
      </div>
      <h3 className="text-headline-sm font-headline-sm text-on-surface mb-2">Revoke UBL's access?</h3>
      <p className="text-body-md text-on-surface-variant leading-relaxed">
                          Access lost immediately, revocation recorded in audit trail. This action cannot be undone without a new application process.
                      </p>
      {revokeError && (
        <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2">
          <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
          <p className="text-body-sm text-error">{revokeError}</p>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3">
      <button className="w-full py-4 bg-error text-on-error rounded-xl font-bold text-label-md shadow-lg shadow-error/20 hover:bg-error/90 transition-all active:scale-95" onClick={() => { executeRevoke() }}>
                              Confirm Revocation
                          </button>
      <button className="w-full py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-label-md hover:bg-surface-container-highest transition-all" onClick={() => { closeModal() }}>
                              Keep Access
                          </button>
      </div>
      </div>
      {/*  Security Badge  */}
      <div className="bg-surface-container text-center py-3">
      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center justify-center gap-1">
      <span className="material-symbols-outlined text-[14px]">lock</span> Secure Transaction via VaultTrust
                      </p>
      </div>
      </div>
      </div>
      {/*  Success Toast (Hidden)  */}
      <div className="fixed bottom-10 right-10 z-[110] translate-y-20 opacity-0 transition-all duration-500 pointer-events-none" id="successToast">
      <div className="bg-surface-container-lowest border-l-4 border-secondary px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4">
      <span className="material-symbols-outlined text-secondary">check_circle</span>
      <div>
      <p className="font-bold text-on-surface">Consent Revoked</p>
      <p className="text-body-sm text-on-surface-variant">The audit trail has been updated successfully.</p>
      </div>
      </div>
      </div>
    </>
  );
}
