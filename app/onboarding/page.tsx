"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetch_client";
import { useCurrentUser } from "@/lib/use_current_user";

export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { name } = useCurrentUser();

  const handleOnboard = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/v1/onboarding", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        router.push("/connect");
      } else {
        alert("KYC Onboarding failed: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error initiating KYC onboarding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/*  Navigation Shell Suppressed for Transactional/Onboarding Flow as per instructions  */}
      <main className="relative min-h-screen flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop py-stack-lg animate-slide-up">
      {/*  Subtle Background Aesthetic  */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -top-[10%] -right-[10%] w-[600px] h-[600px] bg-primary-fixed/20 rounded-full blur-3xl animate-float-bg"></div>
      <div className="absolute -bottom-[10%] -left-[10%] w-[500px] h-[500px] bg-secondary-fixed/20 rounded-full blur-3xl animate-float-bg" style={{animationDelay: "2s"}}></div>
      </div>
      <div className="w-full max-w-container-max z-10">
      {/*  Header Brand Anchor  */}
      <div className="flex items-center justify-between mb-12">
      <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-on-primary">
      <span className="material-symbols-outlined" style={{"fontVariationSettings":"'FILL' 1"}}>shield_person</span>
      </div>
      <span className="text-headline-sm font-headline-sm font-extrabold tracking-tight text-primary">VaultTrust</span>
      </div>
      <div className="hidden md:flex items-center gap-2 text-on-surface-variant">
      <span className="material-symbols-outlined text-[20px]">help_outline</span>
      <span className="text-label-sm font-label-sm">Support Center</span>
      </div>
      </div>
      {/*  Onboarding Stepper  */}
      <div className="w-full max-w-3xl mx-auto mb-16">
      <div className="flex justify-between items-center relative">
      {/*  Progress Line  */}
      <div className="absolute top-1/2 left-0 w-full h-[2px] bg-surface-container-highest -z-10"></div>
      <div className="absolute top-1/2 left-0 w-[25%] h-[2px] bg-primary -z-10"></div>
      {/*  Step 1: Active  */}
      <div className="flex flex-col items-center gap-2 bg-background px-4">
      <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg ring-4 ring-primary/10">
      <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
      </div>
      <span className="text-label-md font-label-md text-primary">Verify Profile</span>
      </div>
      {/*  Step 2  */}
      <div className="flex flex-col items-center gap-2 bg-background px-4">
      <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">
      <span className="material-symbols-outlined text-[20px]">account_balance</span>
      </div>
      <span className="text-label-md font-label-md text-on-surface-variant">Connect Income</span>
      </div>
      {/*  Step 3  */}
      <div className="flex flex-col items-center gap-2 bg-background px-4">
      <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">
      <span className="material-symbols-outlined text-[20px]">rule</span>
      </div>
      <span className="text-label-md font-label-md text-on-surface-variant">Set Consent</span>
      </div>
      {/*  Step 4  */}
      <div className="flex flex-col items-center gap-2 bg-background px-4">
      <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">
      <span className="material-symbols-outlined text-[20px]">person_outline</span>
      </div>
      <span className="text-label-md font-label-md text-on-surface-variant">View Profile</span>
      </div>
      </div>
      </div>
      {/*  Content Bento Grid  */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter max-w-6xl mx-auto">
      {/*  Welcome Card  */}
      <div className="lg:col-span-7 bg-surface-container-lowest rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-stack-lg border border-white/50 relative overflow-hidden flex flex-col justify-between min-h-[400px]">
      <div className="relative z-10">
      <div className="flex items-center gap-4 mb-stack-md">
      <div className="w-16 h-16 rounded-full border-2 border-primary-fixed overflow-hidden">
      <img alt="" className="w-full h-full object-cover" data-alt="A professional headshot of a young South Asian man with short dark hair and a friendly smile, dressed in a smart casual navy blazer, against a clean studio background with soft cinematic lighting, evoking a sense of trust and professionalism for a financial portal." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdEfBnaUvlNQ_MZtj4n6_-qkLXgzMJFFU5Oeu-swiLPSHr9E0Twih3bdW78wh8CMN8Z1d6HUG08eEt_zbosw5Nm3-w5ZeEMoE94KX3QP_nOynehpY2GSfz6qNFbYogXcROni0mo40Z4P7ej3_ADuOtva_pDa1T93cRn8qwi8B0KEDvGYe8iTQzHXsKBAUBQhk947c7QVQrNGYmIuf4AnQoSMbsJmApfIsWC0eb7A1S8ZnrcFKIdjQ2_A"/>
      </div>
      <div>
      <h1 className="text-headline-md font-headline-md text-primary">Welcome{name ? `, ${name}` : ""}</h1>
      <p className="text-body-md font-body-md text-on-surface-variant">Freelance Web Developer • Lahore</p>
      </div>
      </div>
      <p className="text-body-lg font-body-lg text-on-surface max-w-lg leading-relaxed mt-4">
                                  You&apos;re one step away from unlocking institutional-grade financial tools. By verifying your identity, you ensure the integrity of your digital vault and enable secure cross-border payments.
                              </p>
      </div>
      <div className="mt-stack-lg relative z-10">
      <div className="flex flex-col gap-stack-sm">
      <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-outline-variant/30">
      <span className="material-symbols-outlined text-primary" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
      <span className="text-label-md font-label-md text-on-surface">Identity Document Verified</span>
      </div>
      <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-outline-variant/30">
      <span className="material-symbols-outlined text-primary" style={{"fontVariationSettings":"'FILL' 1"}}>check_circle</span>
      <span className="text-label-md font-label-md text-on-surface">Facial Biometrics Completed</span>
      </div>
      </div>
      </div>
      {/*  Decorative Element  */}
      <div className="absolute top-0 right-0 p-stack-lg opacity-10">
      <span className="material-symbols-outlined text-[160px] text-primary">verified</span>
      </div>
      </div>
      {/*  Privacy & Security Bento  */}
      <div className="lg:col-span-5 flex flex-col gap-gutter">
      {/*  Privacy Card  */}
      <div className="bg-primary-container rounded-[24px] p-stack-lg text-on-primary shadow-lg relative overflow-hidden group">
      <div className="relative z-10">
      <div className="flex items-center gap-2 mb-stack-md">
      <span className="material-symbols-outlined text-tertiary-fixed">lock</span>
      <h3 className="text-headline-sm font-headline-sm">Privacy Guaranteed</h3>
      </div>
      <p className="text-body-md font-body-md opacity-90 leading-relaxed mb-stack-md">
                                      Your raw transactions are never shared. You share only the verified summaries you approve. Revoke anytime.
                                  </p>
      <div className="bg-white/10 p-3 rounded-lg flex items-center gap-2 backdrop-blur-md">
      <span className="material-symbols-outlined text-tertiary-fixed text-[20px]" style={{"fontVariationSettings":"'FILL' 1"}}>gpp_good</span>
      <span className="text-label-sm font-label-sm">GDPR & APPI Compliant Encryption</span>
      </div>
      </div>
      {/*  Background Pattern  */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
      <pattern height="10" id="grid" patternUnits="userSpaceOnUse" width="10">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"></path>
      </pattern>
      <rect fill="url(#grid)" height="100%" width="100%"></rect>
      </svg>
      </div>
      </div>
      {/*  Security Visual/Status  */}
      <div className="flex-1 glass-card rounded-[24px] p-stack-lg border border-outline-variant/30 flex items-center justify-center relative min-h-[160px]">
      <div className="text-center">
      <div className="relative inline-block mb-2">
      <span className="material-symbols-outlined text-secondary text-[48px] animate-pulse">fingerprint</span>
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-tertiary-fixed rounded-full border-2 border-white"></div>
      </div>
      <p className="text-label-md font-label-md text-secondary uppercase tracking-widest">System Secure</p>
      <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">SSL/TLS 1.3 Active</p>
      </div>
      </div>
      </div>
      </div>
      {/*  Verification Map/Identity Proof (Asymmetric Layout element)  */}
      <div className="mt-gutter max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-gutter">
      <div className="lg:col-span-2 bg-surface-container-low rounded-[24px] p-6 flex flex-col md:flex-row items-center gap-6 border border-outline-variant/20">
      <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden grayscale contrast-125 opacity-70">
      <div className="bg-cover bg-center w-full h-full" data-location="Lahore" style={{"backgroundImage":"url('https://lh3.googleusercontent.com/aida-public/AB6AXuDvwkAr6OhHiip2mmaq08e9WaS3AALUdKKKFNEIRhdZ8CnukzjReAqzxTQCOZiwJuOMWaLEKZTOVJL6vlYEuuuH3KxGTaK-5LuxARt2qhTxFsr-VmkhFFIio-mZeMSLewDj1ssMY2LI5tZPSi6sx6GQRcuEzueB2SSn8guSDznsELBVpM9NwYnsIc4wkK2HMDvVggF2st1gr-30XE8U1Lu1X4nqJoA8o6JxG2gykDbyfzINzDNzWXrU-Q')"}}></div>
      </div>
      <div>
      <h4 className="text-headline-sm font-headline-sm text-on-surface">Regional Verification</h4>
      <p className="text-body-md font-body-md text-on-surface-variant mt-1">
                                  Identity anchored to your current operational region: <strong>Lahore, Pakistan</strong>. This ensures compliance with local freelancer tax regulations.
                              </p>
      </div>
      </div>
      <div className="bg-surface-container-high rounded-[24px] p-6 flex flex-col justify-between items-start">
      <div>
      <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-tighter">Current Phase</span>
      <h4 className="text-headline-sm font-headline-sm text-primary mt-1">Profile Verified</h4>
      </div>
      <div className="flex -space-x-2 mt-4">
      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center border-2 border-white">
      <span className="material-symbols-outlined text-[14px]">done</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-surface-container-highest border-2 border-white"></div>
      <div className="w-8 h-8 rounded-full bg-surface-container-highest border-2 border-white"></div>
      </div>
      </div>
      </div>
      {/*  Primary Action Footer  */}
      <div className="mt-16 flex flex-col items-center">
      <button 
        disabled={loading}
        className="group relative px-10 py-5 bg-primary text-on-primary rounded-full font-headline-sm flex items-center gap-4 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-75" 
        onClick={handleOnboard}
      >
        <span>{loading ? "Verifying..." : "Continue to Connect Sources"}</span>
        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
      </button>
      <p className="mt-6 text-label-sm font-label-sm text-on-surface-variant flex items-center gap-2">
      <span className="material-symbols-outlined text-[16px] text-tertiary">info</span>
                          Takes approximately 2 minutes to complete the next step
                      </p>
      </div>
      </div>
      </main>
      {/*  Micro-interaction for the verification icons  */}
    </>
  );
}
