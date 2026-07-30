import { NextResponse } from "next/server";
import crypto from "crypto";
import { dbService, ConsentLedgerEntry } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { verifyLedgerChain } from "@/lib/ledger";
import { getOnChainConsent } from "@/lib/blockchain/client/consent-client";
import { getVaultTrustProgram } from "@/lib/blockchain/client/program";
import { getErrorMessage } from "@/lib/errors";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// The most recent GRANT/SCOPE_CHANGE entry carries the plaintext purpose/scope
// that the current on-chain hashes should match — REVOKE/BANK_ACCESS entries
// don't carry that payload.
function findLatestContentPayload(entries: ConsentLedgerEntry[]): { purpose?: string; scope?: string } | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.eventType === "GRANT" || entry.eventType === "SCOPE_CHANGE") {
      return (entry.payload as { purpose?: string; scope?: string }) ?? null;
    }
  }
  return null;
}

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

    // 1. Recalculate the local hash chain.
    const chainResults = await verifyLedgerChain(consentId);
    const localChainIntact = chainResults.length > 0 && chainResults.every((r) => r.verified);

    // 2. Expected purpose/scope hashes from the most recent GRANT/SCOPE_CHANGE entry.
    const latestContent = findLatestContentPayload(chainResults.map((r) => r.entry));
    const expectedPurposeHash = sha256Hex(latestContent?.purpose ?? consent.purpose);
    const expectedScopeHash = sha256Hex(latestContent?.scope ?? consent.scope);

    // 3. Fetch on-chain state, if a confirmed signature exists.
    let onChain: Awaited<ReturnType<typeof getOnChainConsent>> = null;
    let onChainError: string | null = null;
    if (consent.solanaTxSignature) {
      try {
        onChain = await getOnChainConsent({ freelancerUid: consent.freelancerId, bankUid: consent.bankId });
      } catch (err) {
        onChainError = getErrorMessage(err);
      }
    }

    // 4. Determine overall verification status.
    let status: "VERIFIED" | "TAMPERED" | "BLOCKCHAIN_PENDING";
    const reasons: string[] = [];

    if (!localChainIntact) {
      status = "TAMPERED";
      reasons.push("Local hash-chain integrity check failed.");
      for (const r of chainResults) {
        if (!r.verified) reasons.push(`Block ${r.entry.id}: ${r.reason}`);
      }
    } else if (!onChain) {
      status = "BLOCKCHAIN_PENDING";
      reasons.push(
        consent.blockchainStatus === "FAILED"
          ? "Blockchain write previously failed and is pending retry; local ledger is confirmed."
          : "No confirmed on-chain record yet; local ledger is confirmed."
      );
    } else if (onChain.purposeHash !== expectedPurposeHash || onChain.scopeHash !== expectedScopeHash) {
      status = "TAMPERED";
      reasons.push("On-chain purpose/scope hash does not match the local ledger's plaintext.");
    } else if ((onChain.status === "Revoked") !== (consent.status === "REVOKED")) {
      status = "TAMPERED";
      reasons.push("On-chain status does not match the local consent status.");
    } else {
      status = "VERIFIED";
    }

    const program = getVaultTrustProgram();

    return NextResponse.json({
      success: true,
      consentId,
      status,
      reasons,
      transactionSignature: consent.solanaTxSignature || null,
      programId: program.programId.toBase58(),
      timestamp: new Date().toISOString(),
      localLedger: {
        intact: localChainIntact,
        entryCount: chainResults.length,
      },
      onChain: onChain
        ? {
            status: onChain.status,
            purposeHash: onChain.purposeHash,
            scopeHash: onChain.scopeHash,
            grantedAt: onChain.grantedAt,
            updatedAt: onChain.updatedAt,
            lastAccessedAt: onChain.lastAccessedAt,
          }
        : null,
      onChainError,
    });
  } catch (error) {
    console.error("Consent verify API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
