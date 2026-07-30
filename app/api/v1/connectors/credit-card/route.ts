import { NextResponse } from "next/server";
import { CreditCardAccount, dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import {
  buildMockStatement,
  creditCardSourceId,
  getSpendCreditSnapshot,
} from "@/lib/spend_service";
import { getErrorMessage } from "@/lib/errors";
import { z } from "zod";

/** Upper bounds are sanity rails, not product limits — they reject typos. */
const MAX_LIMIT_PKR = 50_000_000;

const linkSchema = z.object({
  provider: z.string().trim().min(2).max(60).optional(),
  last4: z.string().regex(/^\d{4}$/, "last4 must be 4 digits").optional(),
  creditLimitPKR: z.number().positive().max(MAX_LIMIT_PKR).optional(),
  statementBalancePKR: z.number().min(0).max(MAX_LIMIT_PKR).optional(),
  minPaymentDuePKR: z.number().min(0).max(MAX_LIMIT_PKR).optional(),
  statementDate: z.string().datetime().optional(),
  onTimePayments: z.number().int().min(0).max(600).optional(),
  totalPayments: z.number().int().min(0).max(600).optional(),
});

const syncSchema = z.object({ cardId: z.string().min(1).optional() });
const removeSchema = z.object({ cardId: z.string().min(1).optional() });

/** Parses an optional JSON body; a bodyless request is valid for every verb here. */
async function readBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const raw = await request.json();
    return schema.parse(raw ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) throw err;
    return schema.parse({});
  }
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized: Freelancer role required" },
    { status: 401 }
  );
}

function errorResponse(error: unknown, tag: string) {
  console.error(`[CreditCard ${tag}] Error:`, error);
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { success: false, error: error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { success: false, error: getErrorMessage(error) },
    { status: 500 }
  );
}

/**
 * GET /api/v1/connectors/credit-card
 * Returns linked cards plus derived spend/credit health (utilisation, DTI,
 * net free cash flow, recommended limit, privacy-preserving badges).
 */
export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") return unauthorized();

    const snapshot = await getSpendCreditSnapshot(authUser.uid);
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    return errorResponse(error, "GET");
  }
}

/**
 * POST /api/v1/connectors/credit-card
 * Links a credit card, or ingests uploaded statement figures.
 *
 * Any field the caller omits is filled from a realistic sandbox statement, so
 * the demo path ("Connect") and the upload path share one code path. Creates
 * the CREDIT_CARD ConnectedSource on first card, and re-activates it if it was
 * previously disconnected.
 */
export async function POST(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") return unauthorized();

    const input = await readBody(request, linkSchema);
    const uid = authUser.uid;
    const sourceId = creditCardSourceId(uid);
    const now = new Date().toISOString();

    // Ensure the connector source exists and is active.
    const existingSource = await dbService.getConnectedSource(uid, sourceId);
    if (!existingSource) {
      await dbService.createConnectedSource({
        id: sourceId,
        freelancerId: uid,
        platform: "CREDIT_CARD",
        status: "CONNECTED",
        connectedAt: now,
        provider: "sandbox",
        lastSyncedAt: now,
      });
    } else if (existingSource.status === "DISCONNECTED") {
      await dbService.updateConnectedSource(uid, sourceId, {
        status: "CONNECTED",
        connectedAt: now,
        lastSyncedAt: now,
      });
    }

    const existingCards = await dbService.listCreditCards(uid);

    // Start from a mock statement, then let any supplied figures win. This is
    // what makes partial statement uploads work without branching.
    const cardId = `${uid}_card_${existingCards.length + 1}`;
    const base = buildMockStatement({
      freelancerId: uid,
      sourceId,
      cardId,
      provider: input.provider,
      creditLimitPKR: input.creditLimitPKR,
    });

    const card: CreditCardAccount = {
      ...base,
      last4: input.last4 ?? base.last4,
      statementBalancePKR: input.statementBalancePKR ?? base.statementBalancePKR,
      minPaymentDuePKR: input.minPaymentDuePKR ?? base.minPaymentDuePKR,
      statementDate: input.statementDate ?? base.statementDate,
      onTimePayments: input.onTimePayments ?? base.onTimePayments,
      totalPayments: input.totalPayments ?? base.totalPayments,
    };

    // Reject an exact duplicate rather than quietly doubling someone's debt.
    const duplicate = existingCards.find(
      (c) => c.provider === card.provider && c.last4 === card.last4
    );
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `ALREADY_LINKED: ${card.provider} ending ${card.last4} is already linked. Sync it instead.`,
        },
        { status: 409 }
      );
    }

    // A balance above the limit is almost always a transposed upload.
    if (card.statementBalancePKR > card.creditLimitPKR) {
      return NextResponse.json(
        {
          success: false,
          error: "Statement balance cannot exceed the credit limit.",
        },
        { status: 400 }
      );
    }
    if (card.minPaymentDuePKR > card.statementBalancePKR) {
      return NextResponse.json(
        {
          success: false,
          error: "Minimum payment due cannot exceed the statement balance.",
        },
        { status: 400 }
      );
    }
    if (card.onTimePayments > card.totalPayments) {
      return NextResponse.json(
        {
          success: false,
          error: "On-time payments cannot exceed total payments.",
        },
        { status: 400 }
      );
    }

    await dbService.upsertCreditCard(card);
    const snapshot = await getSpendCreditSnapshot(uid);

    return NextResponse.json({
      success: true,
      card,
      ...snapshot,
      message: `${card.provider} linked. Spend and DTI metrics updated.`,
    });
  } catch (error) {
    return errorResponse(error, "POST");
  }
}

/**
 * PATCH /api/v1/connectors/credit-card
 * "Sync Statement" — re-pulls the latest statement for one card, or all cards
 * when no `cardId` is given. Preserves the issuer, last4 and credit limit
 * (those are properties of the card, not the statement) and refreshes the
 * balance, amount due, statement date and repayment history.
 */
export async function PATCH(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") return unauthorized();

    const { cardId } = await readBody(request, syncSchema);
    const uid = authUser.uid;

    const allCards = await dbService.listCreditCards(uid);
    const targets = cardId ? allCards.filter((c) => c.id === cardId) : allCards;

    if (targets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: cardId ? "Card not found." : "No linked cards to sync.",
        },
        { status: 404 }
      );
    }

    const syncedAt = new Date().toISOString();
    for (const card of targets) {
      const fresh = buildMockStatement({
        freelancerId: uid,
        sourceId: card.sourceId,
        cardId: card.id,
        provider: card.provider,
        creditLimitPKR: card.creditLimitPKR,
      });
      await dbService.upsertCreditCard({
        ...card,
        statementBalancePKR: fresh.statementBalancePKR,
        minPaymentDuePKR: fresh.minPaymentDuePKR,
        statementDate: fresh.statementDate,
        // Repayment history only ever grows.
        totalPayments: card.totalPayments + 1,
        onTimePayments: card.onTimePayments + 1,
        lastSyncedAt: syncedAt,
      });
    }

    await dbService
      .updateConnectedSource(uid, creditCardSourceId(uid), { lastSyncedAt: syncedAt })
      // The source row is cosmetic here; a missing one must not fail the sync.
      .catch((e) => console.error("[CreditCard PATCH] source stamp failed:", e));

    const snapshot = await getSpendCreditSnapshot(uid);

    return NextResponse.json({
      success: true,
      syncedAt,
      syncedCardIds: targets.map((c) => c.id),
      ...snapshot,
      message: `Synced ${targets.length} statement(s).`,
    });
  } catch (error) {
    return errorResponse(error, "PATCH");
  }
}

/**
 * DELETE /api/v1/connectors/credit-card
 * Removes one card, or disconnects the whole connector when no `cardId` is
 * given. The source is marked DISCONNECTED once the last card is gone, which
 * drops these obligations out of DTI.
 */
export async function DELETE(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") return unauthorized();

    const { cardId } = await readBody(request, removeSchema);
    const uid = authUser.uid;
    const sourceId = creditCardSourceId(uid);

    const allCards = await dbService.listCreditCards(uid);
    if (allCards.length === 0) {
      return NextResponse.json(
        { success: false, error: "No linked cards to remove." },
        { status: 404 }
      );
    }

    const targets = cardId ? allCards.filter((c) => c.id === cardId) : allCards;
    if (targets.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card not found." },
        { status: 404 }
      );
    }

    for (const card of targets) {
      await dbService.deleteCreditCard(uid, card.id);
    }

    const remaining = allCards.length - targets.length;
    if (remaining === 0) {
      await dbService
        .updateConnectedSource(uid, sourceId, { status: "DISCONNECTED" })
        .catch((e) =>
          console.error("[CreditCard DELETE] source status update failed:", e)
        );
    }

    const snapshot = await getSpendCreditSnapshot(uid);

    return NextResponse.json({
      success: true,
      removedCardIds: targets.map((c) => c.id),
      ...snapshot,
      message:
        remaining === 0
          ? "Credit card connector disconnected."
          : `Removed ${targets.length} card(s).`,
    });
  } catch (error) {
    return errorResponse(error, "DELETE");
  }
}
