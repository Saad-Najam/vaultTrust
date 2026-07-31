"use client";

import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { waitForAuthInit } from "./auth_client";

export type UserRole = "FREELANCER" | "BANK_OFFICER";

/** Where each role's portal starts. Used for post-login and mismatch redirects. */
export const ROLE_HOME: Record<UserRole, string> = {
  FREELANCER: "/dashboard",
  BANK_OFFICER: "/lending",
};

export interface RoleState {
  role: UserRole | null;
  /** True until the role has been resolved (or definitively found absent). */
  loading: boolean;
  /** True when auth resolved but nobody is signed in. */
  signedOut: boolean;
}

/**
 * Resolves the signed-in user's role from their Firebase ID token claims.
 *
 * Deliberately does NOT go through /api/v1/profile/me: the role is already a
 * custom claim inside the JWT, so reading it here is instant and cannot fail
 * because of a slow or erroring network request. Routing decisions that depend
 * on a fetch will silently fall back to "no role" whenever that fetch fails —
 * which previously rendered the freelancer portal to bank officers.
 */
export function useRole(): RoleState {
  const [state, setState] = useState<RoleState>({
    role: null,
    loading: true,
    signedOut: false,
  });

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!auth) {
        if (!cancelled) setState({ role: null, loading: false, signedOut: true });
        return;
      }
      const user = auth.currentUser || (await waitForAuthInit());
      if (cancelled) return;

      if (!user) {
        setState({ role: null, loading: false, signedOut: true });
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult();
        if (cancelled) return;
        const claim = tokenResult.claims.role;
        const role: UserRole =
          claim === "BANK_OFFICER" ? "BANK_OFFICER" : "FREELANCER";
        setState({ role, loading: false, signedOut: false });
      } catch {
        // A signed-in user whose token can't be read is still signed in;
        // treat the role as unknown rather than guessing at one.
        if (!cancelled) setState({ role: null, loading: false, signedOut: false });
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
