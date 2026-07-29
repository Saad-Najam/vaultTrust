"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetch_client";
import FreelancerSidebar from "@/components/FreelancerSidebar";

export default function Page() {
  const router = useRouter();
  const [sources, setSources] = useState({
    PAYONEER: true,
    BANK_TRANSFER: true,
    LOCAL_INVOICING: false,
  });
  const [duration, setDuration] = useState<"ONE_TIME" | "ROLLING_6MO">("ROLLING_6MO");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggle = (platform: "PAYONEER" | "BANK_TRANSFER" | "LOCAL_INVOICING") => {
    setSources((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  const handleGrant = async () => {
    setLoading(true);
    setErrorMessage(null);
    const activeSources = Object.keys(sources).filter(
      (key) => sources[key as keyof typeof sources]
    );
    try {
      const res = await fetchWithAuth("/api/v1/consent/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: activeSources,
          scopeDuration: duration,
          purpose: "Credit card and personal financing assessment",
          bankId: "ubl-bank-id",
        }),
      });

      // Even a network-level failure to reach our own API (not Solana) should
      // never silently disappear — surface it clearly rather than throwing
      // inside res.json() with no context.
      let data: any;
      try {
        data = await res.json();
      } catch {
        setErrorMessage("The server returned an unexpected response. Please try again in a moment.");
        return;
      }

      if (data.success) {
        // The ledger write is always guaranteed to have succeeded here —
        // blockchain confirmation is best-effort and never blocks this step,
        // so a pending/failed chain write is not a reason to alarm the user.
        router.push("/consent/active");
      } else {
        setErrorMessage(data.error || "Failed to grant consent. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Could not reach the server. Check your connection and try again — no changes were saved."
      );
    } finally {
      setLoading(false);
    }
  };

  const [consentActive, setConsentActive] = useState(true);
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
      
            <div className="block lg:hidden">
              {/*  Top Navigation (Shell suppressed for focused task as per mandate)  */}
              <header className="sticky top-0 z-50 bg-surface-container-lowest/80 backdrop-blur-md px-margin-mobile py-4 flex items-center justify-between shadow-sm">
              <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-on-surface">arrow_back</span>
              </button>
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight">VaultTrust</span>
              <div className="w-10"></div> {/*  Spacer for balance  */}
              </header>
              <main className="flex-1 px-margin-mobile pt-stack-lg pb-32 max-w-lg mx-auto w-full">
              {/*  Step Indicator  */}
              <div className="flex items-center justify-between mb-stack-lg">
              <div className="flex flex-col items-center flex-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-on-primary font-label-md text-label-md mb-2">1</div>
              <span className="text-label-sm font-label-sm text-primary">Details</span>
              </div>
              <div className="h-[2px] flex-1 bg-primary mb-6"></div>
              <div className="flex flex-col items-center flex-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-on-primary font-label-md text-label-md mb-2">2</div>
              <span className="text-label-sm font-label-sm text-primary">Sources</span>
              </div>
              <div className="h-[2px] flex-1 bg-outline-variant mb-6"></div>
              <div className="flex flex-col items-center flex-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-outline-variant text-outline font-label-md text-label-md mb-2">3</div>
              <span className="text-label-sm font-label-sm text-outline">Review</span>
              </div>
              </div>
              {/*  Purpose Header  */}
              <section className="mb-stack-lg">
              <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface mb-stack-sm">Configure Consent</h1>
              <p className="text-body-md font-body-md text-on-surface-variant">Setup your institutional data sharing for <span className="font-bold text-on-surface">UBL Digital</span> home loan application.</p>
              </section>
              {/*  Recipient Info Card  */}
              <div className="glass-card rounded-[24px] p-stack-md flex items-center gap-4 mb-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="w-16 h-16 rounded-xl bg-surface-container-highest flex items-center justify-center overflow-hidden">
              <img className="w-full h-full object-cover" data-alt="A professional corporate logo for a modern bank named UBL Digital, featuring minimalist geometric shapes in deep teal and white, presented on a clean studio background with soft directional lighting to emphasize reliability and security." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAQqB_0cQAhjZIpKKQI8HoLZiG8DgNeU0WxE53ORI_Mt3vblL8OryB9lNmXfqJ52Q8HAx1DfnM9I1C8TQy_bpcfQG6boOUkixHN_N_E7NGl9SVfmGJmzNBjsFzq1f4f5m0P2O24rEVi7ppKx4wdx5jikIiFhg5lGIwnFkxkEazUOf8L3btsQZXN2CPD-NLbOcJavrLTJFqluGKooU7aBouRy3aXMzX05KdavhNRqP6MHviQIJTDXubAA"/>
              </div>
              <div>
              <h3 className="text-headline-sm font-headline-sm text-primary">UBL Digital</h3>
              <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">Institutional Partner</span>
              </div>
              </div>
              </div>
              {/*  Data Sources Selection  */}
              <section className="space-y-stack-md">
              <h2 className="text-label-md font-label-md text-outline uppercase tracking-widest mb-2">Select Data Sources</h2>
              {/*  Source 1  */}
              <label className="flex items-center justify-between p-stack-md bg-surface-container-lowest rounded-[24px] border border-outline-variant/30 active:scale-[0.98] transition-transform cursor-pointer">
              <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" data-icon="account_balance">account_balance</span>
              </div>
              <div>
              <p className="text-body-md font-bold text-on-surface">Transaction History</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant">Past 12 months activity</p>
              </div>
              </div>
              <div className="relative inline-block w-12 h-6 transition duration-200 ease-in">
              <input checked={sources.PAYONEER} onChange={() => handleToggle("PAYONEER")} className="toggle-checkbox absolute block w-0 h-0 opacity-0" type="checkbox"/>
              <div className="toggle-slot block w-full h-full bg-outline-variant rounded-full transition-colors duration-200">
              <div className="toggle-dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200"></div>
              </div>
              </div>
              </label>
              {/*  Source 2  */}
              <label className="flex items-center justify-between p-stack-md bg-surface-container-lowest rounded-[24px] border border-outline-variant/30 active:scale-[0.98] transition-transform cursor-pointer">
              <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" data-icon="payments">payments</span>
              </div>
              <div>
              <p className="text-body-md font-bold text-on-surface">Income Proof</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant">Verified payroll deposits</p>
              </div>
              </div>
              <div className="relative inline-block w-12 h-6 transition duration-200 ease-in">
              <input checked={sources.BANK_TRANSFER} onChange={() => handleToggle("BANK_TRANSFER")} className="toggle-checkbox absolute block w-0 h-0 opacity-0" type="checkbox"/>
              <div className="toggle-slot block w-full h-full bg-outline-variant rounded-full transition-colors duration-200">
              <div className="toggle-dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200"></div>
              </div>
              </div>
              </label>
              {/*  Source 3 (Off by default)  */}
              <label className="flex items-center justify-between p-stack-md bg-surface-container-lowest rounded-[24px] border border-outline-variant/30 active:scale-[0.98] transition-transform cursor-pointer">
              <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" data-icon="home_storage">home_storage</span>
              </div>
              <div>
              <p className="text-body-md font-bold text-on-surface">Asset Portfolio</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant">Stocks and cryptofunds</p>
              </div>
              </div>
              <div className="relative inline-block w-12 h-6 transition duration-200 ease-in">
              <input checked={sources.LOCAL_INVOICING} onChange={() => handleToggle("LOCAL_INVOICING")} className="toggle-checkbox absolute block w-0 h-0 opacity-0" type="checkbox"/>
              <div className="toggle-slot block w-full h-full bg-outline-variant rounded-full transition-colors duration-200">
              <div className="toggle-dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200"></div>
              </div>
              </div>
              </label>
              </section>
              {/*  Summary Section  */}
              <section className="mt-stack-lg p-stack-md bg-surface-container-low rounded-[24px]">
              <h3 className="text-label-md font-label-md text-on-surface mb-stack-sm">Consent Summary</h3>
              <div className="space-y-3">
              {sources.BANK_TRANSFER && (
                <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Sharing <span className="font-bold text-primary">Bank Records</span></p>
                </div>
              )}
              {sources.PAYONEER && (
                <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Sharing <span className="font-bold text-primary">Payoneer Records</span></p>
                </div>
              )}
              {sources.LOCAL_INVOICING && (
                <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Sharing <span className="font-bold text-primary">Local Invoices</span></p>
                </div>
              )}
              {!sources.LOCAL_INVOICING && (
                <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-outline text-[18px]">cancel</span>
                <p className="text-body-sm font-body-sm text-outline">NOT sharing <span className="font-bold">Local Invoices</span></p>
                </div>
              )}
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant/30">
              <div className="flex items-center gap-2 text-tertiary">
              <span className="material-symbols-outlined text-[18px]" style={{"fontVariationSettings":"'FILL' 1"}}>lock</span>
              <p className="text-label-sm font-label-sm">End-to-end encrypted transit</p>
              </div>
              </div>
              </section>
              {/*  Security Badge Animation Placeholder  */}
              <div className="mt-stack-lg relative h-40 rounded-[24px] overflow-hidden bg-primary-container flex items-center justify-center text-on-primary">
              
              <div className="relative z-10 flex flex-col items-center">
              <span className="material-symbols-outlined text-[48px] mb-2" style={{"fontVariationSettings":"'FILL' 0","fontWeight":"200"}}>shield_lock</span>
              <p className="text-label-md font-label-md tracking-widest uppercase">Secure Vault Channel Active</p>
              </div>
              </div>
              </main>
              {/*  Fixed Bottom Button  */}
              <div className="fixed bottom-0 left-0 right-0 p-margin-mobile bg-surface/90 backdrop-blur-xl border-t border-outline-variant/10">
              {errorMessage && (
                <div className="mb-3 p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <p className="text-body-sm text-error">{errorMessage}</p>
                </div>
              )}
              <button disabled={loading} onClick={handleGrant} className="w-full bg-primary-container text-on-primary font-headline-sm py-5 rounded-[20px] shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-75">
              <span>{loading ? "Granting..." : "Grant secure consent"}</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
              <p className="text-center text-label-sm font-label-sm text-on-surface-variant mt-4 opacity-70">
                          By tapping, you agree to the <span className="underline">Digital Data Sharing Act</span> protocols.
                      </p>
              </div>
            </div>
            <div className="hidden lg:block">
              {/*  Sidebar Navigation  */}
              <FreelancerSidebar />
              {/*  Top App Bar  */}
              <header className="flex justify-between items-center w-full px-margin-desktop h-16 ml-64 max-w-[calc(100%-16rem)] bg-surface-container-lowest dark:bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] fixed top-0 z-40">
              <div className="flex items-center gap-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">Identity Verified</span>
              <span className="material-symbols-outlined text-[#D4AF37] text-sm" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
              </div>
              <div className="flex items-center space-x-4">
              <div className="hover:bg-surface-container-high rounded-full p-2 cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary-container/20 overflow-hidden">
              <img className="w-full h-full object-cover" data-alt="A professional headshot of a young creative freelancer in a brightly lit, modern home office. The lighting is soft and natural, emphasizing a clean light-mode aesthetic with teal and deep green accents in the background. The individual is smiling warmly, looking directly at the camera, projecting a sense of reliability and trust for a secure financial platform." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgBikTX1C-PHALwiDFnTXlBV98xvpyyOUaVmxBNhmQu5RfE2xsHxYzf0i84dKd1xlZTwSS-JNijTC56HXzxrxbikNn7LZ12sKoSDmr5ajTD2gHugFJO11ehWFukVnHDaWxZuAYCNl5bmge77nMha_c7bnigQfvGuFnu1V40FNs5bYdSnSv6j7URbYPm5p8h_zG5PGWA9BCR6r-EmmgUU1Nx8_y6hIk2awEdBT3KqVR2tgv9LTDhszvmw"/>
              </div>
              </div>
              </header>
              {/*  Main Content Canvas  */}
              <main className="ml-64 pt-24 pb-12 px-margin-desktop max-w-[calc(100%-16rem)] animate-fade-in">
              <div className="max-w-5xl mx-auto">
              {/*  Context Header Section  */}
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
              <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-surface-container rounded-xl flex items-center justify-center">
              <img className="w-8 h-8 object-contain" data-alt="A minimalist logo for a digital bank called UBL Digital Lending. The logo features a stylized teal monogram inside a clean white square with rounded corners. The design is modern, professional, and incorporates institutional modernism elements with high contrast and sharp geometry." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8zp10xWYPlJEnd9_vhUtavGAD92_E9WGsrJ3Z1-STU_U0ASv8anbct4ldH-ELgGpIHHu1Sr7f2MUsZKxGAuzFL6Wg9RmThrHf29o4b3RE1y9IUgDVpwrggnGbbLDdegWv-rFYm31V1e32HOC6pKKsPUxZFag4y0uImHACI_oTyIGOCKvZqxFNrZisxZaMNIumnHTUeeSCA8Ywwghn2EdfntiV4UX9Rm4Fw6FDmvo06VeCibTb4Pfm-g"/>
              </div>
              <div>
              <p className="text-label-md font-label-md text-primary">Recipient: UBL Digital Lending</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant">Purpose: Credit card and personal financing assessment</p>
              </div>
              </div>
              <h2 className="text-headline-lg font-headline-lg text-on-surface">Choose what UBL can access</h2>
              </div>
              <a className="text-primary font-label-md text-label-md underline underline-offset-4 hover:text-secondary transition-colors" href="#">
                                  View consent terms
                              </a>
              </div>
              {/*  Bento Layout for Consent Setup  */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              {/*  Permissions Controls (Col 1-7)  */}
              <div className="lg:col-span-7 space-y-6">
              {/*  Toggle Section  */}
              <div className="bg-surface-container-lowest rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/10">
              <h3 className="text-headline-sm font-headline-sm mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">rule</span>
                                          Data Permissions
                                      </h3>
              <div className="space-y-stack-lg">
              {/*  Share Payoneer Summary  */}
              <div className="flex items-start justify-between group">
              <div className="flex-grow pr-4">
              <p className="text-body-md font-bold text-on-surface">Share Payoneer summary</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">Only aggregated monthly totals are shared, not raw transactions.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
              <input checked={sources.PAYONEER} onChange={() => handleToggle("PAYONEER")} className="sr-only permission-toggle" type="checkbox"/>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${sources.PAYONEER ? 'bg-primary' : 'bg-surface-container-highest'}`}>
              <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${sources.PAYONEER ? 'left-6' : 'left-1'}`}></div>
              </div>
              </label>
              </div>
              <hr className="border-outline-variant/30"/>
              {/*  Share Bank Transfer Summary  */}
              <div className="flex items-start justify-between group">
              <div className="flex-grow pr-4">
              <p className="text-body-md font-bold text-on-surface">Share bank transfer summary</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">Only aggregated monthly totals are shared, not raw transactions.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
              <input checked={sources.BANK_TRANSFER} onChange={() => handleToggle("BANK_TRANSFER")} className="sr-only permission-toggle" type="checkbox"/>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${sources.BANK_TRANSFER ? 'bg-primary' : 'bg-surface-container-highest'}`}>
              <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${sources.BANK_TRANSFER ? 'left-6' : 'left-1'}`}></div>
              </div>
              </label>
              </div>
              <hr className="border-outline-variant/30"/>
              {/*  Share Invoice Summary  */}
              <div className="flex items-start justify-between group">
              <div className="flex-grow pr-4">
              <p className="text-body-md font-bold text-on-surface">Share invoice summary</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">Only aggregated monthly totals are shared, not raw transactions.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
              <input checked={sources.LOCAL_INVOICING} onChange={() => handleToggle("LOCAL_INVOICING")} className="sr-only permission-toggle" type="checkbox"/>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${sources.LOCAL_INVOICING ? 'bg-primary' : 'bg-surface-container-highest'}`}>
              <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${sources.LOCAL_INVOICING ? 'left-6' : 'left-1'}`}></div>
              </div>
              </label>
              </div>
              </div>
              </div>
              {/*  Duration Selection  */}
              <div className="bg-surface-container-lowest rounded-[24px] p-stack-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/10">
              <h3 className="text-headline-sm font-headline-sm mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
                                          Access Duration
                                      </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/*  One-time snapshot  */}
              <button onClick={() => setDuration("ONE_TIME")} className={`p-4 rounded-xl text-left transition-all duration-200 focus:ring-2 focus:ring-primary/20 ${duration === "ONE_TIME" ? "border-2 border-primary bg-primary-container/5" : "border border-outline-variant"}`}>
              <p className={`text-label-md font-label-md ${duration === "ONE_TIME" ? "text-primary" : "text-on-surface"}`}>One-time snapshot</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">Immediate data pull only</p>
              </button>
              {/*  3 months (just map to ROLLING_6MO for simplicity in this demo or keep static) */}
              <button onClick={() => setDuration("ROLLING_6MO")} className={`p-4 rounded-xl text-left transition-all duration-200 focus:ring-2 focus:ring-primary/20 border border-outline-variant`}>
              <p className="text-label-md font-label-md text-on-surface">3 months</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">Limited term access</p>
              </button>
              {/*  6 months rolling access (Selected)  */}
              <button onClick={() => setDuration("ROLLING_6MO")} className={`p-4 rounded-xl text-left transition-all duration-200 relative overflow-hidden group ${duration === "ROLLING_6MO" ? "border-2 border-primary bg-primary-container/5" : "border border-outline-variant"}`}>
              {duration === "ROLLING_6MO" && (
                <div className="absolute top-2 right-2">
                <span className="material-symbols-outlined text-primary text-lg" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
                </div>
              )}
              <p className={`text-label-md font-label-md ${duration === "ROLLING_6MO" ? "text-primary" : "text-on-surface"}`}>6 months rolling access</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">Continuous verification</p>
              </button>
              </div>
              </div>
              </div>
              {/*  Summary & CTA Panel (Col 8-12)  */}
              <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="glass-card rounded-[24px] p-stack-lg shadow-[0px_12px_32px_rgba(0,74,59,0.08)] sticky top-24">
              <h3 className="text-headline-sm font-headline-sm mb-6 text-primary">Transparency Summary</h3>
              <div className="space-y-6">
              {/*  Shared List  */}
              <div className="space-y-3">
              <p className="text-label-sm font-label-sm text-primary uppercase tracking-widest">Shared with UBL</p>
              <ul className="space-y-2">
              {sources.PAYONEER && (
                <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                <span className="text-body-sm font-body-sm">Payoneer income averages</span>
                </li>
              )}
              {sources.BANK_TRANSFER && (
                <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                <span className="text-body-sm font-body-sm">Direct Bank consistency metrics</span>
                </li>
              )}
              {sources.LOCAL_INVOICING && (
                <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                <span className="text-body-sm font-body-sm">Local Invoice growth analysis</span>
                </li>
              )}
              <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#D4AF37] text-sm" style={{"fontVariationSettings":"'FILL' 1"}}>stars</span>
              <span className="text-body-sm font-body-sm font-bold">IVS Score (Verification Grade)</span>
              </li>
              </ul>
              </div>
              <hr className="border-outline-variant/30"/>
              {/*  Not Shared List  */}
              <div className="space-y-3">
              <p className="text-label-sm font-label-sm text-error uppercase tracking-widest">Not Shared</p>
              <ul className="space-y-2">
              <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-sm">cancel</span>
              <span className="text-body-sm font-body-sm text-on-surface-variant">Raw transaction histories</span>
              </li>
              <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-sm">cancel</span>
              <span className="text-body-sm font-body-sm text-on-surface-variant">Private client names</span>
              </li>
              {!sources.LOCAL_INVOICING && (
                <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-sm">cancel</span>
                <span className="text-body-sm font-body-sm text-on-surface-variant">Local invoice details</span>
                </li>
              )}
              </ul>
              </div>
              {/*  CTA Actions  */}
              <div className="pt-6 space-y-3">
              {errorMessage && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <p className="text-body-sm text-error">{errorMessage}</p>
                </div>
              )}
              <button disabled={loading} onClick={handleGrant} className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-75">
              <span className="material-symbols-outlined" style={{"fontVariationSettings":"'FILL' 1"}}>enhanced_encryption</span>
                                                  {loading ? "Granting..." : "Grant secure consent"}
                                              </button>
              <button className="w-full bg-transparent border-2 border-secondary text-secondary py-4 rounded-xl font-bold hover:bg-secondary/5 active:scale-[0.98] transition-all">
                                                  Save for later
                                              </button>
              </div>
              <p className="text-[11px] text-center text-on-surface-variant italic">
                                              Encryption powered by VaultTrust Secure Node. 256-bit AES standard.
                                          </p>
              </div>
              </div>
              {/*  Supplemental Insight Card  */}
              <div className="bg-primary-container text-on-primary rounded-[24px] p-6 shadow-md relative overflow-hidden">
              <div className="relative z-10">
              <h4 className="font-bold mb-2">Why this matters?</h4>
              <p className="text-body-sm opacity-90">By sharing your aggregate income, UBL can offer you a credit limit up to 2.4x higher than standard bank-only assessments.</p>
              </div>
              <div className="absolute -bottom-4 -right-4 opacity-20">
              <span className="material-symbols-outlined text-[80px]">trending_up</span>
              </div>
              </div>
              </div>
              </div>
              </div>
              </main>
              {/*  Footer Security Banner  */}
              <footer className="ml-64 px-margin-desktop py-stack-md flex justify-between items-center text-label-sm font-label-sm text-on-surface-variant bg-surface-container-low border-t border-outline-variant/10">
              <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">shield</span>
                              GDPR Compliant
                          </span>
              <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">lock</span>
                              End-to-End Encrypted
                          </span>
              </div>
              </footer>
            </div>
            
    </>
  );
}
