// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createHash } from "crypto";
import { assert } from "chai";
import type { VaultTrust } from "../lib/blockchain/idl/vault_trust";

function sha256(input: string): number[] {
  return Array.from(createHash("sha256").update(input).digest());
}

// Funds a fresh keypair from the already-funded provider wallet instead of
// the devnet faucet, which has a strict per-project daily rate limit.
async function fundFromProvider(
  provider: anchor.AnchorProvider,
  recipient: PublicKey,
  lamports: number
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );
  const sig = await provider.sendAndConfirm(tx);
  return sig;
}

describe("vault-trust", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VaultTrust as Program<VaultTrust>;

  const freelancer = Keypair.generate();
  const bank = Keypair.generate();
  const consentId = `test-freelancer_test-bank-${Date.now()}`;

  const [consentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("consent"), freelancer.publicKey.toBuffer(), bank.publicKey.toBuffer()],
    program.programId
  );

  before(async () => {
    for (const kp of [freelancer, bank]) {
      await fundFromProvider(provider, kp.publicKey, 50_000_000);
    }
  });

  it("grant_consent creates an active consent record", async () => {
    const purposeHash = sha256("income verification for loan application");
    const scopeHash = sha256("transactions:6mo");

    await program.methods
      .grantConsent(consentId, purposeHash, scopeHash, new anchor.BN(0))
      .accounts({
        consent: consentPda,
        userAuthority: freelancer.publicKey,
        bankWallet: bank.publicKey,
        feePayer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([freelancer])
      .rpc();

    const consent = await program.account.consentAccount.fetch(consentPda);
    assert.equal(consent.consentId, consentId);
    assert.equal(consent.userAuthority.toBase58(), freelancer.publicKey.toBase58());
    assert.equal(consent.bankWallet.toBase58(), bank.publicKey.toBase58());
    assert.deepEqual(Array.from(consent.purposeHash), purposeHash);
    assert.deepEqual(Array.from(consent.scopeHash), scopeHash);
    assert.deepEqual(consent.status, { active: {} });
    assert.equal(consent.lastAccessedAt.toNumber(), 0);
  });

  it("update_consent changes purpose/scope while staying active", async () => {
    const newPurposeHash = sha256("updated purpose: credit line increase review");
    const newScopeHash = sha256("transactions:12mo");

    await program.methods
      .updateConsent(newPurposeHash, newScopeHash, new anchor.BN(0))
      .accounts({
        consent: consentPda,
        userAuthority: freelancer.publicKey,
        bankWallet: bank.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    const consent = await program.account.consentAccount.fetch(consentPda);
    assert.deepEqual(Array.from(consent.purposeHash), newPurposeHash);
    assert.deepEqual(Array.from(consent.scopeHash), newScopeHash);
    assert.deepEqual(consent.status, { active: {} });
  });

  it("log_bank_access records access without changing status", async () => {
    await program.methods
      .logBankAccess()
      .accounts({
        consent: consentPda,
        userAuthority: freelancer.publicKey,
        bankWallet: bank.publicKey,
      } as any)
      .signers([bank])
      .rpc();

    const consent = await program.account.consentAccount.fetch(consentPda);
    assert.isAbove(consent.lastAccessedAt.toNumber(), 0);
    assert.deepEqual(consent.status, { active: {} });
  });

  it("revoke_consent marks the consent as revoked", async () => {
    await program.methods
      .revokeConsent()
      .accounts({
        consent: consentPda,
        userAuthority: freelancer.publicKey,
        bankWallet: bank.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    const consent = await program.account.consentAccount.fetch(consentPda);
    assert.deepEqual(consent.status, { revoked: {} });
  });

  it("rejects update_consent on an already-revoked consent", async () => {
    let threw = false;
    try {
      await program.methods
        .updateConsent(sha256("should not apply"), sha256("should not apply"), new anchor.BN(0))
        .accounts({
          consent: consentPda,
          userAuthority: freelancer.publicKey,
          bankWallet: bank.publicKey,
        } as any)
        .signers([freelancer])
        .rpc();
    } catch (err: any) {
      threw = true;
      assert.include(err.toString(), "ConsentNotActive");
    }
    assert.isTrue(threw, "expected update_consent to reject a revoked consent");
  });

  it("rejects a signer who is not the consent's user_authority", async () => {
    const impostor = Keypair.generate();
    await fundFromProvider(provider, impostor.publicKey, 50_000_000);

    const otherBank = Keypair.generate();
    const [otherConsentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("consent"), impostor.publicKey.toBuffer(), otherBank.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantConsent(`impostor-test-${Date.now()}`, sha256("p"), sha256("s"), new anchor.BN(0))
      .accounts({
        consent: otherConsentPda,
        userAuthority: impostor.publicKey,
        bankWallet: otherBank.publicKey,
        feePayer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([impostor])
      .rpc();

    let threw = false;
    try {
      await program.methods
        .revokeConsent()
        .accounts({
          consent: otherConsentPda,
          userAuthority: freelancer.publicKey, // wrong signer on purpose
          bankWallet: otherBank.publicKey,
        } as any)
        .signers([freelancer])
        .rpc();
    } catch (err: any) {
      threw = true;
    }
    assert.isTrue(threw, "expected revoke_consent to reject a non-owning signer");
  });
});
