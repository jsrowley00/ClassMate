import { db } from "./db";
import { aiUsageLogs } from "@shared/schema";

const GPT4O_MINI_INPUT_COST_PER_1M = 0.15;
const GPT4O_MINI_OUTPUT_COST_PER_1M = 0.60;

export async function logAiUsage(
  userId: string | null,
  endpoint: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const inputCost = (inputTokens / 1_000_000) * GPT4O_MINI_INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1_000_000) * GPT4O_MINI_OUTPUT_COST_PER_1M;
    const totalCostDollars = inputCost + outputCost;
    const totalCostCents = Math.round(totalCostDollars * 100);

    await db.insert(aiUsageLogs).values({
      userId,
      endpoint,
      inputTokens,
      outputTokens,
      estimatedCostCents: totalCostCents,
    });
  } catch (error) {
    console.error("Error logging AI usage:", error);
  }
}
