"use client";

import React, { useState, useEffect } from "react";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import { auth } from "@/lib/firebase";
import { waitForAuthInit } from "@/lib/auth_client";

export default function Page() {
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth?.currentUser || (await waitForAuthInit());
      setEmail(user?.email || null);
      setUid(user?.uid || null);
      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    if (!auth) return;
    setSigningOut(true);
    try {
      await auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error("[Settings] Logout failed:", err);
      setSigningOut(false);
    }
  };

  return (
    <>
      <FreelancerSidebar />
      <main className="ml-64 min-h-screen bg-surface animate-fade-in">
        <header className="flex items-center w-full px-margin-desktop h-16 bg-surface-container-lowest shadow-sm sticky top-0 z-30">
          <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Settings</h2>
        </header>

        <div className="max-w-2xl mx-auto py-12 px-gutter space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-8">
            <h3 className="text-headline-sm font-headline-sm text-on-surface mb-6">Account</h3>
            {loading ? (
              <p className="text-body-md text-on-surface-variant">Loading account details...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                    Email
                  </p>
                  <p className="text-body-md font-semibold text-on-surface">{email || "Not signed in"}</p>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                    Account ID
                  </p>
                  <p className="text-body-sm font-mono text-on-surface-variant">{uid || "—"}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-8">
            <h3 className="text-headline-sm font-headline-sm text-on-surface mb-2">Session</h3>
            <p className="text-body-sm text-on-surface-variant mb-6">
              Sign out of VaultTrust on this device.
            </p>
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="px-6 py-3 bg-error text-on-error rounded-xl font-bold text-label-md hover:opacity-90 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              {signingOut ? "Signing out..." : "Log out"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
