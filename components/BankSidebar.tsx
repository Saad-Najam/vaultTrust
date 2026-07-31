"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/lending", icon: "group", label: "Applicant Profiles" },
  { href: "/consent/active", icon: "fact_check", label: "Consent Status" },
  { href: "/audit", icon: "receipt_long", label: "Audit Trail" },
  { href: "/dashboard", icon: "insights", label: "Insights" },
];

export default function BankSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white fixed left-0 top-0 h-screen flex flex-col py-8 shadow-[4px_0px_20px_rgba(0,0,0,0.08)] z-30 overflow-y-auto border-r border-gray-100">
      {/* Logo */}
      <Link href="/" className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#004a3b] flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[20px]">account_balance</span>
        </div>
        <div>
          <h1 className="text-headline-sm font-bold text-[#004a3b]">UBL Digital</h1>
          <p className="text-label-sm text-gray-400 mt-0">Enterprise Portal</p>
        </div>
      </Link>

      {/* Nav links */}
      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center px-6 py-3 rounded-xl mx-2 transition-colors ${
                    isActive
                      ? "bg-[#004a3b]/10 text-[#004a3b] font-bold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
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

      {/* Bottom user section */}
      <div className="px-6 mt-auto pt-6 border-t border-gray-100">
        <Link
          href="/lending"
          className="w-full bg-[#004a3b] text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-label-md"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          New Application
        </Link>
      </div>
    </aside>
  );
}
