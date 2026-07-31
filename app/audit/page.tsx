"use client";

import React, { useState, useEffect, useRef } from "react";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import BankSidebar from "@/components/BankSidebar";
import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/NotificationBell";
import { fetchWithAuth } from "@/lib/fetch_client";
import { toCsvRow, downloadTextFile } from "@/lib/download";
import { useRole } from "@/lib/use_role";
import type { VerifiedLedgerEntry, VerificationResponse } from "@/lib/api_types";

/** The ledger stores no actor column; the event type implies who acted. */
const ACTOR_BY_EVENT: Record<string, string> = {
  GRANT: "Freelancer",
  SCOPE_CHANGE: "Freelancer",
  REVOKE: "Freelancer",
  BANK_ACCESS: "Bank Officer",
};

const EVENT_TYPES = ["ALL", "GRANT", "SCOPE_CHANGE", "REVOKE", "BANK_ACCESS"] as const;
type EventTypeFilter = (typeof EVENT_TYPES)[number];

export default function Page() {
  // Role comes from the ID token claim, not a /profile/me fetch: a network
  // failure there would leave role null and silently render the freelancer
  // portal to a bank officer.
  const { role, loading: roleLoading } = useRole();
  const isBankOfficer = role === "BANK_OFFICER";
  const [ledger, setLedger] = useState<VerifiedLedgerEntry[]>([]);
  const [applicantNames, setApplicantNames] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<VerifiedLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationResponse | null>(null);

  // Re-runs the real chain check for the selected block's consent: recomputes
  // the SHA-256 hash chain server-side and compares it against the on-chain
  // Solana record, rather than trusting the `verified` flag already in state.
  const handleVerifyChain = async () => {
    if (!selectedBlock?.consentId || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetchWithAuth(`/api/v1/consent/${selectedBlock.consentId}/verify`);
      const data: VerificationResponse = await res.json();
      setVerifyResult(data);
    } catch (err) {
      console.error("[Audit] Verify chain failed:", err);
      setVerifyResult({ success: false, error: "Could not reach the server. Please try again." });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!filterOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [filterOpen]);

  const filteredLedger = eventTypeFilter === "ALL" ? ledger : ledger.filter((b) => b.eventType === eventTypeFilter);

  const handleExportReport = () => {
    const header = toCsvRow([
      "Date",
      "Time",
      "Event",
      "Actor",
      ...(isBankOfficer ? ["Applicant"] : []),
      "Consent ID",
      "Previous Hash",
      "This Hash",
      "Verified",
    ]);
    const rows = filteredLedger.map((block) => {
      const date = new Date(block.timestamp);
      return toCsvRow([
        date.toLocaleDateString("en-GB"),
        date.toLocaleTimeString(),
        block.eventType,
        ACTOR_BY_EVENT[block.eventType] || "System Auth",
        ...(isBankOfficer ? [applicantNames[block.consentId] || ""] : []),
        block.consentId ? `VT-${block.consentId.substring(0, 6).toUpperCase()}` : "",
        block.prevHash || "GENESIS",
        block.thisHash || "",
        block.verified ? "Yes" : "No",
      ]);
    });
    downloadTextFile(
      `vaulttrust-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows].join("\n")
    );
  };

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const res = await fetchWithAuth("/api/v1/audit/ledger");
        const data = await res.json();
        if (data.success) {
          setLedger(data.ledger);
          setVerified(data.verified);
          setApplicantNames(data.applicantNames || {});
          if (data.ledger && data.ledger.length > 0) {
            setSelectedBlock(data.ledger[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, []);

  if (roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      {/*  Predicted Component: SideNavBar  */}

      {isBankOfficer ? <BankSidebar /> : <FreelancerSidebar />}

      {/*  Predicted Component: TopAppBar  */}
      <header className="flex justify-between items-center w-full pl-16 pr-5 lg:px-margin-desktop h-16 lg:ml-64 lg:max-w-[calc(100%-16rem)] bg-surface-container-lowest dark:bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] fixed top-0 z-40">
      <div className="flex items-center gap-4">
      <span className="text-headline-sm font-headline-sm font-bold text-primary dark:text-primary-fixed">Audit Ledger</span>
      
      {verified ? (
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/10">
        <span className="material-symbols-outlined text-primary text-[16px] animate-pulse" data-icon="verified" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
        <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Ledger integrity verified</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-error/10 px-3 py-1 rounded-full border border-error/20">
        <span className="material-symbols-outlined text-error text-[16px] animate-bounce" data-icon="warning" style={{"fontVariationSettings":"'FILL' 1"}}>warning</span>
        <span className="text-[12px] font-bold text-error uppercase tracking-wider">TAMPER DETECTION WARNING</span>
        </div>
      )}
      </div>
      <div className="flex items-center gap-4">
      <NotificationBell />
      <UserAvatar size="w-8 h-8" href={isBankOfficer ? null : "/settings"} />
      </div>
      </header>
      {/*  Main Content Canvas  */}
      <main className="lg:ml-64 mt-16 p-5 lg:p-stack-lg min-h-screen flex flex-col lg:flex-row gap-stack-lg bg-surface animate-fade-in">
      {/*  Audit Timeline & Table Section  */}
      <div className="flex-grow space-y-6">
      <div className="glass-card bg-surface-container-lowest rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-8 py-6 border-b border-surface-container flex justify-between items-center bg-white/50">
      <div>
      <h2 className="text-headline-sm font-headline-sm text-primary">Immutable Activity Log</h2>
      <p className="text-body-sm text-on-surface-variant">Real-time tracking of all data access and account mutations.</p>
      </div>
      <div className="flex gap-2">
      <div className="relative" ref={filterRef}>
      <button
        onClick={() => setFilterOpen((o) => !o)}
        aria-expanded={filterOpen}
        className="flex items-center gap-2 px-4 py-2 border border-outline rounded-xl text-label-md hover:bg-surface-container transition-all"
      >
      <span className="material-symbols-outlined text-[18px]" data-icon="filter_list">filter_list</span>
                                  Filter{eventTypeFilter !== "ALL" ? `: ${eventTypeFilter.replace("_", " ")}` : ""}
                               </button>
      {filterOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-[0px_12px_32px_rgba(0,0,0,0.12)] border border-outline-variant/30 py-2 z-50">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => {
                setEventTypeFilter(type);
                setFilterOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-body-sm hover:bg-surface-container transition-colors ${
                eventTypeFilter === type ? "text-primary font-bold" : "text-on-surface"
              }`}
            >
              {type === "ALL" ? "All events" : type.replace("_", " ")}
            </button>
          ))}
        </div>
      )}
      </div>
      <button
        onClick={handleExportReport}
        disabled={filteredLedger.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-label-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
      <span className="material-symbols-outlined text-[18px]" data-icon="download">download</span>
                                  Export Report
                               </button>
      </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
      <thead>
      <tr className="bg-surface-container-low text-on-surface-variant">
      <th className="px-8 py-4 font-label-md text-label-sm uppercase tracking-wider">Date &amp; Time</th>
      <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Event</th>
      <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Actor</th>
      {isBankOfficer && (
        <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Applicant</th>
      )}
      <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Consent ID</th>
      <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Hash Ref</th>
      </tr>
      </thead>
      <tbody className="divide-y divide-surface-container text-on-surface">
      {filteredLedger.map((block) => {
        const date = new Date(block.timestamp);
        const isSelected = selectedBlock?.id === block.id;
        return (
          <tr 
            key={block.id} 
            className={`hover:bg-surface-container-low transition-colors cursor-pointer group ${isSelected ? 'bg-primary/5 border-l-4 border-primary' : ''}`} 
            onClick={() => {
              setSelectedBlock(block);
              // Otherwise a previous block's verdict would linger in the drawer.
              setVerifyResult(null);
            }}
          >
            <td className="px-8 py-5">
              <div className="font-bold text-body-sm">{date.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"})}</div>
              <div className="text-[12px] opacity-60">{date.toLocaleTimeString()}</div>
            </td>
            <td className="px-6 py-5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  block.eventType === 'REVOKE' ? 'bg-error' :
                  block.eventType === 'GRANT' ? 'bg-primary' :
                  block.eventType === 'SCOPE_CHANGE' ? 'bg-secondary' : 'bg-tertiary'
                }`}></span>
                <span className="font-medium text-body-sm">{block.eventType}</span>
              </div>
            </td>
            <td className="px-6 py-5 text-body-sm">{ACTOR_BY_EVENT[block.eventType] || "System Auth"}</td>
            {isBankOfficer && (
              <td className="px-6 py-5 text-body-sm">{applicantNames[block.consentId] || "—"}</td>
            )}
            <td className="px-6 py-5 text-body-sm font-mono text-secondary">
              {block.consentId ? `#VT-${block.consentId.substring(0, 6).toUpperCase()}` : "---"}
            </td>
            <td className="px-6 py-5">
              <span className="text-[12px] font-mono bg-surface-container px-2 py-1 rounded opacity-70">
                {block.thisHash?.substring(0, 8) || "—"}
              </span>
            </td>
          </tr>
        );
      })}
      {filteredLedger.length === 0 && !loading && (
        <tr>
          <td colSpan={isBankOfficer ? 6 : 5} className="px-8 py-10 text-center italic text-on-surface-variant text-body-md">
            {ledger.length === 0
              ? "No entries found in the audit trail."
              : `No ${eventTypeFilter.replace("_", " ").toLowerCase()} events found.`}
          </td>
        </tr>
      )}
      </tbody>
      </table>
      </div>
      </div>
      <footer className="flex items-center gap-4 p-6 bg-surface-container-low rounded-[20px] border border-outline-variant/30">
      <div className="p-3 bg-white rounded-xl shadow-sm">
      <span className="material-symbols-outlined text-secondary" data-icon="lock" style={{"fontVariationSettings":"'FILL' 1"}}>lock</span>
      </div>
      <p className="text-body-sm text-on-surface-variant font-medium">
                          Cryptographically linked events for tamper-evident security. Every entry in this ledger is hashed and chained to the previous block, ensuring total historical integrity.
                      </p>
      </footer>
      </div>
      {/*  Detail Drawer (Static Layout Representation)  */}
      <aside className="w-96 flex-shrink-0">
      {selectedBlock ? (
        <div className="glass-card bg-surface-container-lowest rounded-[24px] shadow-[0px_12px_32px_rgba(0,74,59,0.08)] sticky top-24 overflow-hidden border border-primary/10">
          <div className="bg-primary p-6 text-on-primary">
          <div className="flex items-center justify-between mb-4">
          <span className="text-label-sm uppercase tracking-widest opacity-80">Block Detail</span>
          </div>
          <h3 className="text-headline-sm font-headline-sm">Block {selectedBlock.id}</h3>
          <p className="text-body-sm opacity-90 mt-1">{selectedBlock.eventType}</p>
          </div>
          <div className="p-6 space-y-6">
          <div>
          <label className="text-label-sm font-label-md text-on-surface-variant block mb-2">Cryptographic Proof</label>
          <div className="space-y-3">
          <div className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/40">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Previous Hash</span>
          <p className="text-[12px] font-mono break-all text-secondary">{selectedBlock.prevHash || "GENESIS"}</p>
          </div>
          <div className="bg-surface-container-low p-3 rounded-xl border border-secondary/20">
          <span className="text-[10px] font-bold text-secondary uppercase block mb-1">Current Hash</span>
          <p className="text-[12px] font-mono break-all text-primary font-bold">{selectedBlock.thisHash}</p>
          </div>
          </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
          <div>
          <label className="text-label-sm font-label-md text-on-surface-variant block mb-1">Timestamp</label>
          <p className="text-body-sm font-bold">{new Date(selectedBlock.timestamp).toLocaleDateString()}</p>
          </div>
          <div>
          <label className="text-label-sm font-label-md text-on-surface-variant block mb-1">Actor</label>
          <p className="text-body-sm font-bold">{ACTOR_BY_EVENT[selectedBlock.eventType] || "System"}</p>
          </div>
          </div>
          <div>
          <label className="text-label-sm font-label-md text-on-surface-variant block mb-2">Payload Summary</label>
          <pre className="bg-inverse-surface text-white p-4 rounded-xl text-[12px] font-mono leading-relaxed overflow-x-auto">
            {JSON.stringify(
              {
                eventType: selectedBlock.eventType,
                payloadHash: selectedBlock.payloadHash,
                prevHash: selectedBlock.prevHash,
                thisHash: selectedBlock.thisHash,
                verified: selectedBlock.verified,
                ...(selectedBlock.reason ? { reason: selectedBlock.reason } : {}),
              },
              null,
              2
            )}
          </pre>
          </div>
          <button
            onClick={handleVerifyChain}
            disabled={verifying || !selectedBlock.consentId}
            className="w-full py-4 border-2 border-primary text-primary rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
          <span className={`material-symbols-outlined ${verifying ? "animate-spin" : ""}`} data-icon="description">
            {verifying ? "progress_activity" : "description"}
          </span>
                                  {verifying ? "Verifying..." : "Verify Chain Integrity"}
                              </button>

          {verifyResult && (
            <div className="mt-4">
              {!verifyResult.success ? (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <p className="text-body-sm text-error">{verifyResult.error || "Verification failed."}</p>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-xl border ${
                    verifyResult.status === "VERIFIED"
                      ? "bg-primary/5 border-primary/20"
                      : verifyResult.status === "TAMPERED"
                        ? "bg-error/10 border-error/20"
                        : "bg-secondary/10 border-secondary/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        verifyResult.status === "VERIFIED"
                          ? "text-primary"
                          : verifyResult.status === "TAMPERED"
                            ? "text-error"
                            : "text-secondary"
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {verifyResult.status === "VERIFIED"
                        ? "verified"
                        : verifyResult.status === "TAMPERED"
                          ? "warning"
                          : "schedule"}
                    </span>
                    <span
                      className={`text-label-md font-bold ${
                        verifyResult.status === "VERIFIED"
                          ? "text-primary"
                          : verifyResult.status === "TAMPERED"
                            ? "text-error"
                            : "text-secondary"
                      }`}
                    >
                      {verifyResult.status === "VERIFIED"
                        ? "Chain verified"
                        : verifyResult.status === "TAMPERED"
                          ? "Tamper detected"
                          : "Local ledger verified"}
                    </span>
                  </div>

                  {verifyResult.localLedger && (
                    <p className="text-label-sm text-on-surface-variant mb-1">
                      Local hash chain: {verifyResult.localLedger.entryCount} block
                      {verifyResult.localLedger.entryCount === 1 ? "" : "s"} recomputed —{" "}
                      {verifyResult.localLedger.intact ? "intact" : "BROKEN"}
                    </p>
                  )}
                  <p className="text-label-sm text-on-surface-variant mb-1">
                    On-chain record: {verifyResult.onChain ? `found (${verifyResult.onChain.status})` : "not yet confirmed"}
                  </p>

                  {verifyResult.reasons && verifyResult.reasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {verifyResult.reasons.map((reason, i) => (
                        <li key={i} className="text-[12px] text-on-surface-variant leading-relaxed">
                          • {reason}
                        </li>
                      ))}
                    </ul>
                  )}

                  {verifyResult.timestamp && (
                    <p className="text-[11px] text-on-surface-variant/70 mt-3">
                      Checked {new Date(verifyResult.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="glass-card bg-surface-container-lowest p-6 rounded-card border border-outline-variant/30 text-center text-on-surface-variant italic text-body-sm">
          Select a block to inspect cryptography details.
        </div>
      )}
      {/*  Atmosphere Element: Visual confirmation of security  */}
      <div className="mt-6 bg-surface-container-lowest glass-card p-6 rounded-[24px] border border-outline-variant/30 relative overflow-hidden">
      
      <div className="relative z-10">
      <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-primary-container/10 flex items-center justify-center">
      <span className="material-symbols-outlined text-primary" data-icon="security" style={{"fontVariationSettings":"'FILL' 1"}}>security</span>
      </div>
      <h4 className="font-bold text-body-md">Audit Score: {verified ? "100/100" : "0/100"}</h4>
      </div>
      <p className="text-[13px] text-on-surface-variant leading-relaxed">
        {verified ? "No unauthorized modifications detected. All events match the blockchain-backed global consensus hash." : "TAMPER DETECTION: Validation hashes do not match the expected SHA-256 chain links!"}
      </p>
      </div>
      </div>
      </aside>
      </main>
    </>
  );
}
