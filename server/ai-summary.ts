import OpenAI from "openai";
import { PORTKEY_GATEWAY_URL, createHeaders } from "portkey-ai";

const portKeyApiKey = process.env.PORTKEY_API_KEY || process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: "X",
  baseURL: PORTKEY_GATEWAY_URL,
  defaultHeaders: createHeaders({
    apiKey: portKeyApiKey!,
    virtualKey: "ppk-cost-dashboard",
  }),
});

interface SpendCategory {
  categoryName: string;
  actual: number;
  budget: number;
  variance: number;
  isOverBudget: boolean;
  percentUsed: number;
}

interface TopExpense {
  account: string;
  amount: number;
  caseName?: string;
}

interface SummaryInput {
  practiceName: string;
  periodLabel: string;
  totalSpend: number;
  totalBudget: number;
  variance: number;
  isUnderBudget: boolean;
  spendTypeBreakdown: SpendCategory[];
  topExpenses: TopExpense[];
  compensationBreakdown: TopExpense[];
}

export async function generateVarianceSummary(input: SummaryInput): Promise<string> {
  const prompt = buildPrompt(input);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a concise financial analyst for an internal cost center management team. Generate a 2-3 sentence natural-language summary of a practice's budget performance. Be specific about dollar amounts (use $K or $M format), name the specific spend categories driving variances, and highlight any notable outliers. Use a professional but conversational tone. Do not use bullet points or lists — write flowing sentences."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 300,
  });

  return response.choices[0].message.content || "Unable to generate summary.";
}

function buildPrompt(input: SummaryInput): string {
  const dir = input.isUnderBudget ? "under" : "over";
  const varAmt = formatDollar(Math.abs(input.variance));

  let prompt = `Practice: ${input.practiceName}\n`;
  prompt += `Period: ${input.periodLabel}\n`;
  prompt += `Total Spend: ${formatDollar(input.totalSpend)} | Budget: ${formatDollar(input.totalBudget)} | ${dir} budget by ${varAmt}\n\n`;

  prompt += `Spend by Category:\n`;
  for (const cat of input.spendTypeBreakdown) {
    const catDir = cat.isOverBudget ? "over" : "under";
    prompt += `- ${cat.categoryName}: Actual ${formatDollar(cat.actual)} vs Budget ${formatDollar(cat.budget)} (${catDir} by ${formatDollar(Math.abs(cat.variance))}, ${cat.percentUsed}% used)\n`;
  }

  if (input.compensationBreakdown.length > 0) {
    prompt += `\nCompensation breakdown:\n`;
    for (const comp of input.compensationBreakdown.slice(0, 5)) {
      prompt += `- ${comp.account}: ${formatDollar(comp.amount)}\n`;
    }
  }

  if (input.topExpenses.length > 0) {
    prompt += `\nTop program expenses:\n`;
    for (const exp of input.topExpenses.slice(0, 8)) {
      prompt += `- ${exp.caseName || exp.account}: ${formatDollar(exp.amount)}\n`;
    }
  }

  prompt += `\nProvide a 2-3 sentence insight about this practice's budget performance, highlighting the key drivers of variance and any notable patterns.`;

  return prompt;
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (abs >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}
