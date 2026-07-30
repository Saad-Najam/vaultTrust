"use client";

import React from "react";
import Link from "next/link";

export default function Page() {
  // TODO: Initialize landing analytics and check if user has active session to redirect to dashboard.

  return (
    <>
      
            <div className="block lg:hidden animate-fade-in">
              {/*  Top App Bar  */}
              <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-5 h-16 bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" data-icon="shield">shield</span>
              </div>
              <h1 className="text-headline-sm font-headline-sm font-bold text-primary">VaultTrust</h1>
              </Link>
              <div className="flex items-center gap-4">
              <button className="hover:bg-surface-container-high rounded-full p-2 transition-opacity active:opacity-80">
              <span className="material-symbols-outlined text-on-surface-variant" data-icon="notifications">notifications</span>
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant">
              <img alt="" className="w-full h-full object-cover" data-alt="A professional headshot of a young Middle Eastern male freelancer with a friendly expression. He is wearing a minimalist dark green polo shirt, set against a clean, softly lit architectural background with subtle teal accents. The visual style is high-end corporate photography with a warm, modern aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXwFnrGSfAceHItEZHQvOjz5UCJySaScfrx5PtFmVLJy_1J-0fgx1NTIiISw6oyPvdn0k7jUY_cTyISa6Hp0lOqsuKwmrBDrTQx5G1S4DOOe5Ro9gLLTg85Z4yek67QsZyxI61zOIabJ3QBFFGdFm_jO2S3t7xFwFE4BsK2j-_xRW6KmH3JGPKph_KTYyC_ETGtWYm7VnOB6I5zn2K7a-HGj-fwQl_sKO5XdjwdgKI-ny7OOs5AGJC8w"/>
              </div>
              </div>
              </header>
              <main className="pt-20 px-5 max-w-md mx-auto">
              {/*  Welcome Section  */}
              <section className="mt-4 mb-6">
              <p className="text-label-md font-label-md text-on-surface-variant mb-1">Good Morning,</p>
              <h2 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">Welcome Ahmed</h2>
              </section>
              {/*  Status Banner  */}
              <div className="mb-6 p-4 rounded-[24px] bg-primary-container text-on-primary flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary-fixed/20">
              <span className="material-symbols-outlined text-primary-fixed" data-icon="verified_user" style={{"fontVariationSettings":"'FILL' 1"}}>verified_user</span>
              </div>
              <div>
              <p className="text-label-md font-label-md">Consent Active</p>
              <p className="text-body-sm font-body-sm opacity-90">Shared with UBL Bank</p>
              </div>
              </div>
              <span className="material-symbols-outlined text-on-primary/60" data-icon="chevron_right">chevron_right</span>
              </div>
              {/*  Summary Grid (Bento Style)  */}
              <div className="grid grid-cols-2 gap-4 mb-8">
              {/*  Income Card  */}
              <div className="col-span-2 p-5 rounded-[24px] glass-card shadow-[0px_4px_20px_rgba(0,0,0,0.04)] relative overflow-hidden">
              <div className="relative z-10">
              <p className="text-label-md font-label-md text-on-surface-variant mb-2">Monthly Income</p>
              <div className="flex items-end justify-between">
              <h3 className="text-headline-md font-headline-md text-primary">$4,850.00</h3>
              <div className="flex items-center text-secondary font-bold text-body-sm mb-1">
              <span className="material-symbols-outlined text-[18px]" data-icon="trending_up">trending_up</span>
              <span>12%</span>
              </div>
              </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
              <span className="material-symbols-outlined text-[80px]" data-icon="payments">payments</span>
              </div>
              </div>
              {/*  Score Card  */}
              <div className="p-5 rounded-[24px] bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/10">
              <p className="text-label-md font-label-md text-on-surface-variant mb-1">Trust Score</p>
              <h3 className="text-headline-sm font-headline-sm text-on-surface">842</h3>
              <div className="mt-2 h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[84%] rounded-full"></div>
              </div>
              </div>
              {/*  Trend Card  */}
              <div className="p-5 rounded-[24px] bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/10">
              <p className="text-label-md font-label-md text-on-surface-variant mb-1">Accounts</p>
              <div className="flex items-center gap-2 mt-1">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">3</h3>
              <span className="text-body-sm font-body-sm text-on-surface-variant">Linked</span>
              </div>
              <div className="flex -space-x-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-primary-fixed border-2 border-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[12px] text-primary" data-icon="account_balance">account_balance</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-secondary-fixed border-2 border-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[12px] text-secondary" data-icon="credit_card">credit_card</span>
              </div>
              </div>
              </div>
              </div>
              {/*  6-Month Chart  */}
              <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">Income Trend</h3>
              <button className="text-primary text-label-md font-label-md">View All</button>
              </div>
              <div className="p-5 rounded-[24px] bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="chart-container" id="incomeChart">
              <div className="chart-bar" style={{"height":"40%"}}></div>
              <div className="chart-bar" style={{"height":"65%"}}></div>
              <div className="chart-bar" style={{"height":"55%"}}></div>
              <div className="chart-bar" style={{"height":"85%"}}></div>
              <div className="chart-bar" style={{"height":"70%"}}></div>
              <div className="chart-bar" style={{"height":"95%"}}></div>
              </div>
              <div className="flex justify-between mt-3 text-[10px] text-on-surface-variant font-bold px-1">
              <span>JAN</span>
              <span>FEB</span>
              <span>MAR</span>
              <span>APR</span>
              <span>MAY</span>
              <span>JUN</span>
              </div>
              </div>
              </section>
              {/*  Recent Activity  */}
              <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">Activity</h3>
              <span className="material-symbols-outlined text-on-surface-variant" data-icon="history">history</span>
              </div>
              <div className="space-y-3">
              {/*  Activity Item  */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/50 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined" data-icon="fact_check">fact_check</span>
              </div>
              <div className="flex-1">
              <p className="text-body-md font-bold text-on-surface">Consent Renewed</p>
              <p className="text-body-sm text-on-surface-variant">UBL Digital Portal</p>
              </div>
              <div className="text-right">
              <p className="text-label-sm font-label-sm text-on-surface-variant">2h ago</p>
              </div>
              </div>
              {/*  Activity Item  */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/50 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 rounded-full bg-primary-fixed/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined" data-icon="account_balance">account_balance</span>
              </div>
              <div className="flex-1">
              <p className="text-body-md font-bold text-on-surface">Account Linked</p>
              <p className="text-body-sm text-on-surface-variant">Payoneer USD</p>
              </div>
              <div className="text-right">
              <p className="text-label-sm font-label-sm text-on-surface-variant">Yesterday</p>
              </div>
              </div>
              {/*  Activity Item  */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/50 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined" data-icon="security_update_good">security_update_good</span>
              </div>
              <div className="flex-1">
              <p className="text-body-md font-bold text-on-surface">Vault Sync</p>
              <p className="text-body-sm text-on-surface-variant">Income profile updated</p>
              </div>
              <div className="text-right">
              <p className="text-label-sm font-label-sm text-on-surface-variant">2d ago</p>
              </div>
              </div>
              </div>
              </section>
              </main>
              {/*  Bottom Navigation Shell  */}
              <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest shadow-[0px_-4px_20px_rgba(0,0,0,0.04)] md:hidden">
              <div className="flex justify-around items-center h-20 px-4">
              {/*  Active Home Tab  */}
              <Link href="/" className="flex flex-col items-center justify-center gap-1 min-w-[64px] text-primary transition-all active:scale-95">
              <div className="bg-primary-container/20 rounded-full px-5 py-1 mb-0.5">
              <span className="material-symbols-outlined text-[24px]" data-icon="home" style={{"fontVariationSettings":"'FILL' 1"}}>home</span>
              </div>
              <span className="text-label-sm font-bold">Home</span>
              </Link>
              {/*  Accounts Tab  */}
              <Link href="/connect" className="flex flex-col items-center justify-center gap-1 min-w-[64px] text-on-surface-variant hover:text-primary transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]" data-icon="account_balance">account_balance</span>
              <span className="text-label-sm font-label-sm">Accounts</span>
              </Link>
              {/*  Consent Tab  */}
              <Link href="/consent/active" className="flex flex-col items-center justify-center gap-1 min-w-[64px] text-on-surface-variant hover:text-primary transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]" data-icon="verified_user">verified_user</span>
              <span className="text-label-sm font-label-sm">Consent</span>
              </Link>
              {/*  Profile Tab  */}
              <Link href="/profile" className="flex flex-col items-center justify-center gap-1 min-w-[64px] text-on-surface-variant hover:text-primary transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]" data-icon="person">person</span>
              <span className="text-label-sm font-label-sm">Profile</span>
              </Link>
              </div>
              </nav>
              {/*  Interaction Script  */}
            </div>
            <div className="hidden lg:block animate-fade-in">
              {/*  Top Navigation (Shell suppressed for Landing context, using Landing Nav)  */}
              <nav className="sticky top-0 z-50 w-full px-margin-mobile md:px-margin-desktop h-20 flex justify-between items-center glass-card border-none">
              <Link href="/" className="flex items-center gap-2">
              <span className="text-primary font-extrabold text-headline-sm tracking-tight">VaultTrust</span>
              <span className="bg-tertiary-container/20 text-on-tertiary-container px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider">MOCK DEMO</span>
              </Link>
              <div className="hidden md:flex items-center gap-stack-lg">
              <a className="text-label-md text-on-surface-variant hover:text-primary transition-colors" href="#">How it works</a>
              <a className="text-label-md text-on-surface-variant hover:text-primary transition-colors" href="#">Security</a>
              <a className="text-label-md text-on-surface-variant hover:text-primary transition-colors" href="#">FAQ</a>
              <Link href="/login">
                <button className="border border-outline/30 text-primary px-6 py-2.5 rounded-lg font-label-md hover:bg-surface-container-highest/50 transition-colors">Login</button>
              </Link>
              <Link href="/signup">
                <button className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">Sign Up</button>
              </Link>
              </div>
              <button className="md:hidden text-primary">
              <span className="material-symbols-outlined">menu</span>
              </button>
              </nav>
              <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg lg:py-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/*  Left: Content  */}
              <div className="lg:col-span-6 flex flex-col gap-stack-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded-full w-fit">
              <span className="material-symbols-outlined text-[16px]" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
              <span className="text-label-sm font-bold uppercase tracking-widest">Digital Stewardship</span>
              </div>
              <h1 className="text-headline-lg-mobile md:text-headline-lg font-extrabold text-primary leading-tight">
                                  Turn your freelance income into financial opportunity.
                               </h1>
              <p className="text-body-lg text-on-surface-variant max-w-lg">
                                  Secure, consent-based income verification for Pakistani freelancers. Access formal banking services using your verifiable digital history.
                               </p>
              <div className="flex flex-col sm:flex-row gap-stack-md mt-4">
              <Link href="/signup">
                <button className="bg-primary text-on-primary px-8 py-4 rounded-xl font-label-md text-lg hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group">
                    Get started as a freelancer
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </Link>
              </div>
              {/*  Trust Badges  */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-stack-md mt-12 border-t border-outline/10 pt-stack-lg">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <span className="text-label-md text-on-surface font-semibold">Consent-controlled</span>
              </div>
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
              </div>
              <span className="text-label-md text-on-surface font-semibold">Privacy-first</span>
              </div>
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
              </div>
              <span className="text-label-md text-on-surface font-semibold">Tamper-evident</span>
              </div>
              </div>
              </div>
              {/*  Right: Interactive Diagram (Bento/Card Style)  */}
              <div className="lg:col-span-6 relative">
              <div className="glass-card rounded-[32px] p-stack-lg shadow-xl relative overflow-hidden">
              {/*  Abstract Background decoration  */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-fixed/20 blur-3xl -z-10"></div>
              <div className="flex flex-col gap-12 relative">
              {/*  Header for Diagram  */}
              <div className="text-center">
              <h3 className="text-label-md text-outline font-bold uppercase tracking-[0.2em]">Live Transaction Flow</h3>
              </div>
              {/*  Diagram Content  */}
              <div className="flex flex-col gap-16 items-center">
              {/*  Source Layer  */}
              <div className="flex gap-4 w-full justify-center">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-outline/10 flex flex-col items-center gap-2 w-32 hover-lift">
              <span className="material-symbols-outlined text-primary text-3xl">payments</span>
              <span className="text-label-sm">Payoneer</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-outline/10 flex flex-col items-center gap-2 w-32 hover-lift">
              <span className="material-symbols-outlined text-primary text-3xl">account_balance_wallet</span>
              <span className="text-label-sm">Upwork</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-outline/10 flex flex-col items-center gap-2 w-32 hover-lift">
              <span className="material-symbols-outlined text-primary text-3xl">work</span>
              <span className="text-label-sm">Fiverr</span>
              </div>
              </div>
              {/*  Connector 1  */}
              <div className="h-16 flex items-center justify-center relative">
              <div className="absolute w-2 h-2 bg-primary rounded-full animate-ping"></div>
              <div className="w-[2px] h-full text-primary flow-line-bg"></div>
              </div>
              {/*  Core: VaultTrust  */}
              <div className="relative group">
              <div className="w-48 h-48 bg-primary rounded-[40px] flex flex-col items-center justify-center text-on-primary shadow-2xl relative z-10 overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span className="material-symbols-outlined text-5xl mb-2" style={{"fontVariationSettings":"'FILL' 1"}}>shield_with_heart</span>
              <span className="font-headline-sm font-bold">VaultTrust</span>
              <span className="text-[10px] uppercase tracking-widest mt-1 opacity-80">Encryption Layer</span>
              </div>
              {/*  Pulse Circles  */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/20 rounded-full animate-[ping_3s_linear_infinite]"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-primary/10 rounded-full animate-[ping_4s_linear_infinite]"></div>
              </div>
              {/*  Connector 2  */}
              <div className="h-16 flex items-center justify-center relative">
              <div className="w-[2px] h-full text-secondary flow-line-bg"></div>
              </div>
              {/*  Destination: UBL  */}
              <div className="w-full bg-secondary-container/20 border border-secondary/20 p-6 rounded-3xl flex flex-col items-center gap-4 hover-lift">
              <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-secondary" style={{"fontVariationSettings":"'FILL' 1"}}>account_balance</span>
              </div>
              <div className="text-left">
              <h4 className="text-headline-sm text-secondary font-bold">UBL Digital</h4>
              <p className="text-label-sm text-on-surface-variant">Credit Assessment Engine</p>
              </div>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-3/4 animate-[shimmer_2s_infinite]"></div>
              </div>
              <p className="text-[11px] text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">analytics</span> Verifying Income Stability...
                                              </p>
              </div>
              </div>
              </div>
              </div>
              {/*  Floating Data Card  */}
              <div className="absolute -bottom-6 -left-6 glass-card p-4 rounded-2xl shadow-lg border border-primary/20 animate-bounce duration-[3000ms] hidden sm:block">
              <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-sm">lock_person</span>
              </div>
              <div>
              <p className="text-xs font-bold text-primary">Identity Verified</p>
              <p className="text-[10px] text-on-surface-variant">PK-Vault ID: 8821-X</p>
              </div>
              </div>
              </div>
              </div>
              </div>
              </main>
              {/*  Interactive Section: How it Works  */}
              <section className="bg-surface-container-low py-24 mt-24">
              <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
              <div className="text-center mb-16">
              <h2 className="text-headline-md font-bold text-primary mb-4">Verification made effortless</h2>
              <p className="text-body-md text-on-surface-variant">Three simple steps to unlock your financial potential</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/*  Step 1  */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-primary-fixed text-on-primary-fixed rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">add_link</span>
              </div>
              <h3 className="text-headline-sm text-primary mb-3">Link Accounts</h3>
              <p className="text-body-sm text-on-surface-variant">Connect your global freelance platforms and local bank accounts via our secure API tunnels.</p>
              </div>
              {/*  Step 2  */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-secondary-container text-on-secondary-container rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">verified_user</span>
              </div>
              <h3 className="text-headline-sm text-primary mb-3">Control Access</h3>
              <p className="text-body-sm text-on-surface-variant">Choose exactly what data to share with UBL. You remain the owner of your information at all times.</p>
              </div>
              {/*  Step 3  */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">auto_awesome</span>
              </div>
              <h3 className="text-headline-sm text-primary mb-3">Unlock Finance</h3>
              <p className="text-body-sm text-on-surface-variant">Get approved for credit cards, home loans, and personal financing based on your verified global earnings.</p>
              </div>
              </div>
              </div>
              </section>
              {/*  Footer  */}
              <footer className="bg-primary-container text-on-primary py-12">
              <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex flex-col gap-2 items-center md:items-start">
              <span className="text-headline-sm font-bold tracking-tight">VaultTrust</span>
              <p className="text-label-sm opacity-60">© 2024 VaultTrust Stewardship. All Rights Reserved.</p>
              </div>
              <div className="flex gap-stack-lg text-label-md">
              <a className="hover:text-primary-fixed transition-colors" href="#">Privacy Policy</a>
              <a className="hover:text-primary-fixed transition-colors" href="#">Terms of Service</a>
              <a className="hover:text-primary-fixed transition-colors" href="#">Contact Support</a>
              </div>
              <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-sm">alternate_email</span>
              </div>
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-sm">language</span>
              </div>
              </div>
              </div>
              </footer>
            </div>
            
    </>
  );
}
