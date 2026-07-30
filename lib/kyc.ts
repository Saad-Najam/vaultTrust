/** Provider-specific document bundle; opaque to the mock verifier. */
export type KycDocuments = Record<string, unknown>;

export interface KycVerificationResult {
  status: "SIMULATED_PASS" | "VERIFIED" | "FAILED";
  providerRef: string;
}

export interface KycProvider {
  verify(uid: string, documents: KycDocuments): Promise<KycVerificationResult>;
}

/**
 * Sandbox KYC Provider simulating a passing check with a short delay.
 */
export class SandboxKycProvider implements KycProvider {
  async verify(_uid: string, _documents: KycDocuments): Promise<KycVerificationResult> {
    // Artificial delay to simulate real asynchronous OCR processing
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      status: "SIMULATED_PASS",
      providerRef: `sandbox_kyc_${Math.random().toString(36).substring(2, 10)}`,
    };
  }
}

/**
 * Live KYC Provider stub (e.g. Onfido/Jumio integration shape)
 */
export class LiveKycProvider implements KycProvider {
  private isConfigured(): boolean {
    return !!(
      process.env.ONFIDO_API_KEY &&
      process.env.ONFIDO_WORKFLOW_ID
    );
  }

  async verify(_uid: string, _documents: KycDocuments): Promise<KycVerificationResult> {
    if (!this.isConfigured()) {
      throw new Error("NOT_CONFIGURED: Onfido KYC Provider API credentials (ONFIDO_API_KEY) are missing in environment.");
    }
    // Real Onfido SDK verification calls would happen here
    return {
      status: "VERIFIED",
      providerRef: `onfido_live_ref_${Math.random().toString(36).substring(2, 10)}`,
    };
  }
}

/**
 * Factory to get the active KycProvider.
 * Falls back to Sandbox if ONFIDO_API_KEY is not defined.
 */
export function getKycProvider(): KycProvider {
  if (process.env.ONFIDO_API_KEY) {
    return new LiveKycProvider();
  }
  return new SandboxKycProvider();
}
