import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { getErrorMessage } from "@/lib/errors";

/**
 * GET /api/v1/consent/bank-status
 * Every consent (active or revoked) ever granted to the calling bank —
 * the bank-side equivalent of a freelancer's own "Consent Status" page.
 */
export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "BANK_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access Denied: Bank Officer credentials required." },
        { status: 403 }
      );
    }

    const consents = await dbService.listConsentsForBank(authUser.uid);
    const results = await Promise.all(
      consents.map(async (consent) => {
        const freelancer = await dbService.getUser(consent.freelancerId);
        return {
          consentId: consent.id,
          freelancerId: consent.freelancerId,
          freelancerName: freelancer?.name || "Unknown Freelancer",
          status: consent.status,
          duration: consent.duration,
          sources: consent.sources,
          grantedAt: consent.grantedAt,
          revokedAt: consent.revokedAt,
          blockchainStatus: consent.blockchainStatus || null,
        };
      })
    );

    return NextResponse.json({ success: true, consents: results });
  } catch (error) {
    console.error("Bank consent status API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
