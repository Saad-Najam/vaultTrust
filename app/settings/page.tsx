"use client";

import React, { useState, useEffect, useRef } from "react";
import FreelancerSidebar from "@/components/FreelancerSidebar";
import { auth } from "@/lib/firebase";
import { waitForAuthInit } from "@/lib/auth_client";
import { fetchWithAuth } from "@/lib/fetch_client";
import { useCurrentUser, setCurrentUserProfile } from "@/lib/use_current_user";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

/** Downscales an image file client-side so the stored data URL stays small. */
function resizeImageToDataUrl(file: File, maxDim = 320, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the selected image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is not supported in this browser."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const currentUser = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth?.currentUser || (await waitForAuthInit());
      setEmail(user?.email || null);
      setUid(user?.uid || null);
      setLoading(false);
    };
    load();
  }, []);

  // Seed the editable fields once the real profile has loaded (only once,
  // so it doesn't clobber in-progress edits on re-render).
  useEffect(() => {
    if (!currentUser.loading) {
      setName(currentUser.name || "");
      setPhotoPreview(currentUser.photoURL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.loading]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }

    setProfileError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      if (dataUrl.length > 400_000) {
        setProfileError("That image is still too large. Please try a smaller photo.");
        return;
      }
      setPhotoPreview(dataUrl);
      setPhotoChanged(true);
    } catch (err: any) {
      setProfileError(err.message || "Could not process that image.");
    }
  };

  const handleSaveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setProfileError("Name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const body: Record<string, string> = { name: trimmedName };
      if (photoChanged && photoPreview) {
        body.photoURL = photoPreview;
      }
      const res = await fetchWithAuth("/api/v1/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Push straight into the shared cache so every avatar in the shell
        // updates now rather than on the next full page load.
        setCurrentUserProfile({
          name: data.name ?? trimmedName,
          photoURL: data.photoURL ?? null,
        });
        setProfileSuccess(true);
        setPhotoChanged(false);
        setTimeout(() => setProfileSuccess(false), 3000);
      } else {
        setProfileError(data.error || "Could not save your profile.");
      }
    } catch (err) {
      console.error("[Settings] Save profile failed:", err);
      setProfileError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <FreelancerSidebar />
      <main className="lg:ml-64 min-h-screen bg-surface animate-fade-in">
        <header className="flex items-center w-full pl-16 pr-5 lg:px-margin-desktop h-16 bg-surface-container-lowest shadow-sm sticky top-0 z-30">
          <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Settings</h2>
        </header>

        <div className="max-w-2xl mx-auto py-12 px-gutter space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-8">
            <h3 className="text-headline-sm font-headline-sm text-on-surface mb-6">Profile</h3>

            {currentUser.loading ? (
              <p className="text-body-md text-on-surface-variant">Loading profile...</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group flex-shrink-0"
                    title="Change profile photo"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary-container bg-primary-container flex items-center justify-center">
                      {photoPreview ? (
                        <img
                          className="w-full h-full object-cover"
                          src={photoPreview}
                          alt="Profile photo"
                        />
                      ) : (
                        <span className="text-on-primary-container font-bold text-headline-sm">
                          {getInitials(name || "Freelancer")}
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                    </div>
                  </button>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border-2 border-outline-variant rounded-lg font-bold text-label-md text-on-surface hover:border-primary hover:text-primary transition-colors"
                    >
                      Change photo
                    </button>
                    <p className="text-label-sm text-on-surface-variant mt-2">JPG or PNG, resized automatically.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <div>
                  <label className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1 block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <p className="text-label-sm text-on-surface-variant mt-1">
                    This is the name shown across VaultTrust, including on your Connected Accounts page.
                  </p>
                </div>

                {profileError && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex items-start gap-2">
                    <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                    <p className="text-body-sm text-error">{profileError}</p>
                  </div>
                )}
                {profileSuccess && (
                  <div className="p-3 bg-[#E8F5E9] border border-primary/20 rounded-xl flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">check_circle</span>
                    <p className="text-body-sm text-primary">Profile updated successfully.</p>
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:opacity-90 transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {savingProfile ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}
          </div>

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
