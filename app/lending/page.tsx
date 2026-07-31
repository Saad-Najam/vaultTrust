"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import BankSidebar from "@/components/BankSidebar";
import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/NotificationBell";
import { fetchWithAuth } from "@/lib/fetch_client";
import type { ApplicantListItem } from "@/lib/api_types";

export default function Page() {
  const [applicants, setApplicants] = useState<ApplicantListItem[]>([]);

  useEffect(() => {
    const loadApplicants = async () => {
      try {
        const res = await fetchWithAuth("/api/v1/lending/assess");
        const data = await res.json();
        if (data.success) {
          setApplicants(data.applicants);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadApplicants();
  }, []);

  return (
    <>
      {/*  SideNavBar Component (Enterprise Portal)  */}
      
      <BankSidebar />

      {/*  Main Content Wrapper  */}
      <main className="ml-72 flex-1 h-screen overflow-y-auto relative animate-fade-in">
      {/*  TopAppBar Component  */}
      <header className="flex justify-between items-center w-full px-margin-desktop h-16 bg-surface-container-lowest dark:bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sticky top-0 z-40">
      <div className="flex items-center gap-4">
      <h2 className="text-headline-sm font-headline-sm font-bold text-primary dark:text-primary-fixed">Income Verification</h2>
      <div className="h-6 w-[1px] bg-outline-variant"></div>
      <div className="flex gap-2">
      <span className="text-label-sm font-label-sm text-secondary bg-secondary-container/20 px-3 py-1 rounded-full">Institutional Access</span>
      </div>
      </div>
      <div className="flex items-center gap-6">
      <NotificationBell />
      <Link href="/audit" title="Audit trail" className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-opacity active:opacity-80" data-icon="verified">verified</Link>
      <UserAvatar size="w-10 h-10" showName href={null} />
      </div>
      </header>
      {/*  Content Canvas  */}
      <div className="p-stack-lg max-w-container-max mx-auto">
      {/*  KPI Section (Bento Style)  */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-stack-lg">
      <div className="glass-card p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
      <div>
      <p className="text-label-md font-label-md text-on-surface-variant opacity-70">Profiles Shared</p>
      <h3 className="text-headline-md font-headline-md mt-2">{applicants.length}</h3>
      </div>
      <div className="mt-4 flex items-center gap-2 text-primary font-semibold text-label-sm">
      <span className="material-symbols-outlined text-[18px]">trending_up</span>
      <span>Total registered profiles</span>
      </div>
      </div>
      <div className="glass-card p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
      <div>
      <p className="text-label-md font-label-md text-on-surface-variant opacity-70">Active Consents</p>
      <h3 className="text-headline-md font-headline-md mt-2 text-primary">
        {applicants.filter((a) => a.consentStatus === "ACTIVE").length}
      </h3>
      </div>
      <div className="mt-4 flex items-center gap-2 text-on-surface-variant opacity-60 text-label-sm">
      <span className="material-symbols-outlined text-[18px]">verified_user</span>
      <span>Authorized access granted</span>
      </div>
      </div>
      <div className="glass-card p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between overflow-hidden relative">
      <div className="relative z-10">
      <p className="text-label-md font-label-md text-on-surface-variant opacity-70">Avg IVS Score</p>
      <h3 className="text-headline-md font-headline-md mt-2 text-secondary">
        {applicants.filter((a) => a.consentStatus === "ACTIVE").length > 0
          ? Math.round(
              applicants
                .filter((a) => a.consentStatus === "ACTIVE")
                .reduce((sum, a) => sum + a.ivs, 0) /
                applicants.filter((a) => a.consentStatus === "ACTIVE").length
            )
          : 0}
      </h3>
      </div>
      <div className="mt-4 flex items-center gap-2 text-label-sm">
      <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
      <div className="bg-secondary h-full rounded-full" style={{"width":"74%"}}></div>
      </div>
      </div>
      {/*  Subtle background decoration  */}
      <div className="absolute -right-4 -bottom-4 opacity-5 text-secondary">
      <span className="material-symbols-outlined text-8xl" style={{"fontVariationSettings":"'FILL' 1"}}>analytics</span>
      </div>
      </div>
      <div className="bg-error-container/20 p-6 rounded-2xl shadow-sm border border-error/10 flex flex-col justify-between">
      <div>
      <p className="text-label-md font-label-md text-error">Locked / Revoked</p>
      <h3 className="text-headline-md font-headline-md mt-2 text-error">
        {applicants.filter((a) => a.consentStatus !== "ACTIVE").length}
      </h3>
      </div>
      <div className="mt-4 text-on-surface-variant opacity-60 text-label-sm">
        Consent revoked or not established
      </div>
      </div>
      </div>
      {/*  Filters and Search  */}
      <div className="flex flex-col md:flex-row items-center gap-gutter mb-stack-md">
      <div className="relative flex-1 w-full">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
      <input className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none" placeholder="Search applicant by name, ID or mobile..." type="text"/>
      </div>
      <div className="flex gap-3 w-full md:w-auto">
      <div className="relative inline-block text-left w-full md:w-40">
      <select className="appearance-none w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-label-md font-label-md pr-10 focus:ring-2 focus:ring-secondary transition-all">
      <option>IVS Score</option>
      <option>&gt; 80 High</option>
      <option>50-80 Med</option>
      </select>
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
      </div>
      <div className="relative inline-block text-left w-full md:w-40">
      <select className="appearance-none w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-label-md font-label-md pr-10 focus:ring-2 focus:ring-secondary transition-all">
      <option>Income Range</option>
      <option>&gt; 200k</option>
      <option>100k-200k</option>
      </select>
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
      </div>
      <button className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-semibold hover:opacity-90 transition-all active:scale-95 shadow-md">
      <span className="material-symbols-outlined text-[20px]">filter_list</span>
      <span>Filters</span>
      </button>
      </div>
      </div>
      {/*  Main Data Table  */}
      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
      <thead>
      <tr className="bg-surface-container-high/50 border-b border-outline-variant/20">
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant">Applicant</th>
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant">Verified Income</th>
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant">IVS Score</th>
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant">Trend</th>
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant">Status</th>
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant">Last Updated</th>
      <th className="px-6 py-4 text-label-md font-label-md text-on-surface-variant text-right">Action</th>
      </tr>
      </thead>
      <tbody className="divide-y divide-outline-variant/10">
      {applicants.map((app) => {
        const initials = app.name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase();
        return (
          <tr key={app.id} className="hover:bg-surface-container-low transition-colors">
            <td className="px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container/10 flex items-center justify-center font-bold text-primary">
                  {initials}
                </div>
                <div>
                  <p className="text-body-md font-semibold text-on-surface">{app.name}</p>
                  <p className="text-label-sm text-on-surface-variant opacity-70">
                    VT-{app.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-6 py-5">
              <div className="flex flex-col">
                <span className="text-body-md font-bold text-primary">
                  {app.consentStatus === "ACTIVE"
                    ? `PKR ${Math.round(app.avgMonthlyIncome).toLocaleString()}`
                    : "🔒 LOCKED"}
                </span>
                <span className="text-label-sm text-on-surface-variant">Monthly Avg.</span>
              </div>
            </td>
            <td className="px-6 py-5">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-lg font-bold text-body-sm">
                  {app.consentStatus === "ACTIVE" ? app.ivs : "🔒"}
                </div>
                <span className="text-label-sm text-secondary font-medium">
                  {app.consentStatus === "ACTIVE"
                    ? app.ivs >= 80
                      ? "Excellent"
                      : app.ivs >= 60
                      ? "Good"
                      : "Standard"
                    : "No Consent"}
                </span>
              </div>
              {/*  A withheld debt disclosure must be visible at list level —
                   otherwise a strong IVS looks approvable at a glance.  */}
              {app.consentStatus === "ACTIVE" && app.outflowDisclosure && (
                <div className="mt-1.5 flex items-center gap-1">
                  {app.outflowDisclosure === "SHARED" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      Debt disclosed
                    </span>
                  ) : app.outflowDisclosure === "DECLARED_NONE" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-on-tertiary-container">
                      <span className="material-symbols-outlined text-[13px]">info</span>
                      No debt (self-declared)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-error">
                      <span className="material-symbols-outlined text-[13px]">warning</span>
                      Debt DECLINED
                    </span>
                  )}
                  {app.eligibilityCapped && (
                    <span className="text-[11px] text-error font-bold">
                      · capped {app.eligibilityTier}
                    </span>
                  )}
                </div>
              )}
            </td>
            <td className="px-6 py-5">
              <div className="flex items-center gap-1 text-primary">
                <span className="material-symbols-outlined text-[20px]">
                  {app.trend === "GROWING"
                    ? "trending_up"
                    : app.trend === "DECLINING"
                    ? "trending_down"
                    : "horizontal_rule"}
                </span>
                <span className="text-label-sm font-semibold capitalize">
                  {app.trend.toLowerCase()}
                </span>
              </div>
            </td>
            <td className="px-6 py-5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold ${
                  app.consentStatus === "ACTIVE"
                    ? "bg-[#E8F5E9] text-[#004D40]"
                    : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    app.consentStatus === "ACTIVE" ? "bg-[#004D40]" : "bg-outline"
                  }`}
                ></span>
                {app.consentStatus === "ACTIVE" ? "Consented" : "No Consent"}
              </span>
            </td>
            <td className="px-6 py-5 text-on-surface-variant text-body-sm">
              {app.grantedAt
                ? new Date(app.grantedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "N/A"}
            </td>
            <td className="px-6 py-5 text-right">
              {app.consentStatus === "ACTIVE" ? (
                <Link href={`/applicant?freelancerId=${app.id}`}>
                  <button className="px-4 py-2 bg-primary text-on-primary font-bold text-label-md rounded-lg hover:shadow-lg transition-all active:scale-95 shadow-sm">
                    View profile
                  </button>
                </Link>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 bg-surface-container-high text-on-surface-variant/40 font-bold text-label-md rounded-lg cursor-not-allowed"
                >
                  Locked
                </button>
              )}
            </td>
          </tr>
        );
      })}
      </tbody>
      </table>
      </div>
      {/*  Pagination  */}
      <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant/20 flex justify-between items-center">
      <p className="text-label-sm text-on-surface-variant font-medium">Showing 1 to 10 of 124 entries</p>
      <div className="flex items-center gap-2">
      <button className="p-2 hover:bg-surface-container-high rounded-lg text-outline">
      <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-label-sm font-bold">1</button>
      <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-label-sm">2</button>
      <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-label-sm">3</button>
      <button className="p-2 hover:bg-surface-container-high rounded-lg text-outline">
      <span className="material-symbols-outlined">chevron_right</span>
      </button>
      </div>
      </div>
      </div>
      {/*  Detailed Analysis Section  */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mt-stack-lg">
      <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-outline-variant/30">
      <div className="flex justify-between items-center mb-6">
      <h4 className="text-headline-sm font-headline-sm">Verification Volume Trend</h4>
      <div className="flex gap-2">
      <button className="px-3 py-1 bg-surface-container-high rounded-full text-label-sm font-bold">30D</button>
      <button className="px-3 py-1 text-label-sm font-bold text-on-surface-variant opacity-60">90D</button>
      </div>
      </div>
      <div className="h-64 flex items-end justify-between gap-2">
      {/*  Chart Mockup  */}
      <div className="flex-1 bg-primary/10 rounded-t-lg h-[40%]" title="Day 1"></div>
      <div className="flex-1 bg-primary/20 rounded-t-lg h-[60%]" title="Day 2"></div>
      <div className="flex-1 bg-primary/40 rounded-t-lg h-[80%]" title="Day 3"></div>
      <div className="flex-1 bg-primary/30 rounded-t-lg h-[50%]" title="Day 4"></div>
      <div className="flex-1 bg-primary/60 rounded-t-lg h-[90%]" title="Day 5"></div>
      <div className="flex-1 bg-secondary rounded-t-lg h-[75%]" title="Day 6"></div>
      <div className="flex-1 bg-primary rounded-t-lg h-[100%]" title="Day 7"></div>
      </div>
      </div>
      <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 flex flex-col">
      <h4 className="text-headline-sm font-headline-sm mb-4">Risk Distribution</h4>
      <div className="flex-1 flex flex-col justify-center space-y-4">
      <div className="space-y-1">
      <div className="flex justify-between text-label-sm font-bold">
      <span>High Trust (&gt;80)</span>
      <span>42%</span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
      <div className="bg-primary h-full" style={{"width":"42%"}}></div>
      </div>
      </div>
      <div className="space-y-1">
      <div className="flex justify-between text-label-sm font-bold">
      <span>Medium Trust (50-80)</span>
      <span>48%</span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
      <div className="bg-secondary h-full" style={{"width":"48%"}}></div>
      </div>
      </div>
      <div className="space-y-1">
      <div className="flex justify-between text-label-sm font-bold">
      <span>Low Trust (&lt;50)</span>
      <span>10%</span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
      <div className="bg-error h-full" style={{"width":"10%"}}></div>
      </div>
      </div>
      </div>
      <div className="mt-6 pt-6 border-t border-outline-variant/20">
      <p className="text-label-sm text-on-surface-variant mb-4">Quick Insights:</p>
      <div className="flex items-center gap-3 p-3 bg-tertiary-container/10 rounded-xl border border-tertiary/20">
      <span className="material-symbols-outlined text-tertiary" style={{"fontVariationSettings":"'FILL' 1"}}>lightbulb</span>
      <p className="text-label-sm font-medium text-on-tertiary-container">Average IVS score increased by 4 points since last quarter.</p>
      </div>
      </div>
      </div>
      </div>
      </div>
      </main>
      {/*  Micro-interaction Scripts  */}
    </>
  );
}
