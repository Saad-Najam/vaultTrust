"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";
import { fetchWithAuth } from "./fetch_client";

export interface CurrentUserProfile {
  name: string | null;
  email: string | null;
  photoURL: string | null;
  role: "FREELANCER" | "BANK_OFFICER" | null;
}

interface StoreState extends CurrentUserProfile {
  loading: boolean;
}

const EMPTY: StoreState = {
  name: null,
  email: null,
  photoURL: null,
  role: null,
  loading: true,
};

/**
 * Module-level cache so every UserAvatar / consumer on a page shares one
 * request and one snapshot. Without this, each mounted avatar issued its own
 * /profile/me fetch and they could disagree after an edit.
 */
let state: StoreState = EMPTY;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: Partial<StoreState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreState {
  return state;
}

// Server render has no auth context; keep it stable to avoid hydration noise.
function getServerSnapshot(): StoreState {
  return EMPTY;
}

async function load(force: boolean): Promise<void> {
  if (inFlight && !force) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetchWithAuth("/api/v1/profile/me");
      const data = await res.json();
      if (data.success) {
        setState({
          name: data.name || null,
          email: data.email || null,
          photoURL: data.photoURL || null,
          role: data.role || null,
          loading: false,
        });
      } else {
        setState({ loading: false });
      }
    } catch (err) {
      console.error("[useCurrentUser] fetch error:", err);
      setState({ loading: false });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Reads the signed-in user's display profile (name/email/photo). Shared by the
 * app shell avatars and the Settings editor so they never drift apart.
 */
export function useCurrentUser() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Only the first consumer triggers the network call; the rest read cache.
    if (state.loading && !inFlight) {
      void load(false);
    }
  }, []);

  const refetch = useCallback(() => load(true), []);

  return { ...snapshot, refetch };
}

/** Applies a freshly-saved profile to the shared cache without a round trip. */
export function setCurrentUserProfile(next: Partial<CurrentUserProfile>) {
  setState({ ...next, loading: false });
}
