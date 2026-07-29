"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import { fetchWithAuth } from "@/lib/fetch_client";

export default function Page() {
  const [reliability, setReliability] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReliability = async () => {
      try {
        const res = await fetchWithAuth("/api/v1/profile/reliability");
        const data = await res.json();
        if (data.success) {
          setReliability(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReliability();
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

  const ivs = reliability?.scores?.ivs || 0;
  const strokeDashoffset = 251.2 - (251.2 * ivs) / 100;

  return (
    <>
      <FreelancerSidebar />
      {/*  Main Content Canvas  */}
      <main className="ml-64 min-h-screen animate-fade-in">
      {/*  TopAppBar Execution  */}
      <header className="flex justify-between items-center w-full px-margin-desktop h-16 bg-surface-container-lowest dark:bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sticky top-0 z-40">
      <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Income Profile</h2>
      <div className="flex items-center gap-4">
      <button className="hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-full p-2 transition-opacity active:opacity-80">
      <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
      </button>
      <div className="h-8 w-8 rounded-full bg-primary-fixed overflow-hidden ring-2 ring-primary/10">
      <img className="w-full h-full object-cover" data-alt="A professional close-up portrait of a freelancer in their late 20s, with a soft-focus office background. The lighting is clean and institutional, with a calm, trust-evoking expression. The image color palette matches the deep greens and mint tones of the VaultTrust brand for a cohesive identity." src="https://lh3.googleusercontent.com/aida-public/AB6AXuASpHMZOEB8JHuADjq8shr6na23FCYrctTdBpgoBmmWSnoMggSmjRGIIzJQ_9VQ9rdGRZCEpEkyVNGemErNxH-yFyzFjKuLJyNg85YFdNwvlArMSTcCnKIwgI_WZZkuzIobWajCilYaSHwnMqZdPfmqh7AGFDEywyw2TqbnEEPkPjGSQoWHYvqexn2Ehz7kTD-4TqeDo40764nGi8X2SJLAf0ScZkXiMloxDvtprqoWo5inKQuXPdKKWQ"/>
      </div>
      </div>
      </header>
      {/*  Canvas Body  */}
      <div className="p-stack-lg max-w-container-max mx-auto">
      {/*  Bento Grid Layout  */}
      <div className="grid grid-cols-12 gap-gutter">
      {/*  Score Card & Gauge (Major Section)  */}
      <section className="col-span-12 lg:col-span-7 space-y-gutter">
      <div className="bg-surface-container-lowest rounded-card p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] relative overflow-hidden group">
      {/*  Decorative background texture  */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
      <span className="material-symbols-outlined text-[120px]">shield_person</span>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-stack-lg">
      <div className="flex flex-col items-center">
      <div className="gauge-container relative w-48 h-24">
      <svg className="w-full h-full" viewBox="0 0 200 100">
      <path className="stroke-surface-container-highest" d="M20,90 A80,80 0 0,1 180,90" fill="none" strokeWidth="16" strokeLinecap="round"></path>
      <path className="stroke-primary" d="M20,90 A80,80 0 0,1 180,90" fill="none" strokeWidth="16" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={strokeDashoffset}></path>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
      <span className="text-headline-lg font-headline-lg text-primary">{ivs}</span>
      <span className="text-label-sm font-label-sm text-secondary uppercase tracking-widest">Trust Score</span>
      </div>
      </div>
      <div className="mt-4 px-4 py-1 bg-primary/5 rounded-full">
      <span className="text-primary font-bold text-body-md">Score {ivs} - {ivs >= 80 ? "Exceptional" : ivs >= 60 ? "Strong" : "Moderate"}</span>
      </div>
      </div>
      <div className="flex-1 space-y-stack-md">
      <h3 className="text-headline-sm font-headline-sm text-primary">Financial Reliability</h3>
      <p className="text-body-md text-on-surface-variant leading-relaxed">
        Your profile demonstrates {ivs >= 80 ? "exceptional" : ivs >= 60 ? "strong" : "stable"} reliability. This score indicates a high likelihood of consistent future earnings based on historical freelancer platform data.
      </p>
      <div className="flex items-start gap-2 p-3 bg-surface-container rounded-xl">
      <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">info</span>
      <p className="text-body-sm text-on-surface-variant italic">
        Score is calculated on-chain using multi-channel mathematical modeling.
      </p>
      </div>
      </div>
      </div>
      </div>
      {/*  Metric Cards Sub-grid  */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
      {/*  Avg Income  */}
      <div className="bg-surface-container-lowest p-stack-md rounded-card shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border-l-4 border-primary">
      <div className="flex justify-between items-start">
      <div>
      <p className="text-label-sm font-label-sm text-on-surface-variant">Average Monthly</p>
      <h4 className="text-headline-sm font-headline-sm text-primary mt-1">
        PKR {reliability?.scores?.avgMonthlyIncome?.toLocaleString() || "0"}
      </h4>
      </div>
      <span className="material-symbols-outlined text-primary bg-primary/5 p-2 rounded-lg">account_balance_wallet</span>
      </div>
      <div className="mt-4 flex items-center gap-1 text-primary text-label-sm">
      <span className="material-symbols-outlined text-sm">trending_up</span>
      <span>Calculated over last 6 months</span>
      </div>
      </div>
      {/*  Consistency  */}
      <div className="bg-surface-container-lowest p-stack-md rounded-card shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border-l-4 border-secondary">
      <div className="flex justify-between items-start">
      <div>
      <p className="text-label-sm font-label-sm text-on-surface-variant">Consistency Rank</p>
      <h4 className="text-headline-sm font-headline-sm text-secondary mt-1">
        {reliability?.scores?.consistency ? (reliability.scores.consistency * 100).toFixed(0) : "0"}% Stable
      </h4>
      </div>
      <span className="material-symbols-outlined text-secondary bg-secondary/5 p-2 rounded-lg">rebase_edit</span>
      </div>
      <p className="mt-4 text-body-sm text-on-surface-variant">Low variance in monthly earnings.</p>
      </div>
      {/*  Trend  */}
      <div className="bg-surface-container-lowest p-stack-md rounded-card shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border-l-4 border-tertiary">
      <div className="flex justify-between items-start">
      <div>
      <p className="text-label-sm font-label-sm text-on-surface-variant">Income Velocity</p>
      <h4 className="text-headline-sm font-headline-sm text-tertiary mt-1">
        {reliability?.scores?.trend || "STABLE"}
      </h4>
      </div>
      <span className="material-symbols-outlined text-tertiary bg-tertiary/5 p-2 rounded-lg">show_chart</span>
      </div>
      <p className="mt-4 text-body-sm text-on-surface-variant">Computed using linear regression slope.</p>
      </div>
      {/*  Diversity  */}
      <div className="bg-surface-container-lowest p-stack-md rounded-card shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border-l-4 border-on-primary-container">
      <div className="flex justify-between items-start">
      <div>
      <p className="text-label-sm font-label-sm text-on-surface-variant">Income Sources</p>
      <h4 className="text-headline-sm font-headline-sm text-on-primary-fixed-variant mt-1">
        {reliability?.scores?.diversity ? `Score ${Math.round(reliability?.scores?.diversity * 100)}` : "High Diversity"}
      </h4>
      </div>
      <span className="material-symbols-outlined text-on-primary-fixed-variant bg-on-primary-container/10 p-2 rounded-lg">hub</span>
      </div>
      <p className="mt-4 text-body-sm text-on-surface-variant">Spread across multiple channels.</p>
      </div>
      </div>
      </section>
      {/*  Right Column: "What the Bank Sees"  */}
      <section className="col-span-12 lg:col-span-5 space-y-gutter">
        <div className="bg-surface-container-lowest p-8 rounded-card shadow-lg border border-outline-variant/30">
          <h4 className="text-headline-sm font-headline-sm text-primary mb-2">What the Bank Sees</h4>
          <p className="text-body-sm text-on-surface-variant mb-6">
            Demonstration of data minimization. Banks do not see raw transactions or private client identities.
          </p>
          <div className="space-y-6">
            <div className="p-4 bg-surface-container rounded-xl">
              <span className="text-label-sm font-bold text-on-surface-variant block mb-1">Freelancer Name</span>
              <p className="text-body-md font-bold text-on-surface">{reliability?.userName || "Ahmed Raza"}</p>
            </div>
            <div className="p-4 bg-surface-container rounded-xl">
              <span className="text-label-sm font-bold text-on-surface-variant block mb-1">IVS Verification Score</span>
              <div className="flex items-center gap-2">
                <span className="text-headline-md font-bold text-primary">{ivs}</span>
                <span className="text-body-sm bg-primary/10 text-primary px-3 py-0.5 rounded-full font-bold">EXCEPTIONAL GRADE</span>
              </div>
            </div>
            <div className="p-4 bg-surface-container rounded-xl">
              <span className="text-label-sm font-bold text-on-surface-variant block mb-1">Verified Average Monthly Income</span>
              <p className="text-headline-sm font-bold text-on-surface">PKR {reliability?.scores?.avgMonthlyIncome?.toLocaleString() || "0"}</p>
            </div>
            <div className="p-4 bg-surface-container rounded-xl border border-dashed border-outline">
              <span className="text-label-sm font-bold text-error block mb-1">🔒 Locked / Restricted Data</span>
              <p className="text-body-sm text-on-surface-variant">Raw transaction history &amp; statement line items are suppressed.</p>
            </div>
          </div>
        </div>
      </section>

      </div>
      </div>
      </main>
      {/*  FAB Suppression Rule: Hide on Detail Screens (per prompt instructions, we focus on profile view, but usually suppressed on details)  */}
      {/*  However, we want 'Manage Consent' as an action, so we use a prominent bottom action bar for mobile or fixed action  */}
      <div className="fixed bottom-8 right-8 md:hidden">
      <button className="bg-primary text-white p-4 rounded-full shadow-2xl flex items-center justify-center">
      <span className="material-symbols-outlined">manage_accounts</span>
      </button>
      </div>
    </>
  );
}
