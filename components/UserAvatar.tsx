"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use_current_user";

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function UserAvatar({
  size = "w-10 h-10",
  showName = false,
  href = "/settings",
}: {
  size?: string;
  showName?: boolean;
  /** Where clicking the avatar goes. Pass null to render it non-interactive
   *  (e.g. bank-officer shells, where /settings is the freelancer page). */
  href?: string | null;
}) {
  const { name, photoURL } = useCurrentUser();

  const avatar = (
    <div
      className={`${size} rounded-full overflow-hidden border-2 border-primary-container bg-primary-container flex items-center justify-center flex-shrink-0`}
    >
      {photoURL ? (
        <img
          className="w-full h-full object-cover"
          src={photoURL}
          alt={name || "Profile photo"}
        />
      ) : (
        <span className="text-on-primary-container font-bold text-label-sm">
          {getInitials(name)}
        </span>
      )}
    </div>
  );

  const label = showName && name && (
    <span className="text-label-md font-label-md text-on-surface hidden sm:block">
      {name}
    </span>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-3" title={name || undefined}>
        {label}
        {avatar}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title="Edit profile"
      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
    >
      {label}
      {avatar}
    </Link>
  );
}
