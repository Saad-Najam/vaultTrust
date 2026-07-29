import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { verifyLedgerChain } from "@/lib/ledger";

// Read-only: exposes ledger entries (with per-entry hash-chain verification,
// same as /api/v1/audit/ledger) for a single consent so the Freelancer and
// Bank dashboards can render a timeline. No new write paths.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }

    const { id: consentId } = await params;
    const consent = await dbService.getConsent(consentId);
    if (!consent) {
      return NextResponse.json({ success: false, error: "Consent not found." }, { status: 404 });
    }

    if (authUser.uid !== consent.freelancerId && authUser.uid !== consent.bankId) {
      return NextResponse.json(
        { success: false, error: "Access Denied: You are not a party to this consent." },
        { status: 403 }
      );
    }

    const results = await verifyLedgerChain(consentId);
    const entries = results.map((r) => ({ ...r.entry, verified: r.verified, reason: r.reason }));

    return NextResponse.json({
      success: true,
      consentId,
      entries,
    });
  } catch (error: any) {
    console.error("Audit trail API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
