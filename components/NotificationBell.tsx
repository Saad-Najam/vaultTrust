"use client";

import { useEffect, useRef, useState } from "react";

/** Standalone bell + dropdown. No notifications backend exists yet, so this
 *  shows an honest empty state instead of the fake unread dot the mockup had. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-full p-2 transition-opacity active:opacity-80"
      >
        <span className="material-symbols-outlined text-on-surface-variant" data-icon="notifications">
          notifications
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-[0px_12px_32px_rgba(0,0,0,0.12)] border border-outline-variant/30 p-4 z-50">
          <p className="text-label-md font-bold text-on-surface mb-1">Notifications</p>
          <p className="text-body-sm text-on-surface-variant">You&apos;re all caught up — no new notifications.</p>
        </div>
      )}
    </div>
  );
}
