import { Platform } from "./platforms";
import { DtiTier } from "./scoring";

/**
 * Disclosure-gated eligibility.
 *
 * Why this exists: income sharing and outflow (DTI) sharing used to be two
 * independent opt-ins, which is adversely selective. A freelancer earning
 * 200k and servicing 300k of card debt could share only the income half and
 * present a clean profile — precisely the applicant whose DTI matters most is
 * the one with the strongest incentive to withhold it.
 *
 * The fix is to make disclosure a precondition for the upper bands rather than
 * a bonus: withholding outflow caps you at the entry tier no matter how strong
 * the income score is. Hiding then buys nothing, so there is no reason to hide.
 */

export type DisclosureStatus =
  /** Cards linked and outflow consented — a real, statement-backed DTI. */
  | "SHARED"
  /** Outflow consented but no cards linked — the applicant asserts no card debt. */
  | "DECLARED_NONE"
  /** Outflow withheld from this bank. Treated as an active risk signal. */
  | "NOT_SHARED";

export type EligibilityTier = "MICRO" | "CLASSIC" | "GOLD" | "PLATINUM";

/** Ascending order — index arithmetic below relies on this. */
export const TIER_ORDER: EligibilityTier[] = ["MICRO", "CLASSIC", "GOLD", "PLATINUM"];

export const TIER_DETAIL: Record<
  EligibilityTier,
  { label: string; maxLimitPKR: number }
> = {
  MICRO: { label: "Micro-credit / BNPL up to PKR 30,000", maxLimitPKR: 30_000 },
  CLASSIC: {
    label: "Classic Credit Card / BNPL up to PKR 100,000",
    maxLimitPKR: 100_000,
  },
  GOLD: {
    label: "Gold Credit Card / Personal Loan up to PKR 250,000",
    maxLimitPKR: 250_000,
  },
  PLATINUM: {
    label: "Platinum Credit Card / Personal Loan up to PKR 500,000",
    maxLimitPKR: 500_000,
  },
};

/** How many tiers a given DTI risk band costs the applicant. */
const DTI_TIER_PENALTY: Record<DtiTier, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
};

export interface EligibilityAssessment {
  tier: EligibilityTier;
  label: string;
  maxLimitPKR: number;

  /** What the income score alone would have granted, before gating. */
  baseTier: EligibilityTier;
  disclosure: DisclosureStatus;
  /** True when disclosure or DTI pulled the tier below `baseTier`. */
  capped: boolean;
  capReason: string | null;
  /** Tier the applicant would reach by disclosing — drives the UI nudge. */
  tierIfDisclosed: EligibilityTier | null;

  dtiTier: DtiTier | null;
  /**
   * True when "no debt" is the applicant's own assertion rather than something
   * derived from linked statements. A bureau check (eCIB) is the real
   * verification — this flag tells the bank when to run one.
   */
  selfAttested: boolean;
  /** Short lines the bank UI renders verbatim. */
  notes: string[];
}

function tierFromIvs(ivs: number): EligibilityTier {
  if (ivs >= 80) return "PLATINUM";
  if (ivs >= 60) return "GOLD";
  if (ivs >= 40) return "CLASSIC";
  return "MICRO";
}

function shiftTier(tier: EligibilityTier, downBy: number): EligibilityTier {
  const idx = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, idx - downBy)];
}

/**
 * Works out which disclosure posture applies.
 *
 * `consentSources` is the source list on the active consent for the requesting
 * bank. Pass `null` for the freelancer's own preview, where no consent record
 * exists yet and we want to show what they'd qualify for if they did share.
 */
export function resolveDisclosure(opts: {
  consentSources?: Platform[] | null;
  hasLinkedCards: boolean;
}): DisclosureStatus {
  const { consentSources, hasLinkedCards } = opts;

  if (consentSources && !consentSources.includes("CREDIT_CARD")) {
    return "NOT_SHARED";
  }
  return hasLinkedCards ? "SHARED" : "DECLARED_NONE";
}

/**
 * Combines income score, disclosure posture and DTI into a final tier.
 *
 * Order matters: withholding caps first (that is the anti-gaming rule), and a
 * disclosed-but-poor DTI steps down from the income tier. Disclosing a bad DTI
 * therefore still beats hiding it, which is the incentive we want.
 */
export function assessEligibility(params: {
  ivs: number;
  disclosure: DisclosureStatus;
  dtiTier?: DtiTier | null;
}): EligibilityAssessment {
  const { ivs, disclosure } = params;
  const dtiTier = params.dtiTier ?? null;

  const baseTier = tierFromIvs(ivs);
  const notes: string[] = [];

  let tier = baseTier;
  let capReason: string | null = null;
  let tierIfDisclosed: EligibilityTier | null = null;
  let selfAttested = false;

  if (disclosure === "NOT_SHARED") {
    // The anti-gaming rule: no outflow visibility, no upper bands.
    tier = "MICRO";
    capReason =
      "Outflow and debt-to-income not shared. Entry tier only until obligations are disclosed.";
    // Best case if they later disclose and their DTI turns out clean.
    tierIfDisclosed = baseTier;
    notes.push(
      "Applicant declined to share credit obligations. Recommend an eCIB bureau check before approval."
    );
  } else if (disclosure === "DECLARED_NONE") {
    selfAttested = true;
    notes.push(
      "Applicant reports no credit card obligations. Self-declared and not statement-backed — confirm via eCIB."
    );
  } else {
    // SHARED — a real DTI is available, so step down for genuine risk.
    const penalty = dtiTier ? DTI_TIER_PENALTY[dtiTier] : 0;
    if (penalty > 0) {
      tier = shiftTier(baseTier, penalty);
      capReason = `Debt-to-income assessed ${dtiTier}. Tier reduced from ${baseTier} on disclosed obligations.`;
    }
    notes.push("Credit obligations disclosed and statement-backed.");
  }

  const capped = TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(baseTier);

  return {
    tier,
    label: TIER_DETAIL[tier].label,
    maxLimitPKR: TIER_DETAIL[tier].maxLimitPKR,
    baseTier,
    disclosure,
    capped,
    capReason,
    tierIfDisclosed,
    dtiTier,
    selfAttested,
    notes,
  };
}

/**
 * Clamps a cash-flow-derived offer to what the eligibility tier permits, so the
 * headline "Pre-Approved for PKR X" can never promise more than the tier allows.
 */
export function cappedOfferPKR(
  recommendedPKR: number,
  assessment: EligibilityAssessment
): number {
  return Math.max(0, Math.min(recommendedPKR, assessment.maxLimitPKR));
}
