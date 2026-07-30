"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getErrorMessage } from "@/lib/errors";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"FREELANCER" | "BANK_OFFICER">("FREELANCER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Authentication is not configured.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update name profile
      await updateProfile(user, { displayName: name });

      // 2. Retrieve initial ID Token
      const token = await user.getIdToken();

      // 3. Register user doc & role custom claims via Server Route Handler
      const registerRes = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, role }),
      });

      const registerData = await registerRes.json();
      if (!registerData.success) {
        throw new Error(registerData.error || "Failed to finalize registration.");
      }

      // 4. Force-refresh token to fetch the new custom role claim set by the server
      await user.getIdToken(true);
      console.log(`[Signup] Registration final, role claim loaded: ${role}`);

      // 5. Redirect based on role. New freelancers land on Connected Accounts
      //    so their first step is linking an income source.
      if (role === "BANK_OFFICER") {
        router.push("/lending");
      } else {
        router.push("/connect");
      }
    } catch (err) {
      console.error("Signup flow error:", err);
      setError(getErrorMessage(err, "An unexpected error occurred during signup."));
      
      // Clean up user if server registration failed
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (deleteErr) {
          console.warn("Could not delete orphaned auth user:", deleteErr);
        }
      }
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
            Create Account
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1.5">
            Join VaultTrust Secure Consent Data Network
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-error-container/20 border border-error/20 text-error text-body-sm px-4 py-3 rounded-xl flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-1.5 pl-1">
              Full Name
            </label>
            <input
              type="text"
              className="w-full bg-surface-container-highest border border-outline/10 text-on-surface rounded-xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all text-body-md"
              placeholder="e.g. Ahmed Raza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
            <label className="block text-label-md font-bold text-on-surface-variant mb-1.5 pl-1">
              Password
            </label>
            <input
              type="password"
              className="w-full bg-surface-container-highest border border-outline/10 text-on-surface rounded-xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all text-body-md"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Role selection box */}
          <div>
            <label className="block text-label-md font-bold text-on-surface-variant mb-2.5 pl-1">
              Choose Your Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("FREELANCER")}
                className={`py-3.5 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  role === "FREELANCER"
                    ? "bg-primary-container/20 border-primary text-primary font-bold shadow-sm"
                    : "bg-surface-container-highest/40 border-outline/10 text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="text-label-sm">Freelancer</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("BANK_OFFICER")}
                className={`py-3.5 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  role === "BANK_OFFICER"
                    ? "bg-primary-container/20 border-primary text-primary font-bold shadow-sm"
                    : "bg-surface-container-highest/40 border-outline/10 text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">account_balance</span>
                <span className="text-label-sm">Bank Officer</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-75"
          >
            <span>{loading ? "Registering..." : "Sign Up"}</span>
            {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-body-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
