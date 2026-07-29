import crypto from "crypto";
import { ComputedScoreResult } from "./scoring";
import { IMPROVEMENT_RULES, identifyWeakFactors, WeakFactorKey } from "./improvementRules";

export type ExplanationLanguage = "en" | "roman-urdu";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

// ---- Shared: in-memory cache, keyed by a hash of the exact score data + language ----

interface CacheEntry {
  value: string | string[];
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function scoreCacheKey(prefix: string, scoreData: ComputedScoreResult, language: string): string {
  const canonical = JSON.stringify({
    avgMonthlyIncome: scoreData.avgMonthlyIncome,
    coefficientOfVariation: scoreData.coefficientOfVariation,
    trend: scoreData.trend,
    sourceDiversityScore: scoreData.sourceDiversityScore,
    ivs: scoreData.ivs,
    eligibilityBandPKR: scoreData.eligibilityBandPKR,
    language,
  });
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  return `${prefix}:${hash}`;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached(key: string, value: string | string[]): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---- Shared: Gemini call ----

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API returned ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Gemini response did not contain text content");
    }
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function languageInstruction(language: ExplanationLanguage): string {
  return language === "roman-urdu"
    ? "Respond in Roman Urdu (Urdu written using Latin/English script), simple and conversational."
    : "Respond in clear, simple English.";
}

function scoreContextJSON(scoreData: ComputedScoreResult): string {
  return JSON.stringify(
    {
      avgMonthlyIncome: scoreData.avgMonthlyIncome,
      coefficientOfVariation: scoreData.coefficientOfVariation,
      trend: scoreData.trend,
      sourceDiversityScore: scoreData.sourceDiversityScore,
      ivs: scoreData.ivs,
      eligibilityBandPKR: scoreData.eligibilityBandPKR,
    },
    null,
    2
  );
}

// ---- Score Explanation ----------------------------------------------------

function buildExplanationPrompt(scoreData: ComputedScoreResult, language: ExplanationLanguage): string {
  return `You are explaining a pre-computed financial reliability score to a freelancer. Here is the exact score data (already calculated, final):
${scoreContextJSON(scoreData)}

Do not recalculate or second-guess these numbers. Only explain, in plain, simple language, why these specific values would produce this score. Do not invent new numbers or contradict the given values.
${languageInstruction(language)}
Keep the explanation to 2-4 sentences maximum. Do not use markdown formatting.`;
}

function fallbackExplanation(scoreData: ComputedScoreResult, language: ExplanationLanguage): string {
  const covPercent = Math.round(scoreData.coefficientOfVariation * 100);
  const diversityPercent = Math.round(scoreData.sourceDiversityScore * 100);
  if (language === "roman-urdu") {
    return `Aap ka IVS score ${scoreData.ivs} hai. Yeh aap ki average monthly income (PKR ${scoreData.avgMonthlyIncome.toLocaleString()}), income consistency (${covPercent}% variation), trend (${scoreData.trend}), aur income source diversity (${diversityPercent}%) par based hai.`;
  }
  return `Your IVS is ${scoreData.ivs}, based on your average monthly income (PKR ${scoreData.avgMonthlyIncome.toLocaleString()}), income consistency (${covPercent}% variation), trend (${scoreData.trend.toLowerCase()}), and source diversity (${diversityPercent}%).`;
}

export async function generateScoreExplanation(
  scoreData: ComputedScoreResult,
  language: ExplanationLanguage = "en"
): Promise<string> {
  const key = scoreCacheKey("explain", scoreData, language);
  const cached = getCached<string>(key);
  if (cached) return cached;

  try {
    const explanation = await callGemini(buildExplanationPrompt(scoreData, language));
    setCached(key, explanation);
    return explanation;
  } catch (err: any) {
    console.error("[SCORE EXPLANATION] Gemini call failed, using fallback template", {
      error: err.message || String(err),
    });
    const fallback = fallbackExplanation(scoreData, language);
    setCached(key, fallback);
    return fallback;
  }
}

// ---- Improvement Plan -------------------------------------------------

// Below the "Gold" band cutoff (ivs 60) in scoring.ts's eligibility tiers —
// Gold and above is already a good outcome, so no suggestions are needed.
const GOOD_IVS_THRESHOLD = 60;

export const IMPROVEMENT_DISCLAIMER =
  "These are general, educational suggestions based on your score factors, not formal financial advice.";

export interface ImprovementPlan {
  suggestions: string[];
  disclaimer: string;
}

function fallbackImprovementSuggestions(weakFactors: WeakFactorKey[], language: ExplanationLanguage): string[] {
  // Directly templated from the pre-approved directions — no AI involved.
  // Capped at 3, same as the Gemini path, so the field's shape is consistent
  // regardless of which path produced it.
  return weakFactors.slice(0, 3).map((factor) => {
    const direction = IMPROVEMENT_RULES[factor];
    return language === "roman-urdu" ? `Agle 3 mahinon mein: ${direction}.` : `Over the next 3 months: ${direction}.`;
  });
}

function buildImprovementPrompt(
  scoreData: ComputedScoreResult,
  directions: string[],
  language: ExplanationLanguage
): string {
  return `A freelancer's financial reliability score has some weak factors. Here is the score context (already calculated, final, do not recalculate):
${scoreContextJSON(scoreData)}

Here are the ONLY approved suggestion directions for this freelancer's weak factors:
${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Using ONLY the provided suggestion directions, write 2-3 short, specific, actionable suggestions for the next 3 months. Do NOT suggest stopping or switching income sources, taking loans, specific financial products, or anything outside the given directions. Keep tone encouraging, not alarming.
${languageInstruction(language)}
Respond as a plain line-separated list, one suggestion per line, no markdown, no numbering, no extra commentary.`;
}

function parseSuggestionLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

export async function generateImprovementPlan(
  scoreData: ComputedScoreResult,
  language: ExplanationLanguage = "en"
): Promise<ImprovementPlan | null> {
  if (scoreData.ivs >= GOOD_IVS_THRESHOLD) {
    return null;
  }

  const weakFactors = identifyWeakFactors(scoreData);
  if (weakFactors.length === 0) {
    return null;
  }

  const key = scoreCacheKey("improve", scoreData, language);
  const cached = getCached<string[]>(key);
  if (cached) return { suggestions: cached, disclaimer: IMPROVEMENT_DISCLAIMER };

  const directions = weakFactors.map((f) => IMPROVEMENT_RULES[f]);

  try {
    const raw = await callGemini(buildImprovementPrompt(scoreData, directions, language));
    const suggestions = parseSuggestionLines(raw);
    if (suggestions.length === 0) throw new Error("Gemini returned no parsable suggestions");
    setCached(key, suggestions);
    return { suggestions, disclaimer: IMPROVEMENT_DISCLAIMER };
  } catch (err: any) {
    console.error("[IMPROVEMENT PLAN] Gemini call failed, using fallback template", {
      error: err.message || String(err),
    });
    const fallback = fallbackImprovementSuggestions(weakFactors, language);
    setCached(key, fallback);
    return { suggestions: fallback, disclaimer: IMPROVEMENT_DISCLAIMER };
  }
}
