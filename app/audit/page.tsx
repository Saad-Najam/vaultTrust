"use client";

import React, { useState, useEffect } from "react";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import UserAvatar from "@/components/UserAvatar";
import { fetchWithAuth } from "@/lib/fetch_client";
import type { VerifiedLedgerEntry } from "@/lib/api_types";

/** The ledger stores no actor column; the event type implies who acted. */
const ACTOR_BY_EVENT: Record<string, string> = {
  GRANT: "Freelancer",
  SCOPE_CHANGE: "Freelancer",
  REVOKE: "Freelancer",
  BANK_ACCESS: "Bank Officer",
};

export default function Page() {
  const [ledger, setLedger] = useState<VerifiedLedgerEntry[]>([]);
  const [verified, setVerified] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<VerifiedLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const res = await fetchWithAuth("/api/v1/audit/ledger");
        const data = await res.json();
        if (data.success) {
          setLedger(data.ledger);
          setVerified(data.verified);
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

  return (
    <>
      {/*  Predicted Component: SideNavBar  */}
      
      <FreelancerSidebar />

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
      <button className="hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-full p-2 transition-opacity active:opacity-80">
      <span className="material-symbols-outlined text-on-surface-variant" data-icon="notifications">notifications</span>
      </button>
      <UserAvatar size="w-8 h-8" />
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
      <button className="flex items-center gap-2 px-4 py-2 border border-outline rounded-xl text-label-md hover:bg-surface-container transition-all">
      <span className="material-symbols-outlined text-[18px]" data-icon="filter_list">filter_list</span>
                                  Filter
                               </button>
      <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-label-md hover:shadow-lg transition-all">
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
      <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Consent ID</th>
      <th className="px-6 py-4 font-label-md text-label-sm uppercase tracking-wider">Hash Ref</th>
      </tr>
      </thead>
      <tbody className="divide-y divide-surface-container text-on-surface">
      {ledger.map((block) => {
        const date = new Date(block.timestamp);
        const isSelected = selectedBlock?.id === block.id;
        return (
          <tr 
            key={block.id} 
            className={`hover:bg-surface-container-low transition-colors cursor-pointer group ${isSelected ? 'bg-primary/5 border-l-4 border-primary' : ''}`} 
            onClick={() => setSelectedBlock(block)}
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
      {ledger.length === 0 && !loading && (
        <tr>
          <td colSpan={5} className="px-8 py-10 text-center italic text-on-surface-variant text-body-md">
            No entries found in the audit trail.
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
          <button className="w-full py-4 border-2 border-primary text-primary rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-all">
          <span className="material-symbols-outlined" data-icon="description">description</span>
                                  Verify Chain Integrity
                              </button>
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
