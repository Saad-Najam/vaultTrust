"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import { normalizeAmountToPKR } from "@/lib/scoring";
import { fetchWithAuth } from "@/lib/fetch_client";
import { useCurrentUser } from "@/lib/use_current_user";
import { PLATFORMS, PLATFORM_META } from "@/lib/platforms";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [reliability, setReliability] = useState<any>(null);
  const [consent, setConsent] = useState<any>(null);
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

  const monthlyAggregates = summary?.monthlyAggregates || [];
  const maxTotal = Math.max(...monthlyAggregates.map((m: any) => m.totalPKR), 1);
  const connectedSourcesCount = summary?.connectedSources?.filter((s: any) => s.status === "CONNECTED").length || 0;

  // Only chart/legend the platforms this freelancer actually earned through,
  // so the legend doesn't list six providers for someone using two.
  const activePlatforms = PLATFORMS.filter((p) =>
    monthlyAggregates.some((m: any) => (m.byPlatform?.[p] || 0) > 0)
  );
  const sourceMix = summary?.sourceMix || {};

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
      <button className="relative hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-full p-2 transition-opacity active:opacity-80">
      <span className="material-symbols-outlined text-on-surface-variant" data-icon="notifications">notifications</span>
      <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
      </button>
      <button className="hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-full p-2 transition-opacity active:opacity-80">
      <span className="material-symbols-outlined text-on-surface-variant" data-icon="verified">verified</span>
      </button>
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
      <button className="flex items-center gap-2 px-6 py-3 border border-outline text-primary rounded-full font-bold hover:bg-surface-container transition-all">
      <span className="material-symbols-outlined" data-icon="download">download</span>
                              Export Statement
                           </button>
      <button className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold hover:shadow-xl transition-all">
      <span className="material-symbols-outlined" data-icon="share">share</span>
                              Share Profile
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
        {consent ? (consent.scopeDuration === "ROLLING_6MO" ? "6 mo. rolling" : "One-time") : "Not shared"}
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
      {monthlyAggregates.map((month: any, idx: number) => {
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
              {PLATFORMS.map((platform, pIdx) => {
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
      {(() => {
        const C = 2 * Math.PI * 80;
        let offset = 0;
        return activePlatforms.map((platform) => {
          const arc = ((sourceMix[platform] || 0) / 100) * C;
          const el = (
            <circle
              key={platform}
              className="transition-all duration-1000"
              cx="96"
              cy="96"
              fill="transparent"
              r="80"
              stroke={PLATFORM_META[platform].color}
              strokeDasharray={`${arc} ${C - arc}`}
              strokeDashoffset={-offset}
              strokeWidth="18"
            ></circle>
          );
          offset += arc;
          return el;
        });
      })()}
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
      {/*  Activity & Ledger Section  */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/*  Activity Feed  */}
      <div className="bg-surface-container-lowest p-8 rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-6">
      <h4 className="text-headline-sm font-headline-sm text-primary">Recent Transactions</h4>
      <Link href="/profile" className="text-primary text-label-md font-bold hover:underline">View All</Link>
      </div>
      <div className="space-y-6">
      {(summary?.recentTransactions || []).slice(0, 3).map((tx: any) => (
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
