"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import UserAvatar from "@/components/UserAvatar";
import { fetchWithAuth } from "@/lib/fetch_client";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState<any>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveConsent = async () => {
      try {
        const res = await fetchWithAuth("/api/v1/consent/active");
        const data = await res.json();
        if (data.success && data.consent) {
          setConsent(data.consent);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveConsent();
  }, []);

  // Calls the real dual-write revoke endpoint — never writes to Firestore
  // directly from the client. The Bank Dashboard picks this up live via its
  // own onSnapshot listener on the same consent document, once the backend
  // route has actually written it.
  const handleToggleRevoke = async () => {
    if (!consent || revoking) return;
    setRevokeError(null);
    setRevoking(true);
    try {
      const res = await fetchWithAuth("/api/v1/consent/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentId: consent.id }),
      });
      const data = await res.json();
      if (data.success) {
        setConsent(data.consent);
      } else {
        setRevokeError(data.error || "Failed to revoke access. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setRevokeError("Could not reach the server. Check your connection and try again.");
    } finally {
      setRevoking(false);
    }
  };

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

  const executeRevoke = () => {
    closeModal();
    if (typeof document !== 'undefined') {
      const toast = document.getElementById('successToast');
      if (toast) {
        setTimeout(() => {
          toast.classList.remove('translate-y-20', 'opacity-0');
          setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
          }, 4000);
        }, 400);
      }
    }
  };

  return (
    <>
      {/*  Success Confetti Canvas  */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" id="confetti-container"></div>
      {/*  Layout Shell  */}
      <div className="flex h-screen overflow-hidden">
      {/*  Sidebar Navigation (SideNavBar)  */}
      
      <FreelancerSidebar />

      {/*  Main Content Canvas  */}
      <main className="lg:ml-64 flex-1 overflow-y-auto bg-surface relative animate-fade-in">
      {/*  TopAppBar  */}
      <header className="flex justify-between items-center w-full pl-16 pr-5 lg:px-margin-desktop h-16 bg-surface-container-lowest shadow-sm sticky top-0 z-30">
      <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Success Status</h2>
      <div className="flex items-center gap-4">
      <button className="hover:bg-surface-container-high rounded-full p-2 transition-colors">
      <span className="material-symbols-outlined text-primary">notifications</span>
      </button>
      <button className="hover:bg-surface-container-high rounded-full p-2 transition-colors">
      <span className="material-symbols-outlined text-primary">verified</span>
      </button>
      <UserAvatar size="w-8 h-8" />
      </div>
      </header>
      {consent ? (
        <div className="max-w-4xl mx-auto py-16 px-gutter flex flex-col items-center text-center">
          {/*  Success Header  */}
          <div className="relative mb-10">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg relative z-10 ${consent.status === "REVOKED" ? "bg-surface-container-highest" : "bg-primary"}`}>
          <span className={`material-symbols-outlined text-5xl ${consent.status === "REVOKED" ? "text-on-surface-variant" : "text-white"}`} style={{"fontVariationSettings":"'FILL' 1"}}>{consent.status === "REVOKED" ? "block" : "verified"}</span>
          </div>
          {consent.status !== "REVOKED" && (
            <>
              {/*  Decorative Rings  */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-primary/20 rounded-full animate-ping"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-primary/10 rounded-full"></div>
            </>
          )}
          </div>
          <h3 className="text-headline-lg font-headline-lg text-primary mb-2">
            {consent.status === "REVOKED" ? "Access revoked." : "Your consent is active."}
          </h3>
          <p className="text-body-lg text-on-surface-variant max-w-lg mb-12">
            {consent.status === "REVOKED"
              ? "The bank no longer has access to your financial data. This was recorded in the tamper-evident ledger and on Solana devnet."
              : "Data access has been successfully established and recorded on the secure ledger."}
          </p>
          {/*  Bento-style Details Grid  */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mb-12">
          {/*  Consent ID  */}
          <div className="md:col-span-1 bg-surface-container-lowest p-6 rounded-card shadow-sm border border-outline-variant/30 flex flex-col items-start justify-between">
          <span className="text-label-sm font-label-sm text-on-surface-variant mb-2">Consent ID</span>
          <span className="text-headline-sm font-headline-sm text-primary">VT-{consent.id.substring(0, 6).toUpperCase()}</span>
          </div>
          {/*  Purpose  */}
          <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-card shadow-sm border border-outline-variant/30 flex flex-col items-start">
          <span className="text-label-sm font-label-sm text-on-surface-variant mb-2">Purpose</span>
          <div className="flex items-center">
          <span className="material-symbols-outlined text-secondary mr-2">analytics</span>
          <span className="text-headline-sm font-headline-sm text-on-surface">{consent.purpose}</span>
          </div>
          </div>
          {/*  Valid Until  */}
          <div className="md:col-span-1 bg-surface-container-lowest p-6 rounded-card shadow-sm border border-outline-variant/30 flex flex-col items-start justify-between">
          <span className="text-label-sm font-label-sm text-on-surface-variant mb-2">Valid Until</span>
          <span className="text-headline-sm font-headline-sm text-secondary">
            {consent.expiresAt ? new Date(consent.expiresAt).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}) : "N/A"}
          </span>
          </div>
          {/*  Recipient  */}
          <div className="md:col-span-4 bg-primary-container/5 p-8 rounded-card border border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm overflow-hidden">
          <img className="w-8 h-8 object-contain" data-alt="A minimalist logo for UBL Bank, featuring professional geometric letterforms in deep emerald green and restrained gold. The logo is centered on a clean white background, conveying trust, legacy, and digital-first banking reliability." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtTNDoKPR7whO0U49HcD2m43kSTdLYRsbN4Peu6JI_pdfi6mvhoETUkM2AQGrJb0s_6jBuieu3hwk1K_Yd88jGaOQbrxbIGa7kRLluTb3EzY2bm23LIQNUlPa659hbt6FzbuPYFhqNoaU21hI9CASY3jGhUbKKc8hF6PIGyqcak8-gg6H8tvrnbVtMaW2GqcOXgoIn_yCH2H2D6plF3KBlu0NG4aW8QpFWkO2Zd0O3Oudjg3nPLIgJyA"/>
          </div>
          <div className="text-left">
          <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest">Recipient Organization</span>
          <h4 className="text-headline-sm font-headline-sm text-primary">
            {consent.bankId === "ubl-bank-id" ? "UBL Digital Lending" : consent.bankId}
          </h4>
          </div>
          </div>
          <div className="px-4 py-1 bg-primary-container/10 text-primary-container rounded-full text-label-md font-label-md flex items-center">
          <span className="material-symbols-outlined text-sm mr-1" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span> Verified Entity
          </div>
          </div>
          </div>
          {/*  Audit Section  */}
          <div className="w-full bg-surface-container p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 mb-12">
          <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant">history_edu</span>
          <span className="text-body-md text-on-surface">Audit Reference: <code className="bg-surface-container-highest px-2 py-0.5 rounded text-primary font-mono">{consent.ledgerHash ? consent.ledgerHash.substring(0, 16) + "..." : "VT-GENESIS"}</code></span>
          </div>
          <Link href="/audit" className="flex items-center gap-2 text-primary font-label-md hover:underline">
            <span className="material-symbols-outlined text-sm">download</span> View Audit Trail
          </Link>
          </div>
          {/*  Live Access Toggle — calls the real dual-write revoke endpoint;
                never writes to Firestore directly.  */}
          <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
            <div className="text-left">
              <p className="text-body-md font-semibold text-on-surface">Live Access</p>
              <p className="text-label-sm text-on-surface-variant">
                {consent.status === "REVOKED"
                  ? "This bank can no longer view your data."
                  : `${consent.bankId === "ubl-bank-id" ? "UBL Digital Lending" : consent.bankId} can currently view your consented data.`}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={consent.status !== "REVOKED"}
              aria-label="Toggle bank access"
              disabled={revoking || consent.status === "REVOKED"}
              onClick={handleToggleRevoke}
              className={`relative w-14 h-8 shrink-0 rounded-full transition-colors ${
                consent.status === "REVOKED" ? "bg-outline-variant" : "bg-primary"
              } ${revoking ? "opacity-60 cursor-wait" : consent.status === "REVOKED" ? "cursor-default" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform flex items-center justify-center ${
                  consent.status === "REVOKED" ? "" : "translate-x-6"
                }`}
              >
                {revoking && (
                  <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                )}
              </span>
            </button>
          </div>

          {revoking && (
            <p className="flex items-center gap-2 text-label-sm text-secondary mb-6">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Submitting revocation to the ledger and Solana devnet — this can take a few seconds...
            </p>
          )}

          {revokeError && (
            <div className="w-full max-w-md mb-6 p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2 text-left">
              <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
              <p className="text-body-sm text-error">{revokeError}</p>
            </div>
          )}

          {/*  Primary Actions  */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link href="/profile">
            <button className="px-8 py-4 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all">
              View income profile
            </button>
          </Link>
          <Link href="/consent/manage">
            <button className="px-8 py-4 border-2 border-secondary text-secondary rounded-lg font-label-md text-label-md hover:bg-secondary/5 transition-all">
              Manage consent
            </button>
          </Link>
          </div>
          {consent.status !== "REVOKED" && (
            <div className="flex items-center gap-2 text-on-surface-variant/70 italic text-body-sm">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>Toggling off Live Access above revokes it immediately — this cannot be undone from here.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto py-24 px-gutter flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center mb-6 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl">gavel</span>
          </div>
          <h3 className="text-headline-md font-headline-md text-on-surface mb-2">No Active Consent Policy</h3>
          <p className="text-body-md text-on-surface-variant max-w-md mb-8">
            You haven&apos;t shared your verifiable income profile with any banking institution yet.
          </p>
          <Link href="/consent/setup">
            <button className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all active:scale-95">
              <span className="material-symbols-outlined">add</span>
              Set up new consent policy
            </button>
          </Link>
        </div>
      )}
      </main>

      </div>
    </>
  );
}
