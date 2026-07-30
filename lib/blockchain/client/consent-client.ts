import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import crypto from "crypto";
import { getVaultTrustProgram, getServiceWalletPublicKey } from "./program";
import {
  getOrCreateCustodialWallet,
  getCustodialWalletKeypair,
  getCustodialWalletPublicKey,
} from "../utils/custodial-wallet";
import { classifyBlockchainError, withRetry, withTimeout } from "../utils/errors";
import { errorIncludes } from "@/lib/errors";

const RPC_TIMEOUT_MS = 25_000;

function sha256Bytes(input: string): number[] {
  return Array.from(crypto.createHash("sha256").update(input).digest());
}

function deriveConsentPda(freelancerPubkey: PublicKey, bankPubkey: PublicKey, programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("consent"), freelancerPubkey.toBuffer(), bankPubkey.toBuffer()],
    programId
  );
  return pda;
}

async function requireCustodialWallets(freelancerUid: string, bankUid: string) {
  const [freelancerWallet, bankWallet] = await Promise.all([
    getCustodialWalletPublicKey(freelancerUid),
    getCustodialWalletPublicKey(bankUid),
  ]);
  if (!freelancerWallet || !bankWallet) {
    throw new Error(
      `Custodial wallet missing for ${!freelancerWallet ? `freelancer (${freelancerUid})` : `bank (${bankUid})`}. Call grantConsent() first to provision it.`
    );
  }
  return { freelancerWallet, bankWallet };
}

export interface GrantConsentParams {
  freelancerUid: string;
  bankUid: string;
  consentId: string;
  purpose: string;
  scope: string;
  expiryUnixSeconds?: number;
}

export interface GrantConsentResult {
  signature: string;
  consentPda: string;
  freelancerWallet: string;
  bankWallet: string;
}

export async function grantConsent(params: GrantConsentParams): Promise<GrantConsentResult> {
  try {
    const program = getVaultTrustProgram();

    // Lazily provisions custodial wallets on first use for either party.
    const freelancerWallet = await getOrCreateCustodialWallet(params.freelancerUid);
    const bankWallet = await getOrCreateCustodialWallet(params.bankUid);
    const freelancerKeypair = await getCustodialWalletKeypair(params.freelancerUid);

    const consentPda = deriveConsentPda(freelancerWallet, bankWallet, program.programId);
    const purposeHash = sha256Bytes(params.purpose);
    const scopeHash = sha256Bytes(params.scope);
    const expiry = new anchor.BN(params.expiryUnixSeconds ?? 0);

    const signature = await withRetry(() =>
      withTimeout(
        program.methods
          .grantConsent(params.consentId, purposeHash, scopeHash, expiry)
          .accounts({
            consent: consentPda,
            userAuthority: freelancerWallet,
            bankWallet: bankWallet,
            feePayer: getServiceWalletPublicKey(),
            systemProgram: SystemProgram.programId,
          // Anchor's IDL-generated account type rejects the resolvable
          // feePayer/systemProgram entries the runtime accepts. Retyping needs
          // generated IDL types from `anchor build` (target/ is not built here)
          // and would alter live on-chain calls that cannot be verified without
          // devnet access, so the cast is kept deliberately and scoped to here.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .signers([freelancerKeypair])
          .rpc(),
        RPC_TIMEOUT_MS,
        "grant_consent"
      )
    );

    return {
      signature,
      consentPda: consentPda.toBase58(),
      freelancerWallet: freelancerWallet.toBase58(),
      bankWallet: bankWallet.toBase58(),
    };
  } catch (err) {
    throw classifyBlockchainError(err);
  }
}

export interface UpdateConsentParams {
  freelancerUid: string;
  bankUid: string;
  purpose: string;
  scope: string;
  expiryUnixSeconds?: number;
}

export async function updateConsent(params: UpdateConsentParams): Promise<{ signature: string }> {
  try {
    const program = getVaultTrustProgram();
    const { freelancerWallet, bankWallet } = await requireCustodialWallets(params.freelancerUid, params.bankUid);
    const freelancerKeypair = await getCustodialWalletKeypair(params.freelancerUid);

    const consentPda = deriveConsentPda(freelancerWallet, bankWallet, program.programId);
    const purposeHash = sha256Bytes(params.purpose);
    const scopeHash = sha256Bytes(params.scope);
    const expiry = new anchor.BN(params.expiryUnixSeconds ?? 0);

    const signature = await withRetry(() =>
      withTimeout(
        program.methods
          .updateConsent(purposeHash, scopeHash, expiry)
          .accounts({
            consent: consentPda,
            userAuthority: freelancerWallet,
            bankWallet: bankWallet,
          // Anchor's IDL-generated account type rejects the resolvable
          // feePayer/systemProgram entries the runtime accepts. Retyping needs
          // generated IDL types from `anchor build` (target/ is not built here)
          // and would alter live on-chain calls that cannot be verified without
          // devnet access, so the cast is kept deliberately and scoped to here.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .signers([freelancerKeypair])
          .rpc(),
        RPC_TIMEOUT_MS,
        "update_consent"
      )
    );

    return { signature };
  } catch (err) {
    throw classifyBlockchainError(err);
  }
}

export interface RevokeConsentParams {
  freelancerUid: string;
  bankUid: string;
}

export async function revokeConsent(params: RevokeConsentParams): Promise<{ signature: string }> {
  try {
    const program = getVaultTrustProgram();
    const { freelancerWallet, bankWallet } = await requireCustodialWallets(params.freelancerUid, params.bankUid);
    const freelancerKeypair = await getCustodialWalletKeypair(params.freelancerUid);

    const consentPda = deriveConsentPda(freelancerWallet, bankWallet, program.programId);

    const signature = await withRetry(() =>
      withTimeout(
        program.methods
          .revokeConsent()
          .accounts({
            consent: consentPda,
            userAuthority: freelancerWallet,
            bankWallet: bankWallet,
          // Anchor's IDL-generated account type rejects the resolvable
          // feePayer/systemProgram entries the runtime accepts. Retyping needs
          // generated IDL types from `anchor build` (target/ is not built here)
          // and would alter live on-chain calls that cannot be verified without
          // devnet access, so the cast is kept deliberately and scoped to here.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .signers([freelancerKeypair])
          .rpc(),
        RPC_TIMEOUT_MS,
        "revoke_consent"
      )
    );

    return { signature };
  } catch (err) {
    throw classifyBlockchainError(err);
  }
}

export interface LogBankAccessParams {
  freelancerUid: string;
  bankUid: string;
}

export interface LogBankAccessResult {
  signature: string;
  bankWallet: string;
  consentPda: string;
}

export async function logBankAccess(params: LogBankAccessParams): Promise<LogBankAccessResult> {
  try {
    const program = getVaultTrustProgram();
    const { freelancerWallet, bankWallet } = await requireCustodialWallets(params.freelancerUid, params.bankUid);
    const bankKeypair = await getCustodialWalletKeypair(params.bankUid);

    const consentPda = deriveConsentPda(freelancerWallet, bankWallet, program.programId);

    const signature = await withRetry(() =>
      withTimeout(
        program.methods
          .logBankAccess()
          .accounts({
            consent: consentPda,
            userAuthority: freelancerWallet,
            bankWallet: bankWallet,
          // Anchor's IDL-generated account type rejects the resolvable
          // feePayer/systemProgram entries the runtime accepts. Retyping needs
          // generated IDL types from `anchor build` (target/ is not built here)
          // and would alter live on-chain calls that cannot be verified without
          // devnet access, so the cast is kept deliberately and scoped to here.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .signers([bankKeypair])
          .rpc(),
        RPC_TIMEOUT_MS,
        "log_bank_access"
      )
    );

    return { signature, bankWallet: bankWallet.toBase58(), consentPda: consentPda.toBase58() };
  } catch (err) {
    throw classifyBlockchainError(err);
  }
}

export interface OnChainConsentState {
  consentId: string;
  userAuthority: string;
  bankWallet: string;
  purposeHash: string; // hex
  scopeHash: string; // hex
  expiry: number;
  grantedAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  status: "Active" | "Revoked";
}

export interface GetOnChainConsentParams {
  freelancerUid: string;
  bankUid: string;
}

// Read-only — fetches the current on-chain consent account, or null if the
// custodial wallets or the account itself don't exist yet.
export async function getOnChainConsent(
  params: GetOnChainConsentParams
): Promise<OnChainConsentState | null> {
  const program = getVaultTrustProgram();
  const [freelancerWallet, bankWallet] = await Promise.all([
    getCustodialWalletPublicKey(params.freelancerUid),
    getCustodialWalletPublicKey(params.bankUid),
  ]);
  if (!freelancerWallet || !bankWallet) return null;

  const consentPda = deriveConsentPda(freelancerWallet, bankWallet, program.programId);

  try {
    const account = await program.account.consentAccount.fetch(consentPda);
    return {
      consentId: account.consentId,
      userAuthority: account.userAuthority.toBase58(),
      bankWallet: account.bankWallet.toBase58(),
      purposeHash: Buffer.from(account.purposeHash).toString("hex"),
      scopeHash: Buffer.from(account.scopeHash).toString("hex"),
      expiry: account.expiry.toNumber(),
      grantedAt: account.grantedAt.toNumber(),
      updatedAt: account.updatedAt.toNumber(),
      lastAccessedAt: account.lastAccessedAt.toNumber(),
      status: "active" in account.status ? "Active" : "Revoked",
    };
  } catch (err) {
    if (errorIncludes(err, "Account does not exist")) return null;
    throw err;
  }
}
