import { NextResponse } from "next/server";
import { ConsentLedgerEntry, dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { verifyLedgerChain } from "@/lib/ledger";
import { getErrorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;

    // Freelancers see the ledger for their own consents; bank officers see
    // every consent ever granted to their own bankId. Same verification
    // logic either way — only which consents feed into it differs.
    const entries =
      authUser.role === "BANK_OFFICER"
        ? await dbService.listLedgerEntriesForBank(userId)
        : await dbService.listLedgerEntriesForFreelancer(userId);

    // Group entries by consentId and verify each chain
    const consentIds = Array.from(new Set(entries.map((e) => e.consentId)));
    const verifiedEntries: (ConsentLedgerEntry & { verified: boolean; reason?: string })[] = [];
    // The frontend reads this as `verified` — keep the response key aligned
    // with that (it was previously named isChainIntact here but never
    // renamed on the way out, so the UI always read it as undefined/falsy).
    let verified = true;

    for (const cid of consentIds) {
      // Run full chain integrity checks
      const verificationResults = await verifyLedgerChain(cid);

      for (const res of verificationResults) {
        verifiedEntries.push({
          ...res.entry,
          verified: res.verified,
          reason: res.reason,
        });

        if (!res.verified) {
          verified = false;
        }
      }
    }

    // Sort combined entries chronologically for display
    verifiedEntries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Bank officers' entries span multiple freelancers, so resolve which
    // applicant each consentId belongs to for display purposes.
    let applicantNames: Record<string, string> | undefined;
    if (authUser.role === "BANK_OFFICER") {
      applicantNames = {};
      for (const cid of consentIds) {
        const consent = await dbService.getConsent(cid);
        if (consent) {
          const freelancer = await dbService.getUser(consent.freelancerId);
          applicantNames[cid] = freelancer?.name || "Unknown Freelancer";
        }
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      ledger: verifiedEntries,
      verified,
      ...(applicantNames ? { applicantNames } : {}),
    });
  } catch (error) {
    console.error("Audit ledger API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
