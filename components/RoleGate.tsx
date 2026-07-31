"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole, ROLE_HOME, type UserRole } from "@/lib/use_role";

function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

/**
 * Restricts a page to a single role.
 *
 * Renders nothing but a spinner until the role is known, so a page can never
 * flash the wrong portal's chrome, and bounces mismatched users to their own
 * portal instead of showing them a shell they cannot use.
 */
export default function RoleGate({
  allow,
  children,
}: {
  allow: UserRole;
  children: React.ReactNode;
}) {
  const { role, loading, signedOut } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Signed out, or signed in but the token/role could not be read at all —
    // either way send them back through login rather than hanging on a
    // spinner that would never resolve.
    if (signedOut || !role) {
      router.replace("/login");
      return;
    }
    if (role !== allow) {
      router.replace(ROLE_HOME[role]);
    }
  }, [loading, signedOut, role, allow, router]);

  // Hold the spinner through the redirect too, so the wrong portal never paints.
  if (loading || signedOut || !role || role !== allow) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
