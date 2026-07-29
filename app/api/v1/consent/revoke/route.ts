import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { appendLedgerEntry } from "@/lib/ledger";
import { revokeConsent as revokeConsentOnChain } from "@/lib/blockchain/client/consent-client";
import { z } from "zod";

const RevokeConsentSchema = z.object({
  consentId: z.string().optional(),
  bankId: z.string().optional(),
});

async function handleRevocation(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;
    
    // Parse body or query params to find consentId or bankId
    let consentId: string | undefined;
    let bankId: string | undefined;

    const { searchParams } = new URL(request.url);
    consentId = searchParams.get("consentId") || undefined;
    bankId = searchParams.get("bankId") || undefined;

    if (!consentId) {
      try {
        const body = await request.json();
        const parsed = RevokeConsentSchema.safeParse(body);
        if (parsed.success) {
          consentId = parsed.data.consentId;
          bankId = parsed.data.bankId;
        }
      } catch (e) {
        // Body reading failed or empty, fallback to active search
      }
    }

    // Find the consent to revoke (by ID or find active one)
    let consent = null;
    if (consentId) {
      consent = await dbService.getConsent(consentId);
    } else {
      const activeBankId = bankId || "ubl-bank-id";
      consent = await dbService.getConsent(`${userId}_${activeBankId}`);
    }

    if (!consent || consent.freelancerId !== userId) {
      return NextResponse.json(
        { success: false, error: "Active consent policy not found." },
        { status: 404 }
      );
    }

    if (consent.status === "REVOKED") {
      return NextResponse.json({
        success: true,
        message: "Consent is already revoked.",
        consent,
      });
    }

    // Revoke the consent in the DB (guaranteed write)
    const revokedAt = new Date().toISOString();
    await dbService.updateConsent(consent.id, {
      status: "REVOKED",
      revokedAt,
    });

    // Append REVOKE to the ledger (guaranteed — sufficient on its own for
    // the request to succeed, independent of blockchain availability)
    const ledgerEntry = await appendLedgerEntry(consent.id, "REVOKE", {
      reason: "Revoked by user",
      revokedAt,
    });

    // Best-effort dual-write to Solana devnet. Same safety pattern as grant:
    // never blocks the response, failures are logged for retry.
    let blockchain: { status: "CONFIRMED" | "FAILED"; signature?: string } = { status: "FAILED" };
    try {
      const onChain = await revokeConsentOnChain({
        freelancerUid: userId,
        bankUid: consent.bankId,
      });
      blockchain = { status: "CONFIRMED", signature: onChain.signature };
      await dbService.updateConsent(consent.id, {
        blockchainStatus: "CONFIRMED",
        solanaTxSignature: onChain.signature,
      });
    } catch (chainError: any) {
      console.error("[BLOCKCHAIN WRITE FAILED - revoke_consent]", {
        consentId: consent.id,
        error: chainError.message || chainError,
      });
      try {
        await dbService.updateConsent(consent.id, {
          blockchainStatus: "FAILED",
          blockchainError: chainError.message || String(chainError),
        });
      } catch (statusUpdateError) {
        console.error("[FAILED TO RECORD BLOCKCHAIN FAILURE STATUS]", { consentId: consent.id, statusUpdateError });
      }
    }

    // Refetch rather than spreading the pre-fetched `consent` object — that
    // object predates the blockchain attempt above, so echoing it back would
    // leak a stale blockchainError/blockchainStatus from a previous request.
    const freshConsent = await dbService.getConsent(consent.id);

    return NextResponse.json({
      success: true,
      consent: freshConsent,
      ledgerEntry,
      blockchain,
      message: "Consent successfully revoked and recorded in ledger.",
    });
  } catch (error: any) {
    console.error("Revoke consent API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleRevocation(request);
}

export async function DELETE(request: Request) {
  return handleRevocation(request);
}
