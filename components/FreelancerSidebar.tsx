"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", icon: "dashboard", label: "Overview" },
  { href: "/connect", icon: "account_balance", label: "Connected Accounts" },
  { href: "/consent/setup", icon: "verified_user", label: "Consent Center" },
  { href: "/profile", icon: "payments", label: "Income Profile" },
  { href: "/audit", icon: "receipt_long", label: "Activity & Audit Trail" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function FreelancerSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile drawer trigger — sits above page headers (z-40). */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-full bg-[#0d1f1a] text-[#95d3bf] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      {/* Scrim, mobile only */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="lg:hidden fixed inset-0 bg-black/50 z-40 animate-fade-in"
        />
      )}

      <aside
        className={`w-64 bg-[#0d1f1a] fixed left-0 top-0 h-screen flex flex-col py-8 shadow-[4px_0px_20px_rgba(0,0,0,0.15)] z-40 overflow-y-auto transition-transform duration-300 lg:z-30 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close control, mobile only */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden absolute top-3 right-3 w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Logo */}
        <div className="px-6 mb-8">
          <Link href="/" className="block" onClick={() => setOpen(false)}>
            <h1 className="text-headline-sm font-bold text-[#95d3bf]">VaultTrust</h1>
            <p className="text-label-sm text-white/40 mt-0.5">Freelancer Portal</p>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center px-6 py-3 transition-colors ${
                      isActive
                        ? "text-[#95d3bf] font-bold border-r-4 border-[#95d3bf] bg-white/5"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80"
                    }`}
                  >
                    <span className="material-symbols-outlined mr-3 text-[20px]">
                      {item.icon}
                    </span>
                    <span className="text-label-md font-label-md">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom CTA */}
        <div className="px-6 mt-auto pt-6 border-t border-white/10">
          <Link
            href="/consent/active"
            onClick={() => setOpen(false)}
            className="w-full bg-[#95d3bf] text-[#0d1f1a] py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            View Active Consents
          </Link>
        </div>
      </aside>
    </>
  );
}
