import { CreditCardAccount, dbService } from "./db";
import { computeSpendCreditMetrics, SpendCreditMetrics } from "./scoring";

/** Sandbox card issuers used when a statement is generated rather than supplied. */
const MOCK_ISSUERS = [
  "UBL Master Card",
  "HBL Visa Platinum",
  "Meezan Visa Classic",
  "Standard Chartered Master Card",
] as const;

export interface SpendCreditSnapshot {
  /** Cards belonging to a currently CONNECTED source. */
  cards: CreditCardAccount[];
  /** Retained cards whose source has been disconnected — excluded from metrics. */
  disconnectedCards: CreditCardAccount[];
  metrics: SpendCreditMetrics;
}

/** Deterministic source id for a freelancer's credit-card connector. */
export function creditCardSourceId(uid: string): string {
  return `${uid}_credit_card`;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Builds a realistic sandbox statement.
 *
 * Utilisation is deliberately drawn from the 12–48% range so the demo lands on
 * a plausible mix of "healthy" (<30%) and "watch" outcomes rather than always
 * showing one badge. Minimum payment follows the local convention of ~5% of the
 * outstanding balance, floored so a tiny balance still has a real due amount.
 */
export function buildMockStatement(params: {
  freelancerId: string;
  sourceId: string;
  cardId: string;
  provider?: string;
  creditLimitPKR?: number;
}): CreditCardAccount {
  const creditLimitPKR =
    params.creditLimitPKR ?? randomInt(15, 60) * 10_000; // 150k–600k
  const utilisation = randomInt(12, 48) / 100;
  const statementBalancePKR = Math.round(creditLimitPKR * utilisation);
  const minPaymentDuePKR = Math.max(
    1_000,
    Math.round((statementBalancePKR * 0.05) / 100) * 100
  );

  const totalPayments = randomInt(9, 24);
  // Most sandbox histories are clean; the occasional late payment keeps the
  // repayment badge from being a constant.
  const onTimePayments = totalPayments - (Math.random() < 0.3 ? randomInt(1, 2) : 0);

  return {
    id: params.cardId,
    freelancerId: params.freelancerId,
    sourceId: params.sourceId,
    provider:
      params.provider ?? MOCK_ISSUERS[randomInt(0, MOCK_ISSUERS.length - 1)],
    last4: String(randomInt(1000, 9999)),
    creditLimitPKR,
    statementBalancePKR,
    minPaymentDuePKR,
    statementDate: new Date().toISOString(),
    onTimePayments,
    totalPayments,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Loads the caller's cards and derives spend/credit health against their
 * persisted verified income.
 *
 * Single place this is computed, so the connect page, the dashboard widget and
 * the bank-facing reliability payload can never disagree about DTI.
 */
export async function getSpendCreditSnapshot(
  uid: string
): Promise<SpendCreditSnapshot> {
  const [allCards, incomeScore, sources] = await Promise.all([
    dbService.listCreditCards(uid),
    dbService.getIncomeScore(uid),
    dbService.listConnectedSources(uid),
  ]);

  // A card's source can be disconnected through the generic connector endpoint,
  // which leaves the card document in place. Honour that status here so a
  // disconnected card stops counting toward DTI instead of silently persisting.
  const connectedSourceIds = new Set(
    sources.filter((s) => s.status === "CONNECTED").map((s) => s.id)
  );
  const cards = allCards.filter((c) => connectedSourceIds.has(c.sourceId));
  const disconnectedCards = allCards.filter(
    (c) => !connectedSourceIds.has(c.sourceId)
  );

  const metrics = computeSpendCreditMetrics(
    cards,
    incomeScore?.avgMonthlyIncome ?? 0
  );

  return { cards, disconnectedCards, metrics };
}
