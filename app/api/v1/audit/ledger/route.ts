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

    // Fetch all ledger entries for this freelancer (across all their consents)
    const entries = await dbService.listLedgerEntriesForFreelancer(userId);

    // Group entries by consentId and verify each chain
    const consentIds = Array.from(new Set(entries.map((e) => e.consentId)));
    const verifiedEntries: (ConsentLedgerEntry & { verified: boolean; reason?: string })[] = [];
    let isChainIntact = true;

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
          isChainIntact = false;
        }
      }
    }

    // Sort combined entries chronologically for display
    verifiedEntries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      userId,
      ledger: verifiedEntries,
      isChainIntact,
    });
  } catch (error) {
    console.error("Audit ledger API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
