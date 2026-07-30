"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Authentication is not configured.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch token result to inspect custom role claims
      const tokenResult = await user.getIdTokenResult();
      const role = tokenResult.claims.role;

      // Set cookie for compatibility if needed, but primarily relying on bearer auth
      document.cookie = `x-user-id=${user.uid}; path=/; max-age=${60 * 60 * 24 * 7}`;

      // 3. Redirect based on role claim
      if (role === "BANK_OFFICER") {
        router.push("/lending");
      } else {
        router.push("/connect");
      }
    } catch (err) {
      console.error("Login flow error:", err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-margin-mobile relative overflow-hidden select-none">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-float-bg" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55vw] h-[55vw] bg-tertiary/5 rounded-full blur-[150px] pointer-events-none animate-float-bg delay-300" />

      {/* Main Container Card */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-[28px] p-8 max-w-md w-full shadow-2xl relative z-10 animate-slide-up">
        <div className="text-center mb-6">
          <h2 className="text-headline-md font-extrabold text-primary tracking-tight">
            Log In
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1.5">
            Access your secure VaultTrust account
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-error-container/20 border border-error/20 text-error text-body-sm px-4 py-3 rounded-xl flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-1.5 pl-1">
              Email Address
            </label>
            <input
              type="email"
              className="w-full bg-surface-container-highest border border-outline/10 text-on-surface rounded-xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all text-body-md"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 pl-1">
              <label className="text-label-md font-bold text-on-surface-variant">
                Password
              </label>
              <a href="#" className="text-label-sm text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              className="w-full bg-surface-container-highest border border-outline/10 text-on-surface rounded-xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all text-body-md"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-75"
          >
            <span>{loading ? "Logging in..." : "Log In"}</span>
            {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-body-sm text-on-surface-variant">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary font-bold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
