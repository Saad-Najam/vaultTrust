import { dbService, User, FreelancerProfile, ConnectedSource } from "./db";
import { SandboxAdapter } from "./adapters";
import { Platform } from "./platforms";
import { recomputeAndPersistScore } from "./score_service";

/**
 * Creates sandbox income sources and their 6-month transaction history for a
 * single freelancer, then recomputes their IVS.
 *
 * Non-destructive and uid-agnostic on purpose: the fixed demo ids below only
 * exist for scripted demos, so a real Firebase Auth account can be populated
 * by passing its own uid. Transaction generation delegates to SandboxAdapter
 * rather than keeping a second generator here — the previous local copy had
 * already drifted out of sync with the adapter's platform list.
 */
export async function seedSandboxSourcesForUser(
  uid: string,
  platforms: Platform[]
): Promise<{ sources: number; transactions: number }> {
  const adapter = new SandboxAdapter();
  const connectedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const syncedAt = new Date().toISOString();

  let transactionCount = 0;

  for (const platform of platforms) {
    const source: ConnectedSource = {
      id: `${uid}_${platform.toLowerCase()}`,
      freelancerId: uid,
      platform,
      status: "CONNECTED",
      connectedAt,
      provider: "sandbox",
      lastSyncedAt: syncedAt,
    };
    await dbService.createConnectedSource(source);

    const transactions = await adapter.fetchTransactions(uid, source.id, platform);
    if (transactions.length > 0) {
      await dbService.bulkCreateTransactions(uid, source.id, transactions);
      transactionCount += transactions.length;
    }
  }

  await recomputeAndPersistScore(uid);

  return { sources: platforms.length, transactions: transactionCount };
}

const DEMO_SOURCES: Record<string, Platform[]> = {
  "ahmed-raza-id": ["PAYONEER", "BANK_TRANSFER", "LOCAL_INVOICING"],
  "sana-malik-id": ["PAYONEER", "BANK_TRANSFER", "NAYAPAY", "EASYPAISA"],
};

/**
 * Full demo reset. DESTRUCTIVE — wipes every collection before reseeding, so
 * this is deliberately script-only and must never be reachable over HTTP.
 */
export async function seedDatabase(force: boolean = false) {
  if (!force) {
    const existing = await dbService.getUser("ahmed-raza-id");
    if (existing) {
      console.log("Database already seeded. Skipping...");
      return;
    }
  }

  console.log("Seeding database...");
  await dbService.clearAll();

  const users: User[] = [
    {
      id: "ahmed-raza-id",
      name: "Ahmed Raza",
      role: "FREELANCER",
      email: "ahmed.raza@gmail.com",
      kycStatus: "SIMULATED_PASS",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sana-malik-id",
      name: "Sana Malik",
      role: "FREELANCER",
      email: "sana.malik@gmail.com",
      kycStatus: "SIMULATED_PASS",
      createdAt: new Date().toISOString(),
    },
    {
      id: "ubl-bank-id",
      name: "UBL Digital Lending Team",
      role: "BANK_OFFICER",
      email: "lending@ubl.com.pk",
      kycStatus: "VERIFIED",
      createdAt: new Date().toISOString(),
    },
  ];

  for (const u of users) {
    await dbService.createUser(u);
  }

  const profiles: FreelancerProfile[] = [
    {
      userId: "ahmed-raza-id",
      city: "Lahore",
      monthlyIncomeMin: 150000,
      monthlyIncomeMax: 250000,
    },
    {
      userId: "sana-malik-id",
      city: "Karachi",
      monthlyIncomeMin: 80000,
      monthlyIncomeMax: 120000,
    },
  ];

  for (const p of profiles) {
    await dbService.createFreelancerProfile(p);
  }

  let total = 0;
  for (const [uid, platforms] of Object.entries(DEMO_SOURCES)) {
    const result = await seedSandboxSourcesForUser(uid, platforms);
    total += result.transactions;
  }

  console.log(`Seeded ${total} mock transactions!`);
}
